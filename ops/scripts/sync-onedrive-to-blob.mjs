/**
 * OneDrive(개인) -> Vercel Blob 단방향 동기화. 콘텐츠의 정본은 OneDrive 다.
 * hsol.info 저장소의 GitHub Actions(.github/workflows/sync-onedrive-to-blob.yml)에서 실행한다.
 * (2026-09-27 hsol-info-blob 저장소 폐기와 함께 이쪽으로 이전)
 *
 * 트랙
 *  - vault  : OneDrive `hsol-info-blob/vault/**`   -> Blob `info/vault/**`
 *             사이트(site-data, 원페이저)와 Ask Hansol 이 읽는 경로. 배포 사이트가 읽지 않는 경로는 제외.
 *             hsol.info CI 가 만드는 생성물(VAULT_GENERATED)은 Blob 이 정본이라 올리지 않고,
 *             반대로 Blob 에서 OneDrive 로 되써서(역미러) OneDrive 에서도 최신본을 볼 수 있게 한다.
 *  - assets : OneDrive `hsol-info-blob/assets/{public,private}/**` -> Blob `info/assets/**`
 *             사이트가 /files/<키> 로 서빙한다.
 *  - 기사   : vault 트랙에서 `objects/news-articles/` 가 바뀌면 Neon articles 미러를 갱신하고,
 *             새로 INSERT 된 기사의 dbId 를 OneDrive 원본 frontmatter 에 되쓴다.
 *
 * 증분 판정은 트랙별 manifest(OneDrive QuickXorHash)로 한다. vault 트랙은 매 실행 Blob 목록과 대조해
 * OneDrive 에 없는 파일을 지운다(생성물 제외).
 *
 * 인증: rclone OneDrive 토큰. MS 리프레시 토큰은 쓸 때마다 새것으로 바뀌므로 실행이 끝날 때 최신 토큰을
 * AES-256-GCM 으로 암호화해 Blob `info/_system/onedrive-token.enc` 에 되써 둔다. 키는 GitHub secret 에만 있다.
 *
 * 필요 환경변수: BLOB_READ_WRITE_TOKEN, ONEDRIVE_TOKEN_KEY, ONEDRIVE_DRIVE_ID
 * 선택: ONEDRIVE_BOOTSTRAP_TOKEN, DATABASE_URL(없으면 기사 동기화 생략), SYNC_TRACKS(기본 "assets,vault"),
 *       FORCE_ARTICLES=1(변경 없어도 기사 동기화)
 * 플래그: --dry-run (업로드/삭제/역기록 없이 차이만 출력)
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { del, list, put } from "@vercel/blob";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const KEY_B64 = process.env.ONEDRIVE_TOKEN_KEY;
const DRIVE_ID = process.env.ONEDRIVE_DRIVE_ID;
const BOOTSTRAP = process.env.ONEDRIVE_BOOTSTRAP_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const ACCESS = process.env.BLOB_ACCESS || "private";
const TRACKS = (process.env.SYNC_TRACKS || "assets,vault").split(",").map((s) => s.trim()).filter(Boolean);
const TOKEN_BLOB_PATH = "info/_system/onedrive-token.enc";
const CONCURRENCY = Math.max(1, Number(process.env.BLOB_SYNC_CONCURRENCY) || 8);
const DRY_RUN = process.argv.includes("--dry-run");

const IGNORED_NAMES = new Set([".DS_Store", ".DS-Store", ".blob-sync-state.json", ".gitkeep", "Icon\r"]);

/** 배포 사이트가 Blob 에서 읽지 않는 vault 경로. 이전 sync-vault-to-blob 과 같은 기준. */
const VAULT_EXCLUDED_PREFIXES = [".obsidian/", "Templates/", "Attachments/", "datasources/"];
const VAULT_EXCLUDED_EXTS = new Set([".base"]);
/** hsol.info CI 가 만들어 Blob 에 직접 올리는 생성물. Blob 이 정본이고 OneDrive 로 역미러한다. */
const VAULT_GENERATED = new Set([
  "object-views/site-data.json",
  "object-views/onepager-ko.html",
  "object-views/onepager-en.html",
  "object-views/hsol-info-parent-ref.json",
]);

const TRACK_DEFS = {
  assets: {
    odRoot: process.env.ONEDRIVE_ASSETS_ROOT || "hsol-info-blob/assets",
    prefix: "info/assets",
    manifest: "info/assets/manifest.json",
    include: (rel) => {
      const parts = rel.split("/");
      return parts.length >= 2 && (parts[0] === "public" || parts[0] === "private");
    },
    reconcile: false,
  },
  vault: {
    odRoot: process.env.ONEDRIVE_VAULT_ROOT || "hsol-info-blob/vault",
    prefix: "info/vault",
    manifest: "info/_system/vault-manifest.json",
    include: (rel) =>
      !VAULT_EXCLUDED_PREFIXES.some((p) => rel.startsWith(p)) &&
      !VAULT_EXCLUDED_EXTS.has(path.extname(rel).toLowerCase()) &&
      !VAULT_GENERATED.has(rel),
    reconcile: true,
  },
};

const CONTENT_TYPES = {
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json",
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".zip": "application/zip",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".hwp": "application/x-hwp",
  ".hwpx": "application/haansofthwpx",
  ".epub": "application/epub+zip",
};

const contentTypeOf = (key) => CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
const sha1 = (buf) => createHash("sha1").update(buf).digest("hex");

function requireEnv() {
  const missing = [];
  if (!BLOB_TOKEN) missing.push("BLOB_READ_WRITE_TOKEN");
  if (!KEY_B64) missing.push("ONEDRIVE_TOKEN_KEY");
  if (!DRIVE_ID) missing.push("ONEDRIVE_DRIVE_ID");
  if (missing.length) throw new Error(`환경변수 누락: ${missing.join(", ")}`);
  const key = Buffer.from(KEY_B64, "base64");
  if (key.length !== 32) throw new Error("ONEDRIVE_TOKEN_KEY 는 base64 로 인코딩한 32바이트여야 한다.");
  return key;
}

function encrypt(key, plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

function decrypt(key, payloadB64) {
  const buf = Buffer.from(payloadB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

async function listAllBlobs(prefix) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, token: BLOB_TOKEN, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.cursor;
  } while (cursor);
  return blobs;
}

async function fetchBlob(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${BLOB_TOKEN}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Blob 읽기 실패 ${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** private Blob 을 pathname 으로 읽는다. 없으면 null. */
async function readBlobBuffer(pathname) {
  const page = await list({ prefix: pathname, token: BLOB_TOKEN, limit: 5 });
  const hit = page.blobs.find((b) => b.pathname === pathname);
  return hit ? fetchBlob(hit.url) : null;
}

async function putBlob(pathname, body, contentType) {
  await put(pathname, body, {
    access: ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    token: BLOB_TOKEN,
  });
}

async function loadToken(key) {
  const stored = await readBlobBuffer(TOKEN_BLOB_PATH);
  if (stored) {
    console.log("토큰: Blob 에 저장된 최신 토큰 사용");
    return decrypt(key, stored.toString("utf8").trim());
  }
  if (BOOTSTRAP) {
    console.log("토큰: Blob 에 저장된 토큰이 없어 ONEDRIVE_BOOTSTRAP_TOKEN 사용");
    return BOOTSTRAP.trim();
  }
  throw new Error("OneDrive 토큰이 없다. ONEDRIVE_BOOTSTRAP_TOKEN secret 을 넣고 다시 실행해야 한다.");
}

let CONF = null;
async function rclone(args, opts = {}) {
  const { stdout } = await execFileAsync("rclone", ["--config", CONF, ...args], {
    maxBuffer: 256 * 1024 * 1024,
    ...opts,
  });
  return stdout;
}

async function readTokenFromConf() {
  const text = await readFile(CONF, "utf8");
  const line = text.split("\n").find((l) => l.startsWith("token = "));
  return line ? line.slice("token = ".length).trim() : null;
}

async function runWithConcurrency(items, limit, worker) {
  let index = 0;
  const runner = async () => {
    while (index < items.length) {
      const i = index++;
      await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
}

/** 숨김 파일과 시스템 파일. `.obsidian/` 은 트랙 규칙에서 따로 거른다. */
function isJunk(rel) {
  return rel.split("/").some((p) => IGNORED_NAMES.has(p) || (p.startsWith(".") && p !== ".obsidian"));
}

/** OneDrive 트리를 읽어 { rel -> meta } 로 돌려준다. rel 은 NFC. */
async function listOneDrive(odRoot, include) {
  const raw = await rclone(["lsjson", "-R", "--files-only", "--hash", "--hash-type", "QuickXorHash", `od:${odRoot}`]);
  const out = new Map();
  for (const item of JSON.parse(raw)) {
    const rel = item.Path.normalize("NFC");
    if (isJunk(rel) || !include(rel)) continue;
    out.set(rel, {
      srcPath: item.Path,
      size: item.Size,
      hash: item.Hashes?.quickxor ?? item.Hashes?.QuickXorHash ?? `${item.Size}:${item.ModTime}`,
      modTime: item.ModTime,
    });
  }
  return out;
}

async function syncTrack(name, workDir) {
  const def = TRACK_DEFS[name];
  const remote = await listOneDrive(def.odRoot, def.include);
  const manifestBuf = await readBlobBuffer(def.manifest);
  const prevFiles = manifestBuf ? JSON.parse(manifestBuf.toString("utf8")).files ?? {} : {};

  const uploadKeys = new Set([...remote.entries()].filter(([k, v]) => prevFiles[k]?.hash !== v.hash).map(([k]) => k));
  const deleteKeys = new Set(Object.keys(prevFiles).filter((k) => !remote.has(k)));

  if (def.reconcile) {
    // manifest 와 무관하게 Blob 실물과 대조한다. 첫 이관이나 manifest 유실에도 어긋나지 않게.
    const blobs = await listAllBlobs(`${def.prefix}/`);
    const actual = new Set(blobs.map((b) => b.pathname.slice(def.prefix.length + 1).normalize("NFC")));
    // 동기화 대상인 경로만 정리한다. 제외 경로(datasources/ 등)에 남아 있는 예전 파일은 건드리지 않는다.
    for (const k of actual) if (!remote.has(k) && !VAULT_GENERATED.has(k) && def.include(k) && !isJunk(k)) deleteKeys.add(k);
    for (const k of remote.keys()) if (!actual.has(k)) uploadKeys.add(k);
  }

  console.log(`[${name}] OneDrive ${remote.size}개 / 업로드 ${uploadKeys.size}개 / 삭제 ${deleteKeys.size}개`);

  if (DRY_RUN) {
    for (const k of uploadKeys) console.log(`  + ${k}`);
    for (const k of deleteKeys) console.log(`  - ${k}`);
    return { changed: [...uploadKeys], deleted: [...deleteKeys] };
  }

  // 안전장치: OneDrive 가 비어 보이거나(업로드 미완료, 경로 오류) 절반 넘게 지우려 하면 멈춘다.
  // 사이트와 Ask Hansol 이 Blob 을 읽으므로 대량 삭제는 곧 장애다. 의도한 경우만 ALLOW_MASS_DELETE=1.
  const baseline = Math.max(Object.keys(prevFiles).length, def.reconcile ? remote.size + deleteKeys.size : 0);
  const massDelete = remote.size === 0 ? deleteKeys.size > 0 : deleteKeys.size > Math.max(20, baseline * 0.5);
  if (massDelete && process.env.ALLOW_MASS_DELETE !== "1") {
    throw new Error(
      `[${name}] 대량 삭제 차단: OneDrive ${remote.size}개인데 Blob 에서 ${deleteKeys.size}개를 지우려 한다. ` +
        "OneDrive 업로드가 끝났는지 확인하고, 의도한 삭제면 ALLOW_MASS_DELETE=1 로 실행한다.",
    );
  }

  const nextFiles = {};
  for (const [k, v] of Object.entries(prevFiles)) if (remote.has(k)) nextFiles[k] = v;

  await runWithConcurrency([...uploadKeys], CONCURRENCY, async (rel) => {
    const meta = remote.get(rel);
    const localPath = path.join(workDir, name, rel);
    await rclone(["copyto", `od:${def.odRoot}/${meta.srcPath}`, localPath]);
    const pathname = `${def.prefix}/${rel}`;
    const contentType = contentTypeOf(rel);
    await putBlob(pathname, await readFile(localPath), contentType);
    await rm(localPath, { force: true });
    nextFiles[rel] = { size: meta.size, hash: meta.hash, modTime: meta.modTime, contentType, pathname };
    console.log(`  업로드: ${pathname}`);
  });

  const deletes = [...deleteKeys];
  for (let i = 0; i < deletes.length; i += 500) {
    const chunk = deletes.slice(i, i + 500);
    await del(chunk.map((k) => `${def.prefix}/${k}`), { token: BLOB_TOKEN });
    for (const k of chunk) console.log(`  삭제: ${def.prefix}/${k}`);
  }

  if (uploadKeys.size || deleteKeys.size || !manifestBuf) {
    const sorted = Object.fromEntries(Object.entries(nextFiles).sort(([a], [b]) => a.localeCompare(b)));
    await putBlob(
      def.manifest,
      JSON.stringify({ generatedAt: new Date().toISOString(), source: `onedrive:${def.odRoot}`, files: sorted }, null, 2),
      "application/json",
    );
  }
  return { changed: [...uploadKeys], deleted: deletes };
}

/** hsol.info CI 가 Blob 에 올린 생성물을 OneDrive vault 로 되쓴다. */
async function mirrorGeneratedToOneDrive(workDir) {
  const odRoot = TRACK_DEFS.vault.odRoot;
  for (const rel of VAULT_GENERATED) {
    const blobBuf = await readBlobBuffer(`${TRACK_DEFS.vault.prefix}/${rel}`).catch(() => null);
    if (!blobBuf) continue;
    const odBuf = await rclone(["cat", `od:${odRoot}/${rel}`], { encoding: "buffer" }).catch(() => null);
    if (odBuf && sha1(odBuf) === sha1(blobBuf)) continue;
    console.log(`[생성물] Blob -> OneDrive: ${rel}${DRY_RUN ? " (dry-run)" : ""}`);
    if (DRY_RUN) continue;
    const local = path.join(workDir, "generated", rel);
    await mkdir(path.dirname(local), { recursive: true });
    await writeFile(local, blobBuf);
    await rclone(["copyto", local, `od:${odRoot}/${rel}`]);
  }
}

/** 기사 원본을 받아 Neon 에 반영하고, dbId 가 새로 붙은 파일만 OneDrive 로 되쓴다. */
async function syncArticles(workDir) {
  if (!DATABASE_URL) {
    console.log("[기사] DATABASE_URL 이 없어 건너뜀");
    return;
  }
  const odDir = `${TRACK_DEFS.vault.odRoot}/objects/news-articles`;
  const local = path.join(workDir, "articles");
  await rclone(["copy", `od:${odDir}`, local, "--exclude", ".*"]);
  const names = (await readdir(local)).filter((n) => n.endsWith(".md"));
  const before = new Map();
  for (const n of names) before.set(n, sha1(await readFile(path.join(local, n))));

  const args = [path.join(SCRIPT_DIR, "sync-articles-to-neon.mjs"), ...(DRY_RUN ? ["--dry"] : [])];
  const { stdout } = await execFileAsync("node", args, {
    env: { ...process.env, VAULT_ARTICLES_DIR: local, DATABASE_URL },
    maxBuffer: 64 * 1024 * 1024,
  });
  for (const line of stdout.split("\n")) if (line) console.log(`[기사] ${line}`);

  if (DRY_RUN) return;
  for (const n of names) {
    const after = sha1(await readFile(path.join(local, n)));
    if (after === before.get(n)) continue;
    await rclone(["copyto", path.join(local, n), `od:${odDir}/${n}`]);
    console.log(`[기사] dbId 역기록 -> OneDrive: ${n}`);
  }
}

/**
 * 정비 작업. 워크플로 입력 maint_op 로 실행한다(쉼표로 여러 개).
 *  - stats : OneDrive 정본 폴더 현황
 * 대량 적재는 Mac OneDrive 앱을 거치지 않는다. 한글 이름 파일을 수천 개 한꺼번에 올리면 서버 이름과 로컬 이름이
 * 어긋나 앱이 멈춘다(2026-09-27). 필요하면 rclone 으로 서버에 직접 올리고 앱은 내려받기만 하게 한다.
 */
async function maintenance(op) {
  if (op === "stats") {
    for (const p of ["hsol-info-blob", "hsol-info-blob/assets"]) {
      console.log(`$ rclone size od:${p}`);
      console.log((await rclone(["size", `od:${p}`]).catch((e) => e.message)).trim());
    }
  } else {
    throw new Error(`알 수 없는 maint_op: ${op}`);
  }
}

async function main() {
  const key = requireEnv();
  const workDir = await mkdtemp(path.join(os.tmpdir(), "od-sync-"));
  CONF = path.join(workDir, "rclone.conf");
  let tokenBefore = null;

  try {
    tokenBefore = await loadToken(key);
    await writeFile(
      CONF,
      `[od]\ntype = onedrive\ndrive_type = personal\ndrive_id = ${DRIVE_ID}\ntoken = ${tokenBefore}\n`,
      { mode: 0o600 },
    );

    if (process.env.MAINT_OP) {
      for (const op of process.env.MAINT_OP.split(",").map((s) => s.trim()).filter(Boolean)) await maintenance(op);
      return;
    }

    const results = {};
    for (const name of TRACKS) {
      if (!TRACK_DEFS[name]) throw new Error(`알 수 없는 트랙: ${name}`);
      results[name] = await syncTrack(name, workDir);
    }

    if (results.vault) {
      await mirrorGeneratedToOneDrive(workDir);
      const touched = [...results.vault.changed, ...results.vault.deleted].some((k) =>
        k.startsWith("objects/news-articles/"),
      );
      if (touched || process.env.FORCE_ARTICLES === "1") await syncArticles(workDir);
    }
  } finally {
    // 성공이든 실패든 rclone 이 갱신한 토큰은 반드시 보존한다. 잃으면 재인증이 필요하다.
    try {
      const tokenAfter = await readTokenFromConf().catch(() => null);
      const latest = tokenAfter || tokenBefore;
      if (latest && !DRY_RUN) {
        // 키 교체(저장소 이전) 때만 쓴다. 다음 실행부터는 새 키로만 풀린다.
        const saveKey = process.env.ONEDRIVE_TOKEN_KEY_NEXT ? Buffer.from(process.env.ONEDRIVE_TOKEN_KEY_NEXT, "base64") : key;
        await putBlob(TOKEN_BLOB_PATH, encrypt(saveKey, latest), "text/plain");
        console.log(`토큰 저장: ${TOKEN_BLOB_PATH}${tokenAfter && tokenAfter !== tokenBefore ? " (갱신됨)" : ""}`);
      }
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
