#!/usr/bin/env node
/**
 * 개인 OneDrive `hsol-info-blob/vault/` 변경 감시. 사이트는 OneDrive 를 직접 읽으므로 복사는 하지 않는다.
 * hsol.info 저장소 GitHub Actions(.github/workflows/watch-onedrive.yml)에서 매시 실행한다.
 *
 *  - 기사  : `objects/news-articles/` 가 바뀌면 Neon articles 미러를 갱신하고, 새로 INSERT 된 기사의 dbId 를
 *            OneDrive 원본 frontmatter 에 되쓴다.
 *  - 빌드  : 사이트 생성물에 영향이 있을 수 있는 vault 경로가 바뀌면 그 목록을 GITHUB_OUTPUT
 *            `vault_changed_files` 로 넘긴다. 워크플로가 Build With Vault Refresh 를 디스패치한다.
 *
 * 변경 판정은 OneDrive QuickXorHash 목록을 Neon `onedrive_sync_state`('vault-manifest')와 비교한다.
 * 첫 실행(기록 없음)은 기준선만 남기고 변경으로 보지 않는다.
 *
 * 필요 환경변수: DATABASE_URL, ONEDRIVE_TOKEN_KEY, ONEDRIVE_DRIVE_ID
 * 선택: FORCE_ARTICLES=1, ONEDRIVE_VAULT_ROOT(기본 hsol-info-blob/vault)
 * 플래그: --dry-run (기록, 역기록, 출력 없이 차이만 출력)
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { getState, setState } from "./lib/onedrive-token.mjs";
import { openOneDrive } from "./lib/rclone-onedrive.mjs";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");
const VAULT_ROOT = process.env.ONEDRIVE_VAULT_ROOT || "hsol-info-blob/vault";
const ARTICLES_REL = "objects/news-articles/";
const MANIFEST_KEY = "vault-manifest";

const IGNORED_NAMES = new Set([".DS_Store", ".DS-Store", ".gitkeep", "Icon\r"]);
/** 사이트 생성에 쓰지 않는 vault 경로. */
const EXCLUDED_PREFIXES = [".obsidian/", "Templates/", "Attachments/", "datasources/"];
const EXCLUDED_EXTS = new Set([".base"]);
/** hsol.info CI(Build With Vault Refresh)가 만들어 OneDrive 에 쓰는 생성물. 자기 트리거를 막으려고 뺀다. */
export const VAULT_GENERATED = new Set([
  "object-views/site-data.json",
  "object-views/onepager-ko.html",
  "object-views/onepager-en.html",
  "object-views/onepager-ko.pdf",
  "object-views/onepager-en.pdf",
  "object-views/hsol-info-parent-ref.json",
]);

const sha1 = (buf) => createHash("sha1").update(buf).digest("hex");

function isJunk(rel) {
  return rel.split("/").some((p) => IGNORED_NAMES.has(p) || (p.startsWith(".") && p !== ".obsidian"));
}

function include(rel) {
  return (
    !isJunk(rel) &&
    !EXCLUDED_PREFIXES.some((p) => rel.startsWith(p)) &&
    !EXCLUDED_EXTS.has(path.extname(rel).toLowerCase()) &&
    !VAULT_GENERATED.has(rel)
  );
}

/** OneDrive 트리를 { rel(NFC) -> hash } 로. */
async function listHashes(od, root) {
  const raw = await od.rclone(["lsjson", "-R", "--files-only", "--hash", "--hash-type", "QuickXorHash", `od:${root}`]);
  const out = {};
  for (const item of JSON.parse(raw)) {
    const rel = item.Path.normalize("NFC");
    out[rel] = item.Hashes?.quickxor ?? item.Hashes?.QuickXorHash ?? `${item.Size}:${item.ModTime}`;
  }
  return out;
}

/** 기사 원본을 받아 Neon 에 반영하고, dbId 가 새로 붙은 파일을 OneDrive 에 되쓴다. 되쓴 파일 목록을 돌려준다. */
async function syncArticles(od) {
  const odDir = `${VAULT_ROOT}/${ARTICLES_REL.replace(/\/$/, "")}`;
  const local = await mkdtemp(path.join(os.tmpdir(), "articles-"));
  try {
    await od.rclone(["copy", `od:${odDir}`, local, "--exclude", ".*"]);
    const names = (await readdir(local)).filter((n) => n.endsWith(".md"));
    const before = new Map();
    for (const n of names) before.set(n, sha1(await readFile(path.join(local, n))));

    const args = [path.join(SCRIPT_DIR, "sync-articles-to-neon.mjs"), ...(DRY_RUN ? ["--dry"] : [])];
    const { stdout } = await execFileAsync("node", args, {
      env: { ...process.env, VAULT_ARTICLES_DIR: local },
      maxBuffer: 64 * 1024 * 1024,
    });
    for (const line of stdout.split("\n")) if (line) console.log(`[기사] ${line}`);

    const written = [];
    if (DRY_RUN) return written;
    for (const n of names) {
      if (sha1(await readFile(path.join(local, n))) === before.get(n)) continue;
      await od.rclone(["copyto", path.join(local, n), `od:${odDir}/${n}`]);
      console.log(`[기사] dbId 역기록 -> OneDrive: ${n}`);
      written.push(`${ARTICLES_REL}${n}`.normalize("NFC"));
    }
    return written;
  } finally {
    await rm(local, { recursive: true, force: true });
  }
}

async function writeOutput(files) {
  if (!process.env.GITHUB_OUTPUT || !files.length) return;
  // workflow_dispatch 입력은 합계 65,535자 제한. 힌트 목록이라 앞부분만 넘겨도 변경 여부 판단은 같다.
  let joined = "";
  for (const f of files) {
    if (joined.length + f.length + 1 > 30000) break;
    joined += (joined ? "," : "") + f;
  }
  await appendFile(process.env.GITHUB_OUTPUT, `vault_changed_files=${joined}\n`);
}

async function main() {
  const od = await openOneDrive();
  try {
    const all = await listHashes(od, VAULT_ROOT);
    const current = Object.fromEntries(Object.entries(all).filter(([rel]) => include(rel)));
    const count = Object.keys(current).length;
    if (count === 0) throw new Error(`OneDrive ${VAULT_ROOT} 가 비어 보인다. 기준선을 덮어쓰지 않고 멈춘다.`);

    const prev = (await getState(od.sql, MANIFEST_KEY))?.files ?? null;
    const changed = [];
    if (prev) {
      for (const [rel, hash] of Object.entries(current)) if (prev[rel] !== hash) changed.push(rel);
      for (const rel of Object.keys(prev)) if (!(rel in current)) changed.push(rel);
      changed.sort();
    }
    console.log(
      prev
        ? `[vault] OneDrive ${count}개 / 변경 ${changed.length}개`
        : `[vault] OneDrive ${count}개 / 첫 실행: 기준선만 기록`,
    );
    for (const rel of changed.slice(0, 50)) console.log(`  * ${rel}`);
    if (changed.length > 50) console.log(`  ... 외 ${changed.length - 50}개`);

    const articlesTouched = changed.some((rel) => rel.startsWith(ARTICLES_REL));
    if (articlesTouched || process.env.FORCE_ARTICLES === "1") {
      const written = await syncArticles(od);
      if (written.length) {
        // 역기록한 파일은 새 해시로 기준선을 맞춰 다음 회차에 다시 변경으로 잡히지 않게 한다.
        const fresh = await listHashes(od, `${VAULT_ROOT}/${ARTICLES_REL.replace(/\/$/, "")}`);
        for (const [name, hash] of Object.entries(fresh)) {
          const rel = `${ARTICLES_REL}${name}`;
          if (rel in current) current[rel] = hash;
        }
      }
    }

    if (DRY_RUN) return;
    await setState(od.sql, MANIFEST_KEY, { files: current, updatedAt: new Date().toISOString() });
    if (changed.length) console.log(`[vault] 사이트 재생성 대상 변경 ${changed.length}개`);
    await writeOutput(changed);
  } finally {
    await od.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
