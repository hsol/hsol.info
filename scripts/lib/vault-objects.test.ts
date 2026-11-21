/**
 * vault-objects 자체검증. 실행: `npx tsx scripts/lib/vault-objects.test.ts`.
 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { filterPublicPaths, isPrivateText, listPublicObjectNotes } from "./vault-objects";

assert.equal(isPrivateText("---\ntype: Project\nvisibility: private\n---\n# x"), true);
assert.equal(isPrivateText('---\nvisibility: "Private"\n---\n'), true);
assert.equal(isPrivateText("---\nvisibility: public\n---\n"), false);
assert.equal(isPrivateText("# no frontmatter\nvisibility: private"), false);

async function main(): Promise<void> {
const root = await mkdtemp(path.join(os.tmpdir(), "vault-objects-"));
const v = path.join(root, "vault");
const w = async (rel: string, body = "---\ntype: X\n---\n") => {
  await mkdir(path.dirname(path.join(v, rel)), { recursive: true });
  await writeFile(path.join(v, rel), body);
};
const PRIV = "---\ntype: X\nvisibility: private\n---\n";
try {
  await w("objects/organizations/AWS.md");
  await w("objects/organizations/RIDI/RIDI.md");
  await w("objects/organizations/RIDI/AboutMe.md"); // 문서, 객체 아님
  await w("objects/organizations/무하유/무하유.md", PRIV);
  await w("objects/organizations/무하유/제품/제품.md"); // 비공개 폴더 아래라 빠짐
  await w("objects/organizations/무하유/특허-연구/a.md");
  await w("objects/organizations/flat-private.md", PRIV);
  await w("objects/projects/스토키/스토키.md");
  await w("objects/projects/스토키/sub/sub.md"); // 중첩 개념
  await w("objects/projects/스토키/materials/a.md"); // 문서

  const notes = (await listPublicObjectNotes([path.join(v, "objects/organizations"), path.join(v, "objects/projects")]))
    .map((p) => path.relative(v, p).normalize("NFC"));
  assert.deepEqual(notes, [
    "objects/organizations/AWS.md",
    "objects/organizations/RIDI/RIDI.md",
    "objects/projects/스토키/sub/sub.md",
    "objects/projects/스토키/스토키.md",
  ]);

  const changed = [
    "objects/organizations/무하유/특허-연구/a.md",
    "objects/organizations/flat-private.md",
    "objects/organizations/RIDI/AboutMe.md",
    "objects/people/임한솔.md",
  ].map((r) => path.join(v, r));
  const kept = (await filterPublicPaths(changed, v)).map((p) => path.relative(v, p));
  assert.deepEqual(kept, ["objects/organizations/RIDI/AboutMe.md", "objects/people/임한솔.md"]);
  console.log("vault-objects ok");
} finally {
  await rm(root, { recursive: true, force: true });
}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
