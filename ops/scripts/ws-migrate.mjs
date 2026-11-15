#!/usr/bin/env node
/**
 * OneDrive 루트 워크스페이스 마이그레이션 도구. GitHub Actions(.github/workflows/ws-migrate.yml)에서만 돈다.
 * 토큰은 저장소 시크릿과 Neon 에만 있다(openOneDrive). 매핑표 정본: OneDrive `OneDrive-WS-마이그레이션/이동-매핑표.md`.
 *
 *   inventory : 이동 전 기준 목록. hsol-info-blob 전체(경로, 크기, QuickXorHash)와 OneDrive 루트 최상위 목록을
 *               ws-migrate-out/ 에 쓴다. 같은 실행에서 워크플로가 hsol-info-blob 전체를 받아 백업 아티팩트로 올린다.
 *               OneDrive 에는 아무것도 쓰지 않는다.
 *
 * 필요 환경변수: DATABASE_URL, ONEDRIVE_TOKEN_KEY, ONEDRIVE_DRIVE_ID
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { LEGACY_ROOT } from "../../src/lib/onedrive/ws-layout.mjs";
import { openOneDrive } from "./lib/rclone-onedrive.mjs";

const OUT = process.env.WS_MIGRATE_OUT || "ws-migrate-out";
const step = process.argv[2];

async function lsjson(od, target, extra = []) {
  return JSON.parse(await od.rclone(["lsjson", ...extra, target]));
}

async function inventory(od) {
  const items = await lsjson(od, `od:${LEGACY_ROOT}`, ["-R", "--files-only", "--hash", "--hash-type", "QuickXorHash"]);
  const files = items
    .map((i) => ({
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
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(
      process.env.GITHUB_STEP_SUMMARY,
      `### 이동 전 기준 목록\n\n- 대상: \`${LEGACY_ROOT}\`\n- 파일: ${files.length}개\n- 용량: ${(bytes / 1e6).toFixed(1)}MB\n- 해시 없음: ${noHash}개\n- OneDrive 루트 최상위: ${root.length}개\n`,
      { flag: "a" },
    );
  }
}

const od = await openOneDrive();
try {
  if (step === "inventory") await inventory(od);
  else throw new Error(`알 수 없는 단계: ${step ?? "(없음)"}`);
} finally {
  await od.close();
}
