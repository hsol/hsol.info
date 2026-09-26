#!/usr/bin/env node
/**
 * Ask Hansol OKKY 시딩 - 하루 1건 접수기.
 *
 * queue.json 의 미접수 질문 하나를 골라 hsol.info 자문 API 로 접수한다.
 * 접수 성공 = DB(ask_hansol_messages)에 [임한솔 시각 자문 요청]으로 저장 + 클론 답변 생성
 *          → 뉴스레터 재료 풀에 유입. 세션은 질문마다 새 UUID(서로 다른 방문자처럼).
 *
 * dedup: ledger.json 의 fingerprint(issue 공백·기호 제거) 기준. 이미 접수된 것은 소비하지 않는다.
 *
 * 종료 코드/신호(마지막 줄에 STATUS= 로 출력):
 *   STATUS=OK remaining=<n>        정상 접수, 잔여 미접수 <n>
 *   STATUS=OK remaining=<n> REFILL_NEEDED   접수했으나 잔여 < threshold → 수집 필요
 *   STATUS=QUEUE_EMPTY REFILL_NEEDED         미접수 질문이 없음 → 즉시 수집 필요(접수 못 함)
 *   STATUS=FAIL reason=<...>                 API/DB 실패 → 소비하지 않음(다음 실행에서 재시도)
 */
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const QUEUE_PATH = join(HERE, "queue.json");
const LEDGER_PATH = join(HERE, "ledger.json");

const FALLBACK_MARKER = "답변을 못 가져왔어요"; // ASK_HANSOL_FALLBACK_MESSAGE 특징 문구
const TOO_SHORT_MARKER = "조금만 더 적어주시면"; // issue<30자 시 반환되는 안내

function fingerprint(text) {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const queue = await readJson(QUEUE_PATH);
  const ledger = await readJson(LEDGER_PATH);
  const cfg = ledger.config || {};
  const apiUrl = cfg.apiUrl || "https://hsol.info/api/ask-hansol-advice";
  const pageContext = cfg.pageContext || { view: "home" };
  const threshold = Number(cfg.refillThreshold ?? 3);

  const submittedFp = new Set((ledger.submitted || []).map((s) => s.fingerprint));

  const isUnused = (it) => it && it.issue && !submittedFp.has(fingerprint(it.issue));
  const unused = queue.items.filter(isUnused);

  if (unused.length === 0) {
    console.log("STATUS=QUEUE_EMPTY REFILL_NEEDED");
    process.exit(2);
  }

  const pick = unused[0];
  const sessionId = randomUUID();

  let resp, data;
  try {
    resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ issue: pick.issue, sessionId, pageContext }),
    });
    data = await resp.json();
  } catch (e) {
    console.log(`STATUS=FAIL reason=network:${String(e).slice(0, 120)}`);
    process.exit(1);
  }

  const answer = typeof data?.answer === "string" ? data.answer : "";
  const messageId = data?.messageId ?? null;

  // 실패 판정: HTTP 오류 / 폴백 답변 / too-short / DB 미영속(messageId null) → 소비하지 않음
  if (!resp.ok) {
    console.log(`STATUS=FAIL reason=http_${resp.status}`);
    process.exit(1);
  }
  if (!answer || answer.includes(FALLBACK_MARKER) || answer.includes(TOO_SHORT_MARKER)) {
    console.log("STATUS=FAIL reason=llm_or_validation");
    process.exit(1);
  }
  if (!messageId) {
    console.log("STATUS=FAIL reason=db_not_persisted(messageId_null)");
    process.exit(1);
  }

  // 성공 → ledger append + queue 항목 표시
  const now = new Date().toISOString();
  ledger.submitted.push({
    queueId: pick.id,
    fingerprint: fingerprint(pick.issue),
    sessionId,
    messageId,
    submittedAt: now,
    category: pick.category || null,
    source: pick.source || null,
    issueExcerpt: pick.issue.slice(0, 60),
  });
  const qi = queue.items.find((it) => it.id === pick.id);
  if (qi) {
    qi.submitted = true;
    qi.submittedAt = now;
  }

  await writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2) + "\n", "utf8");
  await writeFile(QUEUE_PATH, JSON.stringify(queue, null, 2) + "\n", "utf8");

  const remainingAfter = queue.items.filter(
    (it) => it && it.issue && !new Set([...submittedFp, fingerprint(pick.issue)]).has(fingerprint(it.issue)),
  ).length;

  const answerPreview = answer.replace(/\s+/g, " ").slice(0, 80);
  console.log(`SUBMITTED id=${pick.id} session=${sessionId} messageId=${messageId}`);
  console.log(`ANSWER_PREVIEW=${answerPreview}`);
  console.log(
    `STATUS=OK remaining=${remainingAfter}` + (remainingAfter < threshold ? " REFILL_NEEDED" : ""),
  );
  process.exit(0);
}

main().catch((e) => {
  console.log(`STATUS=FAIL reason=exception:${String(e).slice(0, 160)}`);
  process.exit(1);
});
