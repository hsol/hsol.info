#!/usr/bin/env node
/**
 * OneDrive 루트 워크스페이스 마이그레이션 도구. GitHub Actions(.github/workflows/ws-migrate.yml)에서만 돈다.
 * 토큰은 저장소 시크릿과 Neon 에만 있다(openOneDrive). 매핑표 정본: OneDrive `OneDrive-WS-마이그레이션/이동-매핑표.md`.
 *
 *   inventory : 이동 전 기준 목록. hsol-info-blob 전체(경로, 크기, QuickXorHash)와 OneDrive 루트 최상위 목록을
 *               ws-migrate-out/ 에 쓴다. 같은 실행에서 워크플로가 hsol-info-blob 전체를 받아 백업 아티팩트로 올린다.
 *               OneDrive 에는 아무것도 쓰지 않는다.
 *   plan      : inventory + 이동 계획(파일별 목적지, 서버측 이동 연산 목록, 충돌 검사). OneDrive 에는 쓰지 않는다.
 *   move      : plan 을 실행한다(서버측 이동만, 삭제 없음). 끝나면 파일마다 새 위치에 같은 해시로 있는지 대조한다.
 *               WS_MIGRATE_CONFIRM=MOVE 가 아니면 거부한다.
 *   cleanup   : 허가된 삭제만 한다(.obsidian 두 곳) + hsol-info-blob 아래 빈 폴더 정리. WS_MIGRATE_CONFIRM=CLEANUP 필요.
 *
 * 선택: WS_MIGRATE_WITH_NEWSROOM=1 이면 .newsroom-watch/ 도 루트로 옮긴다(쓰는 주체 경로를 먼저 바꾼 뒤).
 *
 * 필요 환경변수: DATABASE_URL, ONEDRIVE_TOKEN_KEY, ONEDRIVE_DRIVE_ID
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { LEGACY_ROOT } from "../../src/lib/onedrive/ws-layout.mjs";
import { openOneDrive } from "./lib/rclone-onedrive.mjs";
import { buildOps } from "./lib/ws-migrate-plan.mjs";

const OUT = process.env.WS_MIGRATE_OUT || "ws-migrate-out";
const step = process.argv[2];

async function lsjson(od, target, extra = []) {
  return JSON.parse(await od.rclone(["lsjson", ...extra, target]));
}

async function inventory(od) {
  const items = await lsjson(od, `od:${LEGACY_ROOT}`, ["-R", "--files-only", "--hash", "--hash-type", "QuickXorHash"]);
  const files = items
    .map((i) => ({
      raw: i.Path,
      path: i.Path.normalize("NFC"),
      size: i.Size,
      hash: i.Hashes?.quickxor ?? i.Hashes?.QuickXorHash ?? null,
      modTime: i.ModTime,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const root = (await lsjson(od, "od:", ["--max-depth", "1"]))
    .map((i) => ({ name: i.Name.normalize("NFC"), isDir: i.IsDir, size: i.Size }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const noHash = files.filter((f) => !f.hash).length;
  const bytes = files.reduce((s, f) => s + f.size, 0);
  const summary = { takenAt: new Date().toISOString(), root: LEGACY_ROOT, files: files.length, bytes, noHash };
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "manifest-before.json"), JSON.stringify({ ...summary, files }, null, 1));
  await writeFile(path.join(OUT, "onedrive-root.json"), JSON.stringify(root, null, 1));
  console.log(`[inventory] ${LEGACY_ROOT}: 파일 ${files.length}개, ${(bytes / 1e6).toFixed(1)}MB, 해시 없음 ${noHash}개`);
  console.log(`[inventory] OneDrive 루트 최상위 ${root.length}개: ${root.map((r) => r.name + (r.isDir ? "/" : "")).join(", ")}`);
  return { files, root };
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(
      process.env.GITHUB_STEP_SUMMARY,
      `### 이동 전 기준 목록\n\n- 대상: \`${LEGACY_ROOT}\`\n- 파일: ${files.length}개\n- 용량: ${(bytes / 1e6).toFixed(1)}MB\n- 해시 없음: ${noHash}개\n- OneDrive 루트 최상위: ${root.length}개\n`,
      { flag: "a" },
    );
  }
}

const summaryLine = (s) =>
  process.env.GITHUB_STEP_SUMMARY ? writeFile(process.env.GITHUB_STEP_SUMMARY, s + "\n", { flag: "a" }) : Promise.resolve();

/** 목적지 최상위 폴더들의 현재 내용(NFC 경로 집합, 폴더 포함). */
async function existingUnder(od, tops) {
  const existing = new Set();
  const rootItems = await lsjson(od, "od:", ["--max-depth", "1"]);
  const rootNames = new Map(rootItems.map((i) => [i.Name.normalize("NFC"), i]));
  for (const t of tops) {
    const item = rootNames.get(t);
    if (!item) continue;
    existing.add(t);
    if (!item.IsDir) continue;
    for (const i of await lsjson(od, `od:${item.Name}`, ["-R", "--hash", "--hash-type", "QuickXorHash"])) {
      existing.add(`${t}/${i.Path.normalize("NFC")}`);
    }
  }
  return existing;
}

async function plan(od) {
  const { files } = await inventory(od);
  const fl = files.map((f) => ({ raw: f.raw, rel: f.path, hash: f.hash, size: f.size }));
  const withNewsroom = process.env.WS_MIGRATE_WITH_NEWSROOM === "1";
  const prelim = buildOps(fl, new Set(), { root: LEGACY_ROOT, withNewsroom });
  const tops = [...new Set(prelim.plan.filter((p) => p.dst).map((p) => p.dst.split("/")[0]))];
  const existing = await existingUnder(od, tops);
  const result = buildOps(fl, existing, { root: LEGACY_ROOT, withNewsroom });
  const kinds = {};
  for (const p of result.plan) kinds[p.kind] = (kinds[p.kind] ?? 0) + 1;
  await writeFile(path.join(OUT, "plan.json"), JSON.stringify({ withNewsroom, kinds, ...result }, null, 1));
  console.log(`[plan] 파일 ${fl.length}개: ${JSON.stringify(kinds)} / 연산 ${result.ops.length}개(폴더 ${result.ops.filter((o) => o.type === "dir").length})`);
  for (const p of result.plan.filter((x) => x.kind === "stay")) console.log(`  [그대로] ${p.rel}`);
  for (const o of result.ops.filter((x) => x.type === "dir")) console.log(`  [폴더] ${o.src} -> ${o.dst} (${o.files})`);
  for (const pr of result.problems) console.log(`  [문제] ${pr}`);
  await summaryLine(`### 이동 계획\n\n- 파일 ${fl.length}개: ${JSON.stringify(kinds)}\n- 연산 ${result.ops.length}개\n- 문제 ${result.problems.length}개\n`);
  if (result.problems.length) throw new Error(`계획에 문제 ${result.problems.length}개. 이동하지 않는다.`);
  return { ...result, existing };
}

async function runPool(items, n, fn) {
  let i = 0;
  const failures = [];
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const item = items[i++];
        try {
          await fn(item);
        } catch (e) {
          failures.push({ item, error: String(e?.stderr || e?.message || e).slice(0, 500) });
        }
      }
    }),
  );
  return failures;
}

async function move(od) {
  if (process.env.WS_MIGRATE_CONFIRM !== "MOVE") throw new Error("WS_MIGRATE_CONFIRM=MOVE 가 아니다. 이동하지 않는다.");
  const { ops, plan: filePlan } = await plan(od);
  // 부모 폴더를 먼저 순서대로 만든다(동시 생성 경합으로 같은 이름 폴더가 둘 생기는 것을 막는다).
  const dirDsts = new Set(ops.filter((o) => o.type === "dir").map((o) => o.dst));
  const parents = [...new Set(ops.map((o) => o.dst.split("/").slice(0, -1).join("/")).filter(Boolean))].sort();
  for (const p of parents) {
    if (dirDsts.has(p) || [...dirDsts].some((d) => p.startsWith(d + "/"))) {
      throw new Error(`폴더 이동 목적지 안에 다른 연산이 들어간다: ${p}`);
    }
  }
  for (const p of parents) await od.rclone(["mkdir", `od:${p}`]);
  console.log(`[move] 부모 폴더 ${parents.length}개 준비`);
  const log = [];
  const failures = await runPool(ops, 4, async (o) => {
    await od.rclone(["moveto", `od:${o.src}`, `od:${o.dst}`]);
    log.push(o);
  });
  await writeFile(path.join(OUT, "move-log.json"), JSON.stringify({ done: log, failures }, null, 1));
  console.log(`[move] 연산 ${ops.length}개 중 성공 ${log.length}, 실패 ${failures.length}`);
  for (const f of failures.slice(0, 30)) console.log(`  [실패] ${f.item.src} -> ${f.item.dst}: ${f.error}`);
  await verify(od, filePlan);
  if (failures.length) throw new Error(`이동 실패 ${failures.length}건. move-log.json 을 보고 다시 계획을 돌린다.`);
}

async function verify(od, filePlan) {
  const tops = [...new Set(filePlan.filter((p) => p.dst).map((p) => p.dst.split("/")[0]))];
  const after = new Map();
  const rootItems = await lsjson(od, "od:", ["--max-depth", "1"]);
  for (const item of rootItems) {
    const t = item.Name.normalize("NFC");
    if (!tops.includes(t) && t !== LEGACY_ROOT) continue;
    if (!item.IsDir) {
      after.set(t, null);
      continue;
    }
    for (const i of await lsjson(od, `od:${item.Name}`, ["-R", "--files-only", "--hash", "--hash-type", "QuickXorHash"])) {
      after.set(`${t}/${i.Path.normalize("NFC")}`, i.Hashes?.quickxor ?? i.Hashes?.QuickXorHash ?? null);
    }
  }
  let ok = 0;
  const missing = [];
  const mismatch = [];
  const leftover = [];
  for (const p of filePlan) {
    if (p.dst) {
      if (!after.has(p.dst)) missing.push(p);
      else if (p.hash && after.get(p.dst) !== p.hash) mismatch.push(p);
      else ok++;
      if (after.has(`${LEGACY_ROOT}/${p.rel}`)) leftover.push(p);
    } else if (!after.has(`${LEGACY_ROOT}/${p.rel}`)) {
      missing.push({ ...p, dst: `${LEGACY_ROOT}/${p.rel} (그대로 둘 파일)` });
    } else ok++;
  }
  const report = { total: filePlan.length, ok, missing, mismatch, leftover };
  await writeFile(path.join(OUT, "verify.json"), JSON.stringify(report, null, 1));
  const line = `[verify] 전체 ${filePlan.length} / 일치 ${ok} / 없음 ${missing.length} / 해시 다름 ${mismatch.length} / 원위치에 남음 ${leftover.length}`;
  console.log(line);
  for (const m of missing.slice(0, 30)) console.log(`  [없음] ${m.rel} -> ${m.dst}`);
  for (const m of mismatch.slice(0, 30)) console.log(`  [해시] ${m.rel} -> ${m.dst}`);
  await summaryLine(`### 대조\n\n${line}\n`);
  if (missing.length || mismatch.length) throw new Error("대조 실패. verify.json 을 본다.");
}

async function cleanup(od) {
  if (process.env.WS_MIGRATE_CONFIRM !== "CLEANUP") throw new Error("WS_MIGRATE_CONFIRM=CLEANUP 이 아니다. 지우지 않는다.");
  // 허가된 삭제는 .obsidian 두 곳뿐이다(2026-11-16 임한솔). 그 밖에는 빈 폴더만 정리한다.
  for (const p of [`${LEGACY_ROOT}/.obsidian`, `${LEGACY_ROOT}/vault/.obsidian`]) {
    const exists = await od.rclone(["lsjson", "--max-depth", "1", `od:${p}`]).then(() => true, () => false);
    if (!exists) continue;
    await od.rclone(["purge", `od:${p}`]);
    console.log(`[cleanup] 삭제: ${p}`);
  }
  await od.rclone(["rmdirs", `od:${LEGACY_ROOT}`, "--leave-root"]);
  console.log(`[cleanup] ${LEGACY_ROOT} 아래 빈 폴더 정리`);
}

const od = await openOneDrive();
try {
  if (step === "inventory") await inventory(od);
  else if (step === "plan") await plan(od);
  else if (step === "move") await move(od);
  else if (step === "cleanup") await cleanup(od);
  else throw new Error(`알 수 없는 단계: ${step ?? "(없음)"}`);
} finally {
  await od.close();
}
