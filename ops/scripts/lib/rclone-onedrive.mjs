/**
 * CI 에서 rclone 으로 개인 OneDrive 를 여는 헬퍼. 토큰은 Neon(onedrive-token.mjs)에서 읽고,
 * rclone 이 갱신한 최신 토큰을 닫을 때 되쓴다. 원격 이름은 `od:` 이고 루트는 OneDrive 최상위다.
 *
 * 필요 환경변수: DATABASE_URL, ONEDRIVE_TOKEN_KEY, ONEDRIVE_DRIVE_ID
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ensureTables, getSql, keyFrom, loadToken, saveToken } from "./onedrive-token.mjs";

const execFileAsync = promisify(execFile);

export async function openOneDrive() {
  const driveId = process.env.ONEDRIVE_DRIVE_ID?.trim();
  if (!driveId) throw new Error("ONEDRIVE_DRIVE_ID 가 없다.");
  const key = keyFrom(process.env.ONEDRIVE_TOKEN_KEY);
  const sql = getSql();
  await ensureTables(sql);
  const tokenBefore = await loadToken(sql, key);

  const dir = await mkdtemp(path.join(os.tmpdir(), "od-"));
  const conf = path.join(dir, "rclone.conf");
  await writeFile(conf, `[od]\ntype = onedrive\ndrive_type = personal\ndrive_id = ${driveId}\ntoken = ${tokenBefore}\n`, {
    mode: 0o600,
  });

  async function rclone(args, opts = {}) {
    const { stdout } = await execFileAsync("rclone", ["--config", conf, ...args], {
      maxBuffer: 256 * 1024 * 1024,
      ...opts,
    });
    return stdout;
  }

  async function close() {
    try {
      const text = await readFile(conf, "utf8").catch(() => "");
      const line = text.split("\n").find((l) => l.startsWith("token = "));
      const latest = line ? line.slice("token = ".length).trim() : null;
      if (latest && latest !== tokenBefore) {
        await saveToken(sql, key, latest);
        console.log("OneDrive 토큰 갱신분을 Neon 에 저장");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  return { conf, sql, rclone, close };
}
