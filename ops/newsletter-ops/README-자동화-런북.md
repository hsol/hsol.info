---
type: Project
slug: Ask-Hansol-자문록-자동화-런북
name: Ask Hansol 자문록 — 완전 무인 발행 파이프라인 런북
status: building
startDate: 2026-07-04
role: 설계자
outcome: Cowork 스케줄드 태스크가 주기적으로 자문 후보를 채점·조립·발행하는 완전 무인 파이프라인. 안전 게이트 실패 시 Slack DM 에스컬레이션.
tags: [automation, newsletter, ai-clone, runbook, scheduled-task]
links:
  partOf: "[[Ask-Hansol-자문록]]"
  ownedBy: "[[임한솔]]"
  uses: "[[ask-hansol-db]]"
---

# Ask Hansol 자문록 — 완전 무인 발행 파이프라인 런북

발행인([[임한솔]]) 결정: **완전 무인 · Cowork 스케줄드 태스크 · Chrome 발행(뉴스레터 형태 유지) · 통지 Proofer AI 봇 Slack DM(채널 `D0B8J339HBK`)**. 무인이되 사고 방지를 위해 **안전 게이트 실패 시 발행 중단 + Slack DM 에스컬레이션**. (아침 리추얼과 동일 채널·봇.)

## 파이프라인 ①~⑦

1. **재료 수집·신규 감지** — 앱 리포 `scripts/ask-hansol-newsletter/extract-candidates.mjs` 실행. `ask_hansol_messages`(Neon, [[ask-hansol-db]])에서 자문(`[임한솔 시각 자문 요청]`) Q/A 페어링. 기계 프리필터: 발행 이력 원장(`published-ledger.json`) 제외 · G1 테스트더미 · G2 답변거부/과단(<300자) · forward-only 워터마크. **출력 후보 JSON은 리포가 아니라 OS 임시경로**(`os.tmpdir()/ask-hansol-candidates.json`)에 쓰고 마지막 줄에 경로를 출력 — 그 경로를 읽는다.
2. **주제 선정(LLM 채점)** — 스크립트가 이미 발행 이력·G1·G2·워터마크로 거른 pass_to_llm 후보에 최종 게이트·스코어 적용([[Ask-Hansol-자문록]] 주제 선정 기준):
   - G3 타인 민감정보(익명화 불가) → 탈락 · G4 사실조회형(의료·법률·행정 등 지식in 대체가능) → 탈락
   - 통과분 P1(공감 ×2)·P2(저장가치)·P3(관점 밀도)·P4(헤드라인화) 채점 → **최고점 딱 1건만 선정**(발행 정책 참조). 동점 시 타이브레이커(최근 3호 카테고리 회피 → 시의성).
   - **적격 0건이면 발행 중단 → Slack DM 통지("이번 주기 발행 가능 자문 없음")**.
3. **본문 조립** — 질문·클론 답변의 **문장·단어는 DB 원문 그대로**(생성·윤색 금지). 단 답변에 **하우스 스타일 프레젠테이션**을 입힌다(1호 기준): DB 답변의 `**섹션 라벨**` → 이모지 헤더(🤔 저라면 이렇게 접근해요 / 🙄 먼저 확인해볼 것 / 🤗 그래서, 저라면), `- ` 항목 → 리스트. 첫 헤더 앞 문장은 리드 문단. 제목 `#{호수} {질문 전문}`(2026-07-04 확정, 1호와 일치. 질문 원문 그대로, "Ask Hansol -" 중복 금지). 하단 고정 안내(짧은 버전).
4. **Editor's Cut 생성** — 발행인 리뷰 한 문단. 규약: 평론가 태도만(단정→강점→담백한 총평), 영화 어휘 금지, 약점 배제, 존댓말, em dash 대신 하이픈, 줄바꿈 3~4덩어리. **추가 규약(2026-07-04)**: ① 사실 충실 — 원문 답변에 실제 있는 내용만 인용·평가, 없는 수치·사실·목표 창작 금지(필수). ② 매 호 다른 마무리 — 고정 마무리 문장 금지("과장 없이 실행 가능합니다" 재사용 X), 답변에 맞는 다른 문장으로 닫음(기존 "확정 문구 유지" 폐기). ③ 요약 아닌 리뷰 — 답변 재진술 대신 발행인 시각 한 겹(왜 좋은지·핵심·독자 테이크어웨이), 정형 도입("이 답변이 좋은 건…") 반복 금지. 생성 후 `humanize-korean` → `astory-blog-writers:anti-ai-validator` 통과 실패 시 재작성 사이클(최대 2회).
5. **커버 PNG** — `scripts/ask-hansol-newsletter/render-cover.mjs` 실행. 토큰화 템플릿 `assets/newsletter/cover-template.svg`(1200×628) 3슬롯 치환: ISSUE 번호 · 카테고리 태그 · 헤드라인 2줄(`**강조**`=시안 #00d9ff). `@resvg/resvg-js` + Noto Sans CJK KR 렌더. 카테고리 pill 폭 자동 계산. **검증 완료(2026-07-04)**.
   - **저장 정책(본인 지시 2026-07-04)**: 렌더 커버는 **리포 밖 OS 임시경로(샌드박스)로만** 출력(`render-cover.mjs` 기본값 = `os.tmpdir()`). 업로드 전용, 저장·커밋 안 함. `assets/newsletter/.gitignore`가 커버 PNG(`*-cover-*.png`) 커밋을 차단. 리포에 남는 소스 자산은 템플릿 SVG·로고뿐.

**리포 무흔적 원칙(본인 지시 2026-07-04, 전 단계 적용)**: 파이프라인은 앱/blob 리포에 **어떤 전송·중간 산출물도 남기지 않는다**. candidates JSON·커버 PNG·초안 모두 `os.tmpdir()`(샌드박스)에만. draft-only 실행은 published-ledger·vault도 미변경. gitignore 이중 가드: `assets/newsletter/.gitignore`(커버), `scripts/ask-hansol-newsletter/.gitignore`(candidates.json). 스케줄 태스크 절대 규칙 2에 "리포에 파일 생성·수정 금지" 명시.
6. **발행(Chrome)** — LinkedIn 뉴스레터 에디터에 제목·커버·본문 주입 후 게시. **발행 전 상태 점검**: LinkedIn 로그인 유효 · 확장 연결 · 에디터 로드. 하나라도 실패 시 게시 중단.
7. **기록·통지** — 성공 시 `published-ledger.json` append + [[Ask-Hansol-자문록]] 타임라인·[[ask-hansol-db]] 인벤토리 갱신 + action-log 기록. Proofer AI 봇 Slack DM(`D0B8J339HBK`)으로 결과 통지(성공: 발행 링크 / 실패: 완성 직전 패키지 + 사유). 발신은 아침 리추얼과 동일하게 `mcp__slack-bot__slack_post_message`.

## 발행 정책 (한 번에 하나 · forward-only)

발행인 결정(2026-07-04). 원장 `published-ledger.json`의 `policy`·`grandfathered`가 정본.

- **한 번에 하나(세이브 원고)** — 적격 후보가 여럿이어도 매 실행 **딱 1건만 발행**. 나머지 적격분은 큐(세이브 원고)로 보관해 다음 회차로 이월. 한 호에 질문 하나 원칙과 동일.
- **forward-only 워터마크** — 적격 = pass_to_llm AND (`id` ∈ grandfathered **OR** `created_at` > watermark). 즉 **마지막 발행분보다 과거 시각의 새 질문은 무시**. watermark = 발행된 질문 중 최신 `created_at`(현재 1호 `2026-06-22 03:50:38`). 발행 시 `watermark = max(watermark, 발행질문.created_at)`로만 전진(과거 grandfathered 발행이 낮추지 않음).
- **백로그 예외(grandfathered)** — 1호가 배치 중간에서 점수로 선정돼, 발행가능 4건(#101 PM채용·#103 코드리뷰·#107 창업·#109 팀확장)이 전부 1호보다 이른 시각. 이들을 워터마크 소급 적용에서 **1회 예외 처리**(본인 지시 2026-07-04)해 적격 유지. 발행되면 grandfathered에서 제거. 이 4건 소진 후에는 워터마크만 지배.
- 현재 상태: 적격 5건(grandfathered 4 + #117 채무) → #117은 LLM G3 탈락 → **발행가능 4건**. 발행 순서(점수·타이브레이커): 2호 #107 창업 → 3호 #101 PM → 4호 #103 코드리뷰 → 5호 #109 팀확장.

## 자가검증 게이트 10종 (2026-07-20 신설 · 완전 무인의 안전판)

발행 직전 아래 10개를 **기계 판정**으로 전부 통과해야만 게시한다. 하나라도 실패하면 게시 버튼을 누르지 않고 임시저장 상태를 유지 + Multica `in_review` + Slack `[보류]` DM. published-ledger·vault 는 건드리지 않는다.

| # | 게이트 | 판정 |
|---|---|---|
| 1 | 제목 | 비어있지 않음 · ≤150자 · `#{호수} ` 시작 · 문장 중간 절단 흔적 없음(150자 꽉 찼는데 말줄임 없으면 실패) |
| 2 | 커버 | 에디터에 커버 이미지 존재 · 렌더 PNG > 50KB |
| 2b | 커버 캡션 | 캡션이 **비어있지 않고** 값이 **제목과 문자단위 동일**. 비면 실패 (2026-07-20 신설 — 캡션은 이미지 대체 텍스트라 필수) |
| 3 | 본문 구조 | H3 ≥4 · **H2 0개**(섹션 헤더 H2 금지) · UL ≥2 · HR 2 · 마지막 블록이 하단 고정 안내 |
| 4 | 답변 원문 일치 | DB 답변에서 섹션 라벨·불릿기호·CTA 제거한 블록들이 에디터 블록과 **문자 단위 완전 일치** |
| 5 | CTA 제거 | 본문에 `calendly`·`커피챗` 0건 |
| 6 | Editor's Cut 존재·품질 | H3 존재 · 문단 3~5개 · humanize-korean + anti-ai-validator 통과 |
| 7 | Editor's Cut 사실 충실 | EC에 등장하는 **모든 숫자가 답변 원문에도 존재**(창작 방지) |
| 8 | 본문 질문 표기(무조건) | 첫 블록이 `Q. ` 시작 · `<em>`가 블록 전체를 감쌈 · 텍스트가 **DB 질문 원문을 아래 인라인 렌더 규칙으로 기계 변환한 결과와 문자단위 일치**. 제목 생략 여부와 무관하게 **모든 호에 항상** 검사(2026-07-20 조건부 → 무조건. 2026-07-27 인라인 렌더 규칙 반영) |
| 9 | 중복 발행 방지 | 선정 질문 id·fingerprint 가 원장 `published[]` 에 없을 것 |
| 10 | 발행 주체 | 게시 다이얼로그 대상이 뉴스레터 "Ask Hansol - 임한솔 AI 클론 자문록" 일 것(개인 피드 단독 게시 방지) |

**GATE-8 인라인 렌더 규칙 (2026-07-27 신설, 발행인 결정)**: LinkedIn 아티클 에디터(ProseMirror) 스키마에 **`hard_break` 노드가 없다** — 노드 목록은 paragraph·bulletList·listItem·codeBlock·blockquote·heading·horizontalRule 등뿐이라 shift+Enter가 무시되고 텍스트가 이어붙는다. 줄바꿈을 담은 단일 문단이 에디터 차원에서 불가능하므로, 질문 원문이 불릿·빈 줄을 포함한 다중 블록이면 아래 규칙으로 한 문단에 담고 판정도 이 변환 결과를 기대값으로 쓴다.

```js
let n = 0;
const rendered = RAW.split('\n')
  .filter(l => l.trim() !== '')
  .map(l => l.startsWith('- ') ? `${++n}. ${l.slice(2)}` : l)
  .join(' ');
// 기대값: 첫 블록 textContent === 'Q. ' + rendered
```

- `- 내용` → `1. 내용 2. 내용` 인라인 번호 · 줄바꿈/빈 줄 → 공백 한 칸 · **단어·문장·문장부호는 원문 그대로**.
- 원문에 없는 문자를 추가하지 않는다. 5호 조립 중 목록 끝과 다음 문장 사이에 마침표를 넣었다가 diff에서 잡아 제거했다. 읽기 편의보다 원문 보존이 우선이다.
- 보조 검증(권장): 공백·번호·하이픈을 제거한 문자열을 원문과 비교해 **단어 누락·변형 없음**을 함께 확인한다(5호 `wordSafe` 체크).
- 첫 적용 5호(#143). 게이트 실패로 1회 보류한 뒤 발행인 지시로 규약화했다.

**게이트 역검증(2026-07-20)**: 4호(#101) 실제 데이터로 시뮬레이션 — GATE-4 기대 블록 8개가 발행본과 일치(PASS), GATE-7 EC 숫자 `1·2·10` 전부 답변 원문에 존재(PASS), GATE-9 는 #101 재선정 시 정상 차단·#143 선정 시 정상 통과, 워터마크 max() 로직이 소급 발행에서 전진하지 않음 확인. 정상 케이스를 잘못 막지 않으면서 중복은 잡는다.

**사후 검증**: 게시 성공 후 발행된 Pulse 페이지를 다시 읽어 GATE-3·4·5·8 재확인. 여기서 실패하면 이미 공개된 상태이므로 Slack `[긴급]` 으로 사람 개입 요청(자동 삭제·수정 시도 금지).

## 안전 게이트 (무인 사고 방지)

- **에스컬레이션 조건**: 발행 가능 후보 0건 · G3/G4 판정 애매 · Editor's Cut humanize 2회 실패 · Chrome 상태 점검 실패 · 발행 예외.
- **에스컬레이션 동작**: 발행하지 않고 Proofer AI 봇 Slack DM(`D0B8J339HBK`)으로 완성 직전 패키지(제목·본문·Editor's Cut·커버)와 중단 사유 전송. 사람이 검토 후 수동 발행.
- **원칙**: 무인이되 "확신 없으면 발행하지 않는다". 침묵 실패 금지 — 모든 경로는 Slack DM으로 결과를 남긴다.

## 전제조건 체크리스트 (무인 활성화 전 GREEN 필수)

- [x] **DB 접근** — 스케줄드 태스크 실행 컨텍스트에서 앱 리포(`.env.local` DATABASE_URL) 접근 가능. **2026-07-20 draft-only 첫 실행으로 실측 성공**(자문 16건 조회, pass_to_llm 9건).
- [x] **커버 자산** — 커버 자산 6종을 `hsol.info/assets/newsletter/` 로 이관 완료. 토큰화 템플릿 `cover-template.svg` 신설. (2026-07-04)
- [x] **SVG 렌더러** — `@resvg/resvg-js` + Noto Sans CJK KR. `render-cover.mjs` 로 3슬롯 치환 렌더 검증 완료(1200×628, 한글 글리프·강조어 시안 정상). (2026-07-04)
- [x] **통지·에스컬레이션 발신** — Proofer AI 봇 Slack DM(`D0B8J339HBK`, `mcp__slack-bot__slack_post_message`). 아침 리추얼과 동일 경로, 테스트 DM 발송 검증 완료(ts 1783093579.732129, 2026-07-04). *이메일에서 변경.*
- [ ] **Chrome 세션** — 발행 시각에 LinkedIn 로그인 + 확장 연결 유지 방안(세션 만료·2FA 대응).
- [ ] **LinkedIn 앱/토큰** — (아티클 폴백 채택 시에만) 개발자 앱 + OAuth 토큰 60일 갱신.

*폰트 하드닝(선택): 런타임 폰트 불확실 대비 Noto Sans CJK KR·Mono 를 `assets/newsletter/fonts/` 에 번들하면 렌더러가 자동 사용(현재 시스템 폰트로 동작).*

## 활성화 전략 (단계적 롤아웃 권고)

무인 목표는 유지하되, 위 전제조건이 다 검증되기 전 첫 주기는 **초안→Slack DM(반자동, draft-only)** 로 1회 이상 실측해 채점·조립·Editor's Cut 품질을 확인한 뒤 발행 자동화를 켠다. 실측 없이 무인 발행을 켜면 ④(Editor's Cut)·⑥(Chrome)에서 첫 사고가 공개 발행으로 노출된다.

**2단계 완전 무인 전환 완료(2026-07-20)** — 스케줄드 태스크 `ask-hansol-newsletter-draft`(주1회 월 08:00, cron `0 8 * * 1`)의 프롬프트를 draft-only 에서 **완전 무인 발행**으로 교체. 파이프라인 ①~⑨(후보추출 → 선정 → 제목 → Editor's Cut → 커버 → 에디터 조립 → **자가검증 게이트 10종** → 게시·원장/vault 기록 → Slack 통지). 게이트 실패 시 게시하지 않고 임시저장 + `[보류]` 에스컬레이션. *태스크 id 는 이력 보존을 위해 `-draft` 접미사를 유지한다(동작은 무인 발행).*
- 승격 근거: (1) DB 접근 실측 성공 (2) 4호(#101) 실제 발행으로 커버 업로드·H3·네이티브 리스트·divider·게시 경로 전 구간 검증 (3) 게이트 10종을 4호 데이터로 역검증.
- 남은 리스크: **Chrome 세션**(월요일 08시 LinkedIn 로그인·확장 연결 유효성)은 여전히 미검증. 세션이 죽어 있으면 ⑥ 사전 점검에서 걸려 게시하지 않고 에스컬레이션하므로 사고로 이어지진 않으나, 그 주는 발행이 건너뛰어진다.
- 운영 권장: 전환 직후 1회는 "Run now"로 수동 실행해 도구 권한을 미리 승인(프리어프루브)해 두면 이후 실행이 권한 프롬프트에서 멈추지 않는다.

**1단계 draft-only 태스크 등록 완료(2026-07-04)** — 스케줄드 태스크 `ask-hansol-newsletter-draft`(주1회 월 08:00, `~/Documents/Claude/Scheduled/`). 파이프라인 ①~⑤+Editor's Cut 까지만 수행하고 **⑥ 발행은 프롬프트에 미포함(절대 발행 금지·published-ledger 미변경·dry-run)**, 결과는 Slack DM `D0B8J339HBK` 로 초안 패키지 전송. 첫 실행이 곧 DB 마운트 실측. "Run now"로 즉시 검증 + 도구 프리어프루브 권장.
**2단계(무인 전환)** — draft 품질 확인 + 남은 전제조건(DB 마운트·Chrome 세션) GREEN 후, 태스크 프롬프트에 ⑥ Chrome 발행 단계를 추가해 완전 무인으로 승격.

## 발행 주기

**주 1회 목표**(2026-07-04 발행인 결정). 현재 발행 가능 큐 4건 → 약 1개월 런웨이. 유입 확대 없이는 소진되므로, 활성화와 병행해 hsol.info 자문 유입 확대 필요. **스케줄 등록은 보류**(전제조건 GREEN 후 등록).

## Sources

- 2026-07-04 Cowork 세션: 발행인 결정(완전 무인·Cowork 스케줄드·Chrome 발행·이메일 통지) + Chrome 발행 가능 정정
- 후보 추출 검증: `hsol.info/scripts/ask-hansol-newsletter/extract-candidates.mjs` 실측(자문 9 → pass_to_llm 6 → 발행가능 4)
- LinkedIn API 조사: [Posts API - Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), [LinkedIn Posting API Guide 2026](https://zernio.com/blog/linkedin-posting-api)
