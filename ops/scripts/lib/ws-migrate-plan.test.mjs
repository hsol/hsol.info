// node --test ops/scripts/lib/ws-migrate-plan.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { buildOps, planDestination } from "./ws-migrate-plan.mjs";

test("매핑표의 대표 행", () => {
  const cases = {
    "vault/objects/people/임한솔.md": "인물/임한솔.md",
    "vault/objects/concepts/Python.md": "스킬/기술/Python.md",
    "vault/objects/concepts/임한솔-persona.md": "memory/임한솔-persona.md",
    "vault/objects/projects/hsol-info.md": "프로젝트/hsol-info/hsol-info.md",
    "vault/object-views/site-data.json": "프로젝트/hsol-info/생성물/site-data.json",
    "vault/action-log/2026/2026-11-16.md": "action-log/2026-11-16.md",
    "vault/_ontology/object-types/Person.md": "_context-protocol/_schema/vault-ontology/object-types/Person.md",
    "assets/public/a.png": "assets/public/a.png",
    "drafts/images/x.png": "원고/images/x.png",
    "AI-Native-큐시트-종훈님편-2026-07-28.md": "프로젝트/AI-Native-취재노트/AI-Native-큐시트-종훈님편-2026-07-28.md",
    "CLAUDE.md": "_context-protocol/_deprecated_vault/hsol-info-blob-CLAUDE.md",
  };
  for (const [src, dst] of Object.entries(cases)) assert.deepEqual(planDestination(src), { kind: "move", dst }, src);
  assert.equal(planDestination("okky-marketing-playbook-generic_2026-07-12.md").kind, "stay");
  assert.equal(planDestination(".obsidian/app.json").kind, "delete");
  assert.equal(planDestination(".newsroom-watch/round-20261113.md").kind, "newsroom");
  assert.equal(planDestination("vault/objects/concepts/새개념.md"), null);
});

test("폴더가 통째로 같은 곳으로 가면 폴더 연산 하나, 목적지가 있으면 파일 단위", () => {
  const f = (rel) => ({ raw: rel, rel });
  const files = [f("vault/objects/people/a.md"), f("vault/objects/people/b.md"), f("vault/objects/news-articles/n.md"), f("vault/objects/concepts/뉴스룸-기자.md")];
  const { ops, problems } = buildOps(files, new Set());
  assert.deepEqual(problems, []);
  assert.ok(ops.some((o) => o.type === "dir" && o.dst === "인물" && o.files === 2));
  // 뉴스룸/ 에는 개념 노트도 들어오므로 기사 폴더는 파일 단위
  assert.ok(ops.some((o) => o.type === "file" && o.dst === "뉴스룸/n.md"));
  const blocked = buildOps(files, new Set(["인물", "인물/a.md"]));
  assert.ok(blocked.problems.some((p) => p.includes("이미 있음")));
});
