// node --test src/lib/onedrive/ws-layout.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { candidates, rcloneFilterArgs, toLegacy, toWs, wsSources } from "./ws-layout.mjs";

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
  for (const p of ["사진/a.jpg", "memory/MEMORY.md", "CONTEXT.md", "문서/1. 커리어/x.pdf", "프로젝트/온톨로지-빌더/pilots/x.md"]) assert.equal(toLegacy(p), null, p);
  assert.equal(toLegacy("프로젝트/온톨로지-빌더/온톨로지-빌더.md"), "vault/objects/projects/온톨로지-빌더.md");
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

test("개념 폴더의 원본(비-md)은 사이트 콘텐츠가 아니다. 생성물, 원천, assets 는 예외", () => {
  for (const p of ["조직/RIDI/계약서.pdf", "조직/건국대학교/18_1학기/a.pptx", "산출물/임한솔_이력서.docx", "프로젝트/Tagit/a.html", "인물/x.jpg"])
    assert.equal(toLegacy(p), null, p);
  assert.equal(toLegacy("조직/무하유/무하유.md"), "vault/objects/organizations/무하유/무하유.md");
  assert.equal(toLegacy("프로젝트/hsol-info/생성물/site-data.json"), "vault/object-views/site-data.json");
  assert.equal(toLegacy("원천/블로그/a.json"), "vault/datasources/blog/a.json");
  assert.equal(toLegacy("assets/public/profile/a.jpg"), "assets/public/profile/a.jpg");
});

test("rclone 필터: 개념 폴더 소스는 md 와 예외 위치만, 예외 위치 소스와 파일 소스는 필터 없음", () => {
  assert.deepEqual(rcloneFilterArgs("조직/"), ["--filter", "+ *.md", "--filter", "+ *.MD", "--filter", "- *"]);
  assert.deepEqual(rcloneFilterArgs("프로젝트/"), [
    "--filter", "+ /hsol-info/생성물/**", "--filter", "+ *.md", "--filter", "+ *.MD", "--filter", "- *",
  ]);
  assert.deepEqual(rcloneFilterArgs("원천/블로그/"), []);
  assert.deepEqual(rcloneFilterArgs("assets/"), []);
  assert.deepEqual(rcloneFilterArgs("memory/임한솔-persona.md"), []);
});

test("폴더형 객체는 경로 그대로(깊이 탐색은 사이트 쪽이 한다), 2단계 md 폴더만 사이트 밖", () => {
  assert.equal(toLegacy("조직/RIDI/RIDI.md"), "vault/objects/organizations/RIDI/RIDI.md");
  assert.equal(toLegacy("조직/건국대학교/18_1학기/노트.md"), "vault/objects/organizations/건국대학교/18_1학기/노트.md");
  assert.equal(toLegacy("프로젝트/부캐-SNS/부캐-SNS.md"), "vault/objects/projects/부캐-SNS/부캐-SNS.md");
  assert.equal(toLegacy("프로젝트/스토키-매매봇/stocky-agents/a.md"), null);
  assert.equal(toLegacy("조직/RIDI/면접질문_백업.xlsx"), null);
  assert.equal(toLegacy("조직/AWS.md"), "vault/objects/organizations/AWS.md");
  // 고정 경로로 읽는 예외 프로젝트는 그대로
  assert.equal(toLegacy("프로젝트/hsol-info/hsol-info.md"), "vault/objects/projects/hsol-info.md");
});
