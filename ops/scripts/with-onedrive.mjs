#!/usr/bin/env node
/**
 * rclone 설정(`od:` = 개인 OneDrive)을 만든 채로 명령을 실행하고, 끝나면 갱신된 토큰을 Neon 에 되쓴다.
 *
 *   node ops/scripts/with-onedrive.mjs -- bash -c 'rclone copy od:hsol-info-blob/vault ./vault'
 *
 * 자식 프로세스에는 RCLONE_CONFIG 가 설정돼 있어 rclone 을 그냥 부르면 된다.
 * 필요 환경변수: DATABASE_URL, ONEDRIVE_TOKEN_KEY, ONEDRIVE_DRIVE_ID
 */
import { spawn } from "node:child_process";
import process from "node:process";
import { openOneDrive } from "./lib/rclone-onedrive.mjs";

const sep = process.argv.indexOf("--");
const cmd = sep >= 0 ? process.argv.slice(sep + 1) : process.argv.slice(2);
if (!cmd.length) {
  console.error("사용법: node ops/scripts/with-onedrive.mjs -- <명령> [인자...]");
  process.exit(2);
}

const od = await openOneDrive();
let code = 1;
try {
  code = await new Promise((resolve) => {
    const child = spawn(cmd[0], cmd.slice(1), {
      stdio: "inherit",
      env: { ...process.env, RCLONE_CONFIG: od.conf },
    });
    child.on("close", (c) => resolve(c ?? 1));
    child.on("error", (e) => {
      console.error(e.message);
      resolve(1);
    });
  });
} finally {
  await od.close();
}
process.exit(code);
