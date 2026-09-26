# Ask Hansol OKKY 시딩 파이프라인

Ask Hansol 자문 기능 사용률이 낮아 뉴스레터 재료가 마르는 문제를 막기 위해, OKKY의 실제 판단형 커리어 고민을 주 1회 1건씩 Ask Hansol 자문 API로 접수한다. 접수된 질문은 DB(`ask_hansol_messages`)에 `[임한솔 시각 자문 요청]`으로 저장되고 클론 답변이 생성되어, 자문록 뉴스레터 재료 풀로 유입된다.

## 구성

- `queue.json` — 판단형 질문 큐. 각 항목은 `okkySeed`(OKKY에서 익명 요지화한 원 요지, 프로버넌스+수집 dedup용)와 `issue`(OKKY와 문장이 겹치지 않게 맥락만 살려 재작성한 SEO 안전 접수본)를 함께 가진다. 접수·발행되는 건 항상 `issue`다.
- `ledger.json` — 접수 이력 원장. `config`(API URL·pageContext·리필 임계) + `submitted[]`(fingerprint·sessionId·messageId).
- `submit-daily.mjs` — 실행 1회당 미접수 질문 1건을 골라 API로 접수하고 원장을 갱신한다(파일명은 유지, 실제 주기는 주 1회).

## SEO: 질문 재생성 규칙

OKKY 원문이나 그에 가까운 요약을 그대로 접수하면 발행 콘텐츠가 중복 문서로 취급돼 검색 노출에 손해다. 그래서 접수되는 `issue`는 반드시 재생성본이어야 한다.

- 유지할 것: 배경·제약·수치·목표 등 고민의 맥락(임한솔이 판단할 실질).
- 바꿀 것: 문장 구성, 어순, 표현, 군더더기 디테일. OKKY 텍스트와 겹치는 구절이 남지 않게 전부 다시 쓴다.
- 원 요지는 `okkySeed`에 보존한다(같은 OKKY 글 재수집 방지 + 출처 추적).

## 실행

```bash
node ask-hansol-seeding/submit-daily.mjs
```

마지막 줄 `STATUS=` 로 결과를 신호한다:

- `STATUS=OK remaining=<n>` — 정상 접수, 잔여 미접수 n건.
- `STATUS=OK remaining=<n> REFILL_NEEDED` — 접수했으나 잔여 < 3 → 수집 필요.
- `STATUS=QUEUE_EMPTY REFILL_NEEDED` — 미접수 질문 소진 → 접수 못 함, 즉시 수집 필요.
- `STATUS=FAIL reason=<...>` — API/DB 실패. 질문을 **소비하지 않으므로** 다음 실행에서 자동 재시도.

## 중복 방지

- 접수 dedup: `ledger.json`의 `fingerprint`(issue 공백·기호 제거) 기준. 접수된 질문은 재접수 안 함.
- 수집 dedup: 새 OKKY 글의 `okkySeed` fingerprint가 `queue.json` + `ledger.json` 어디에도 없을 때만 큐에 추가.

## 소진 시 수집(리필) 절차

`REFILL_NEEDED` / `QUEUE_EMPTY` 신호가 나오면 OKKY에서 판단형 고민을 추가 수집한다.

- 소스 보드: `okky.kr/community/salary`(연봉·단가), `/rookie`(취준생), `/life`(사는얘기), `/ai`(AI), `/freelancer`(프리랜서 라운지).
- 채택 기준(자문록 게이트): 판단형이어야 하고(임한솔의 판단·경험이 답의 실질), 단순 사실조회형("N년차 보통 얼마 받나요")은 제외.
- 제외: 홍보/앱출시글, 정신건강(우울·공황) 등 민감·웰빙 주제, 정치·주식, 경력 위조 조장, 타인 민감정보.
- 항목 작성: 익명 요지화한 원 요지를 `okkySeed`에 넣고, 그 맥락을 살려 문장을 전부 새로 쓴 재생성본을 `issue`(30자 이상, 배경·제약·목표 포함)에 넣는다.
- 신규 `okkySeed` fingerprint가 기존 큐·원장과 겹치지 않을 때만 `queue.items`에 append.

## 스케줄

매주 수요일 06:00(KST) 실행. 요금 피크(현지 21:00~03:00)와 한솔님 활동 코어타임을 모두 피해, 사용량 창 충돌·요금을 줄인다. 스케줄 태스크는 이 폴더를 연결 → 다음 접수 대상 `issue`가 재생성본인지 확인/재작성 → `submit-daily.mjs` 실행 → 신호에 따라 필요 시 OKKY 수집 → vault action-log 기록.
