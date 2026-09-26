#!/usr/bin/env node
/**
 * Build With Vault Refresh 가 만든 생성물을 개인 OneDrive `hsol-info-blob/vault/object-views/` 에 쓴다.
 * 사이트는 이 파일들을 OneDrive 에서 바로 읽는다.
 *
 *  - site-data.json, onepager-ko.html, onepager-en.html: 내려받은 직후 해시(generated/pulled-generated.sha1)와
 *    달라진 것만
 *  - onepager-<lang>.pdf (generated/onepager-<lang>.pdf): 같은 언어 HTML 이 바뀌었거나 OneDrive 에 아직 없을 때만.
 *    PDF 는 렌더할 때마다 바이트가 달라져 해시로 비교하지 않는다
 *  - 하나라도 올렸으면 hsol-info-parent-ref.json(어느 커밋, 어느 실행이 만들었는지)
 *
 * 필요 환경변수: DATABASE_URL, ONEDRIVE_TOKEN_KEY, ONEDRIVE_DRIVE_ID
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { openOneDrive } from "./lib/rclone-onedrive.mjs";

const LOCAL_VAULT = process.env.LOCAL_VAULT_DIR || "hsol-info-blob/vault";
const OD_VIEWS = `${process.env.ONEDRIVE_VAULT_ROOT || "hsol-info-blob/vault"}/object-views`;
const TEXT_OUTPUTS = ["object-views/site-data.json", "object-views/onepager-ko.html", "object-views/onepager-en.html"];

const pulled = new Map(
  (existsSync("generated/pulled-generated.sha1") ? readFileSync("generated/pulled-generated.sha1", "utf8") : "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [h, f] = l.split(" ");
      return [f.replace(/^vault\//, ""), h];
    }),
);
const sha1 = (buf) => createHash("sha1").update(buf).digest("hex");

const uploads = [];
const changedText = new Set();
for (const rel of TEXT_OUTPUTS) {
  const p = path.join(LOCAL_VAULT, rel);
  if (!existsSync(p)) continue;
  if (pulled.get(rel) === sha1(readFileSync(p))) continue;
  uploads.push([p, `${OD_VIEWS}/${path.basename(rel)}`]);
  changedText.add(rel);
}
for (const lang of ["ko", "en"]) {
  const pdf = `generated/onepager-${lang}.pdf`;
  if (!existsSync(pdf)) continue;
  const htmlChanged = changedText.has(`object-views/onepager-${lang}.html`);
  const missing = !existsSync(path.join(LOCAL_VAULT, `object-views/onepager-${lang}.pdf`));
  if (htmlChanged || missing) uploads.push([pdf, `${OD_VIEWS}/onepager-${lang}.pdf`]);
}

if (!uploads.length) {
  console.log("No regenerated vault outputs; skip OneDrive upload.");
  process.exit(0);
}

const ref = {
  parentSha: process.env.GITHUB_SHA,
  parentRef: process.env.GITHUB_REF,
  workflowRunId: Number(process.env.GITHUB_RUN_ID) || null,
  recordedAt: new Date().toISOString(),
  changed: uploads.map(([, dest]) => `vault/object-views/${path.basename(dest)}`),
};
const refPath = path.join(os.tmpdir(), "hsol-info-parent-ref.json");
writeFileSync(refPath, JSON.stringify(ref, null, 2));
uploads.push([refPath, `${OD_VIEWS}/hsol-info-parent-ref.json`]);

const od = await openOneDrive();
try {
  for (const [src, dest] of uploads) {
    await od.rclone(["copyto", src, `od:${dest}`]);
    console.log(`uploaded od:${dest}`);
  }
} finally {
  await od.close();
}
