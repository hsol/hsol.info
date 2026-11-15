// node --test src/lib/onedrive/ws-layout.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { candidates, toLegacy, toWs, wsSources } from "./ws-layout.mjs";

test("사이트 런타임이 읽는 논리 경로가 ws 로 풀리고 되돌아온다", () => {
  const cases = {
    "vault/object-views/site-data.json": "프로젝트/hsol-info/생성물/site-data.json",
    "vault/object-views/onepager-ko.pdf": "프로젝트/hsol-info/생성물/onepager-ko.pdf",
    "vault/README.md": "_context-protocol/_deprecated_vault/README.md",
    "vault/objects/people/임한솔.md": "인물/임한솔.md",
    "vault/objects/concepts/임한솔-persona.md": "memory/임한솔-persona.md",
    "vault/objects/news-articles/a.md": "뉴스룸/a.md",
    "vault/objects/projects/hsol-info.md": "프로젝트/hsol-info/hsol-info.md",
    "vault/action-log/2026/2026-11-16.md": "action-log/2026-11-16.md",
    "vault/datasources/medium/x.md": "원천/미디엄/x.md",
    "assets/public/profile/a.jpg": "assets/public/profile/a.jpg",
  };
  for (const [l, w] of Object.entries(cases)) {
    assert.equal(toWs(l), w, l);
    assert.equal(toLegacy(w), l, w);
  }
});

test("쪼개진 concepts 는 논리 경로로만 되돌아온다", () => {
  assert.equal(toWs("vault/objects/concepts/Python.md"), null);
  assert.equal(toLegacy("스킬/기술/Python.md"), "vault/objects/concepts/Python.md");
  assert.equal(toLegacy("뉴스룸/뉴스룸-기자.md"), "vault/objects/concepts/뉴스룸-기자.md");
});

test("vault 와 무관한 ws 경로는 null", () => {
  for (const p of ["사진/a.jpg", "memory/MEMORY.md", "CONTEXT.md", "문서/1. 커리어/x.pdf"]) assert.equal(toLegacy(p), null, p);
});

test("후보 순서: dual 은 ws 먼저, legacy 폴백", () => {
  assert.deepEqual(candidates("vault/objects/people/임한솔.md", "dual"), ["인물/임한솔.md", "hsol-info-blob/vault/objects/people/임한솔.md"]);
  assert.deepEqual(candidates("vault/objects/concepts/Python.md", "dual"), ["hsol-info-blob/vault/objects/concepts/Python.md"]);
  assert.deepEqual(candidates("assets/x", "legacy"), ["hsol-info-blob/assets/x"]);
});

test("소스 목록에 사진/, 음악/ 같은 개인 폴더가 없고 하위 소스는 접힌다", () => {
  const s = wsSources();
  assert.ok(s.includes("프로젝트/"));
  assert.ok(!s.includes("프로젝트/hsol-info/생성물/"));
  assert.ok(!s.some((x) => x.startsWith("사진") || x.startsWith("원천")));
});
