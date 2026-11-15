#!/usr/bin/env node
/**
 * CI 용: 개인 OneDrive 의 vault 를 로컬 `hsol-info-blob/vault` 에 옛 배치(논리 경로) 그대로 받는다.
 * 생성 스크립트들은 로컬 `hsol-info-blob/vault/...` 경로를 읽으므로, OneDrive 가 새 워크스페이스 배치(ws)여도
 * 여기서 논리 경로로 되돌려 놓으면 스크립트를 고칠 필요가 없다.
 *
 *   ONEDRIVE_LAYOUT=legacy (기본): od:hsol-info-blob/vault 를 그대로 복사
 *   ONEDRIVE_LAYOUT=ws: ws-layout 의 소스 폴더들을 스테이징에 받은 뒤 파일마다 toLegacy() 위치로 옮긴다
 *
 * 사이트 생성에 쓰지 않는 datasources, .obsidian, Templates, Attachments, *.base 는 받지 않는다.
 * 필요 환경변수: DATABASE_URL, ONEDRIVE_TOKEN_KEY, ONEDRIVE_DRIVE_ID
 */
import { mkdir, mkdtemp, readdir, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { openOneDrive } from "./lib/rclone-onedrive.mjs";
import { LEGACY_ROOT, layoutMode, toLegacy, wsSources } from "../../src/lib/onedrive/ws-layout.mjs";

const DEST = process.env.LOCAL_VAULT_DIR || "hsol-info-blob/vault";
const COMMON = ["--exclude", ".DS_Store", "--exclude", "*.base", "--transfers", "16", "--checkers", "16"];
const LEGACY_EXCLUDES = ["--exclude", "datasources/**", "--exclude", ".obsidian/**", "--exclude", "Templates/**", "--exclude", "Attachments/**"];

async function walk(dir, base = dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
}

async function exists(p) {
  return stat(p).then(() => true, () => false);
}

const mode = layoutMode("legacy");
const od = await openOneDrive();
try {
  if (mode === "legacy") {
    await od.rclone(["copy", `od:${LEGACY_ROOT}/vault`, DEST, ...LEGACY_EXCLUDES, ...COMMON]);
  } else if (mode === "ws") {
    const staging = await mkdtemp(path.join(os.tmpdir(), "ws-pull-"));
    try {
      let placed = 0;
      let skipped = 0;
      for (const src of wsSources()) {
        const local = path.join(staging, src);
        if (src.endsWith("/")) {
          await od.rclone(["copy", `od:${src.replace(/\/$/, "")}`, local, ...COMMON]);
        } else {
          await od.rclone(["copyto", `od:${src}`, local, ...COMMON]).catch(() => null);
        }
      }
      for (const rel of await walk(staging)) {
        const logical = toLegacy(rel);
        if (!logical || !logical.startsWith("vault/")) {
          skipped++;
          continue;
        }
        const target = path.join(path.dirname(DEST), logical);
        if (await exists(target)) throw new Error(`논리 경로 충돌: ${rel} -> ${logical}`);
        await mkdir(path.dirname(target), { recursive: true });
        await rename(path.join(staging, rel), target);
        placed++;
      }
      console.log(`[pull] ws 배치에서 ${placed}개를 논리 경로로 배치, vault 밖 ${skipped}개 무시`);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  } else {
    throw new Error("pull-vault 는 legacy 또는 ws 중 하나만 받는다(dual 불가).");
  }
} finally {
  await od.close();
}
