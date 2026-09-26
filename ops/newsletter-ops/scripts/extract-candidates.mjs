#!/usr/bin/env node
/**
 * Ask Hansol 자문록 — 후보 추출·프리필터
 *
 * ask_hansol_messages(Neon)에서 자문 Q/A를 페어링하고, 기계적으로 판정 가능한
 * 게이트(G1 실제 자문 여부·테스트더미 / G2 클론 답변거부)와 발행 이력(원장)만
 * 1차로 거른 뒤, 최종 게이트(G3 타인 민감정보 / G4 판단형 여부)와 스코어(P1~P4)는
 * LLM(스케줄드 태스크 에이전트 턴)이 채점하도록 후보 JSON을 내보낸다.
 *
 * 위치: newsletter-ops/scripts/ (hsol.info·hsol-info-blob 두 리포 밖)
 * 사용: DATABASE_URL=... node newsletter-ops/scripts/extract-candidates.mjs
 *   (또는 HSOL_APP_REPO=<앱 리포 경로> 로 .env.local 에서 자동 로드)
 * 출력: OS 임시경로의 ask-hansol-candidates.json (경로는 stdout 마지막 줄)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPS_ROOT = join(__dirname, ".."); // newsletter-ops/
const LEDGER_PATH = join(OPS_ROOT, "published-ledger.json"); // 발행 이력 원장(ops 폴더)
// 후보 JSON은 전송용 중간 산출물 — 리포/ops 밖 OS 임시경로(샌드박스)에 쓴다.
const OUT_PATH = join(tmpdir(), "ask-hansol-candidates.json");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  // 폴백: HSOL_APP_REPO 가 가리키는 앱 리포의 .env.local 에서 로드(DB 시크릿 단일 소스 유지)
  const appRepo = process.env.HSOL_APP_REPO;
  if (appRepo) {
    try {
      const env = readFileSync(join(appRepo, ".env.local"), "utf8");
      const m =
        env.match(/^DATABASE_URL=(.*)$/m) || env.match(/^POSTGRES_URL=(.*)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {}
  }
  throw new Error(
    "DATABASE_URL 없음: 환경변수 DATABASE_URL, 또는 HSOL_APP_REPO(.env.local 경로) 필요",
  );
}

const fingerprint = (s) =>
  (s || "").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");

// Postgres timestamptz 문자열("2026-06-22 03:27:06.3+00") → epoch ms
const toEpoch = (ts) => {
  if (!ts) return NaN;
  let s = ts.trim().replace(" ", "T");
  if (/\+00$/.test(s)) s = s.replace(/\+00$/, "Z");
  else if (/[+-]\d{2}$/.test(s)) s = s + ":00";
  return Date.parse(s);
};

// 자문 요청 태그 (자문록 재료 풀 식별자)
const ADVICE_TAG = "자문 요청";
// G1: 테스트더미 신호
const TEST_SIGNALS = ["테스트용", "제출 테스트", "이십자 이상", "테스트 문장"];
// G2: 클론 답변거부(정치·종교 등 회피) 신호
const REFUSAL_SIGNALS = [
  "답할 수 있는 범위 밖",
  "의견을 내지 않습니다",
  "입장 표명",
  "답변드리기 어렵",
];

function main() {
  const sql = neon(loadDatabaseUrl());
  const ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const publishedFps = new Set(ledger.published.map((p) => p.fingerprint));
  const grandfatheredIds = new Set((ledger.grandfathered ?? []).map((g) => g.id));
  const watermarkEpoch = toEpoch(ledger.policy?.watermark);

  return sql`
    SELECT id::int AS id, session_id, role, content, created_at::text AS created_at
    FROM ask_hansol_messages ORDER BY session_id, id
  `.then((rows) => {
    const bySess = {};
    for (const r of rows) (bySess[r.session_id] ??= []).push(r);

    const candidates = [];
    for (const sid of Object.keys(bySess)) {
      const arr = bySess[sid];
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].role !== "user") continue;
        const q = arr[i].content;
        if (!q.includes(ADVICE_TAG)) continue; // 자문 풀만
        const a = arr.slice(i + 1).find((x) => x.role === "assistant");
        const answer = a?.content ?? "";

        const questionClean = q
          .replace(new RegExp(`\\[?임한솔 시각 ${ADVICE_TAG}\\]?`), "")
          .trim();
        const fp = fingerprint(questionClean); // 태그 제거 후 지문 (원장과 정합)
        const isPublished = publishedFps.has(fp);
        const g1_testDummy = TEST_SIGNALS.some((s) => q.includes(s));
        const g2_refusal =
          REFUSAL_SIGNALS.some((s) => answer.includes(s)) ||
          answer.length < 300; // 실질 답변 최소 길이 프록시

        // forward-only 워터마크: grandfathered 예외이거나 watermark 이후 것만 적격
        const isGrandfathered = grandfatheredIds.has(arr[i].id);
        const isAfterWatermark =
          !Number.isNaN(watermarkEpoch) &&
          toEpoch(arr[i].created_at) > watermarkEpoch;
        const passesWatermark = isGrandfathered || isAfterWatermark;

        const prefilter =
          isPublished ? "published"
          : g1_testDummy ? "reject_g1_testdummy"
          : g2_refusal ? "reject_g2_refusal"
          : !passesWatermark ? "reject_watermark"
          : "pass_to_llm";

        candidates.push({
          id: arr[i].id,
          session: sid.slice(0, 8),
          date: arr[i].created_at.slice(0, 10),
          createdAt: arr[i].created_at,
          question: questionClean,
          answer,
          answerLen: answer.length,
          prefilter,
          grandfathered: isGrandfathered,
          // LLM 이 채울 항목 (기계 판정 불가):
          gates: { g3_thirdPartyPII: null, g4_judgmentType: null },
          scores: { p1_resonance: null, p2_saveValue: null, p3_perspective: null, p4_headline: null },
          total: null,
        });
      }
    }

    const passToLlm = candidates.filter((c) => c.prefilter === "pass_to_llm");
    writeFileSync(
      OUT_PATH,
      JSON.stringify({ generatedAt: new Date().toISOString(), policy: {
        onePerRun: true,
        note: "적격 후보 중 LLM 최고점 1건만 발행. 나머지는 세이브 원고(큐). 발행 후 watermark 전진 + grandfathered 제거.",
        watermark: ledger.policy?.watermark ?? null,
      }, counts: {
        total: candidates.length,
        pass_to_llm: passToLlm.length,
        published: candidates.filter((c) => c.prefilter === "published").length,
        reject_watermark: candidates.filter((c) => c.prefilter === "reject_watermark").length,
        rejected: candidates.filter((c) => c.prefilter.startsWith("reject")).length,
      }, candidates }, null, 2),
    );

    console.log(`자문 후보 ${candidates.length}건 → 적격(LLM 채점 대상) ${passToLlm.length}건 · 한 번에 1건만 발행(나머지 세이브 원고)`);
    for (const c of candidates) {
      const flag = c.prefilter === "pass_to_llm" ? (c.grandfathered ? "[pass·예외]" : "[pass]") : "[" + c.prefilter + "]";
      console.log(`  [${c.id}] ${c.createdAt.slice(0, 19)} aLen=${c.answerLen} ${flag}  ${c.question.replace(/\s+/g, " ").slice(0, 52)}`);
    }
    console.log(`\nwatermark: ${ledger.policy?.watermark}`);
    console.log(`candidates json → ${OUT_PATH}`); // 마지막 줄 = 후보 JSON 경로(리포 밖 tmp)
  });
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
