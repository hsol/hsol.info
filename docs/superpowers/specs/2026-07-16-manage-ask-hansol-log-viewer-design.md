# `/manage` 관리 콘솔 — Ask Hansol 대화 로그 뷰어 설계

- 날짜: 2026-07-16
- 상태: 승인 대기 (구현 전 최종 리뷰)
- 선행: `2026-07-16-manage-vercel-auth-design.md` (인증 게이트 + 빈 관리 셸)

## 목표

이미 팀 멤버십 게이트 뒤에 있는 `/manage` 빈 셸에 **첫 관리 기능**을 채운다.
방문자가 Ask Hansol 과 나눈 대화를 관리자가 **읽는다**. 읽기 전용 — 편집·삭제·재실행 없음.

용도는 "특정 목적 없이 대화를 통째로 둘러보기"다. 품질 점검 대시보드도, 분석 도구도 아니다.

## 전제 (실측으로 확인됨, 2026-07-16)

DB(Neon) 실측치:

- 세션 43개, 메시지 206개, 2026-05-08 ~ 2026-07-15 (약 2개월).
- 메시지 평균 237자, 최대 1,212자 → **전체 데이터 약 50KB**.
- 평가(별점·의견) 2건.

스키마상 사실:

- **세션 테이블은 없다.** 세션은 `ask_hansol_messages.session_id` 로 `GROUP BY` 해야 나온다.
- **세션 메타데이터가 없다.** `session_id` 는 방문자 브라우저 localStorage 의 UUID 일 뿐이며,
  서버에는 방문자 신원·유입 페르소나 페이지·기기·IP 가 일절 저장되지 않는다.
  따라서 뷰어가 보여줄 수 있는 것은 `session_id` + 메시지 본문 + 시각 + 평가뿐이다.
- 평가는 `ask_hansol_feedback` 이 `message_id`(assistant 메시지)로 참조한다.

## 범위 결정

**페이징을 구현한다.** 43세션·50KB 는 페이징 없이 한 페이지에 다 실어도 되는 규모이고
설계 논의에서 그렇게 제안했으나, **사용자가 명시적으로 페이징을 요청**했으므로 구현한다.

**하지 않는 것 (YAGNI):** 검색창·필터·정렬 옵션(43세션은 브라우저 `Cmd+F` 로 충분),
무한 스크롤, 세션 삭제, 평가 편집, 통계·차트, 모바일 레이아웃(아래 참조).

## UI — 실제 ChatDock 디자인을 그대로 계승

대화 패널은 방문자가 보는 Ask Hansol ChatDock 과 **같은 것으로 보여야 한다.**
새 버블 스타일을 만들지 않고 **기존 자산을 그대로 쓴다.**

### 재사용하는 것 (신규 CSS 없음)

`src/styles/legacy/chatdock.css` 는 CSS 모듈이 아니라 **전역 클래스**이고,
`ChatDock.tsx`·`DeferredChatDock.tsx` 가 각자 import 하는 구조다. `/manage` 도 똑같이 import 하면
아래 클래스를 그대로 쓸 수 있다:

| 클래스 | 역할 |
|---|---|
| `.chatdock-scroll` | 스크롤 컨테이너 (`flex:1; overflow-y:auto; padding:20px`) |
| `.chatdock-scroll-inner` | 메시지 스택 (`flex column; gap:16px`) |
| `.chatdock-msg` + `--user` / `--hansol` | 버블 정렬·색 |
| `.chatdock-msg-from` | `— Hansol` 라벨 |
| `.chatdock-msg-body` | 버블 본문 |

색·폰트 변수(`--bp-deep`·`--ink`·`--accent`·`--bp-line`·`--mono` …)는 `main.css` 의 `:root` 에
정의돼 `layout.tsx` 로 전역 적용되므로 `/manage` 가 자동 상속한다.

마크다운은 기존 `renderMarkdownText(content)` 헬퍼(`render-markdown-text.tsx`)를 그대로 호출해
도크와 **동일한 렌더 결과**를 얻는다. 서버 컴포넌트에서 호출해도 내부가 클라이언트 경계를 만든다.

### 함정 — 역할 이름이 다르다

**ChatDock 은 `"user" | "hansol"`, DB 는 `"user" | "assistant"` 다.**
CSS 클래스가 `--hansol` 이므로 `/manage` 는 렌더 시 `assistant → hansol` 로 매핑해야 한다.
이 매핑을 빠뜨리면 `.chatdock-msg--assistant` 라는 없는 클래스가 붙어 버블이 무스타일로 나온다.

```ts
const cls = `chatdock-msg chatdock-msg--${m.role === "assistant" ? "hansol" : "user"}`;
```

### 기존 셸의 Tailwind 를 걷어낸다

현 `page.tsx` 는 `text-neutral-600 dark:text-neutral-400` 같은 Tailwind 중립 색을 쓰는데,
**사이트 `body` 는 이미 `--bp-deep` 다크 블루프린트다.** 지금 셸이 사이트에서 튀는 쪽이었다.
ChatDock 을 계승하면서 셸 헤더·로그아웃 버튼도 블루프린트 변수 기반으로 맞춘다.

### 새로 만드는 것 (ChatDock 에 대응물이 없는 것만)

- **LNB** — 도크에는 세션 목록이 없다. 다만 스타일은 블루프린트 관용구를 따른다:
  경계선 `--bp-line`, 라벨 `--mono` + `letter-spacing`, 선택 항목 배경 `--bp-wall`.
- **읽기 전용 평가 표시** — 도크의 `AnswerFeedback` 은 방문자가 **입력**하는 위젯이라 쓰지 않는다.
  별점·의견을 그냥 보여주는 정적 표시를 만든다.
- **permalink 복사 버튼**, **`:target` 하이라이트** — 도크에 없는 관리 전용 기능.

## 레이아웃

데스크톱 2단 마스터-디테일:

```text
┌────────────────────────┬─────────────────────────────┐
│ LNB (세션 목록)         │ 대화 패널 (chat UI)          │
│                        │                             │
│ 7/15 14:38             │  ┌───────────────────────┐  │
│ 문답 1회                │  │ 포트폴리오에서 가장 … │  │ ← 질문
│ 마지막 답변 앞부분…      │  └───────────────────────┘  │
│ ──────────────────     │                             │
│ 7/14 17:37          ★  │  ┌───────────────────────┐  │
│ 문답 12회 ⚠ 답변 1 누락  │  │ 몇 가지를 꼽자면…     │  │ ← 답변
│ 마지막 답변 앞부분…      │  │ ★★★★☆ "정확했어요"    │  │
│ ──────────────────     │  └───────────────────────┘  │
│                        │                             │
│   ‹ 이전   2/3   다음 › │                             │
└────────────────────────┴─────────────────────────────┘
```

### LNB 항목 구성

- 마지막 메시지 시각
- **`문답 N회`** — N 은 질문(user) 수. 대화는 질문으로 시작하므로 질문 수가 곧 문답 횟수다.
- **어긋난 세션만 배지로 하이라이트.** 질문 수 ≠ 답변 수면 `⚠ 답변 N 누락` 을 붙인다
  (답변이 더 많은 비정상 방향이면 `⚠ 질문 N 누락`).
  질문 수·답변 수를 항상 나란히 띄우고 관리자가 매번 눈으로 비교하게 하는 대신,
  **어긋남을 시스템이 판정해 표시한다.** 정상 세션은 숫자 하나로 조용하고, 이상 세션만 튄다.
  판정에 두 카운트가 다 필요하므로 SQL 은 둘 다 세되, 화면에는 어긋날 때만 드러난다.
- **마지막 답변(assistant) 앞부분** 미리보기 (100자 자름).
  UUID 앞자리만 나열하면 43개가 전부 구별 불가 → 미리보기가 세션을 고를 수 있게 하는 유일한 단서.
- 평가가 하나라도 달린 세션에 `★` 표시.
- 선택된 세션은 배경 강조.

### 스크롤 모델

화면 높이를 `100vh` 로 고정하고 **LNB 와 대화 패널이 각자 `overflow-y: auto`** 로 스크롤한다.
페이지 전체가 스크롤되면 대화가 길 때 세션 목록이 같이 밀려 올라간다.

### 초기 스크롤 위치 — 맨 아래(최신 메시지)

세션을 열면 chat UI 관례대로 **마지막 메시지가 보이는 상태**로 시작한다.

permalink(`#m-<id>`)로 들어온 경우와 충돌하면 안 되므로 규칙은 하나다:

| 진입 | 초기 스크롤 | 담당 |
|---|---|---|
| `#m-<id>` 있음 | 해당 메시지 | 브라우저 (기본 동작) |
| hash 없음 | 맨 아래 | `ScrollToBottom` 클라이언트 컴포넌트 |

```tsx
// src/app/manage/scroll-to-bottom.tsx  ("use client")
useEffect(() => {
  if (!window.location.hash) document.getElementById("chat-end")?.scrollIntoView();
}, []);
return <div id="chat-end" />;   // 대화 패널 맨 끝에 놓는다
```

**`flex-direction: column-reverse` 를 쓰지 않는 이유:** 그 CSS 트릭이면 JS 0줄로 맨 아래에
붙지만 **DOM 에 메시지를 역순으로 심어야 한다.** 화면은 멀쩡해도 스크린리더 읽기 순서와
텍스트 드래그 복사가 거꾸로 뒤집힌다. 접근성을 CSS 트릭과 바꾸지 않는다.

`hash` 가 있으면 이 컴포넌트는 아무것도 하지 않고 브라우저 기본 스크롤에 양보한다 —
두 동작이 경쟁하지 않는다.

### 페이징

페이지당 20세션, 최신순(마지막 메시지 기준 내림차순). LNB 하단에 이전/다음 + `n/총페이지`.
페이징 버튼은 LNB 스크롤과 무관하게 **하단 고정**한다.

### 모바일

`max-width: 768px` 에서 전체를 덮는 안내 화면으로 **차단**한다("데스크톱에서 이용해주세요").
2단 레이아웃을 모바일에 접어 넣지 않는다 — 관리 콘솔이고, 사용자가 데스크톱 전용을 명시했다.
CSS 미디어쿼리만 사용, JS 없음.

## 라우팅 — URL 이 곧 상태

`/manage?session=<세션id>&page=<n>#m-<메시지id>`

| 조각 | 의미 | 처리 주체 |
|---|---|---|
| `?page=n` | LNB 페이지 | 서버 (SQL OFFSET) |
| `?session=<id>` | 우측에 열 대화 | 서버 (SQL WHERE) |
| `#m-<messageId>` | permalink 대상 메시지 | **브라우저 (기본 동작)** |

- LNB 항목·페이징 버튼은 전부 `<Link>` → 서버 컴포넌트가 다시 렌더. 클라이언트 상태 없음.
- `?session` 없으면 우측은 빈 상태("왼쪽에서 대화를 고르세요").
- `?session` 이 존재하지 않는 id 면 빈 상태와 동일하게 처리(에러 페이지 아님).
- `page` 는 **유효 범위(1..총페이지)로 클램프**한다. 숫자가 아니거나 1 미만이면 1,
  총페이지를 넘으면 마지막 페이지. 튕겨내지 않고 가장 가까운 유효 페이지를 보여준다.

## Permalink

**요구:** 특정 채팅을 클릭하면 permalink 가 복사되고, 그 링크로 접속하면 세션이 열리며
해당 채팅으로 스크롤된다.

**설계:** 스크롤 코드를 쓰지 않는다. 브라우저에 이미 있는 기능으로 처리한다.

1. 각 메시지 버블에 `id="m-<messageId>"` 를 부여한다.
2. 링크 `/manage?session=X#m-123` 로 접속 → 서버가 X 세션 대화를 **통째로 HTML 로 렌더**
   (세션당 최대 200메시지, 전량 서버 렌더이므로 지연 로딩 없음)
   → 브라우저가 fragment 를 보고 **자동 스크롤**. JS 0줄.
3. 도착한 메시지 강조는 CSS `:target` 의사클래스로 처리. JS 0줄.
   ```css
   .message:target { /* 하이라이트 */ }
   ```
4. **복사만 JS 가 필요하다.** 메시지 버블을 감싸는 작은 클라이언트 컴포넌트가
   클릭 시 클립보드에 permalink 를 쓰고 "복사됨"을 잠깐 표시한다.

**복사할 주소 — 현재 URL 의 hash 만 갈아끼운다:**

```ts
const url = new URL(window.location.href);
url.hash = `m-${messageId}`;   // ?session·?page 는 그대로 보존
navigator.clipboard.writeText(url.toString());
```

`?session` 만 넣고 `?page` 를 빼면, 링크를 받은 사람은 대화는 제대로 보지만 LNB 는 1페이지를
그려서 **정작 그 세션이 목록에 없는** 상태가 된다. 현재 URL 을 그대로 들고 hash 만 바꾸면
세션·페이지가 저절로 따라붙고 코드도 3줄이다.

(페이지 번호는 새 세션이 쌓이면 밀린다. 오래된 permalink 의 `page` 가 어긋나도 **대화 자체는
`?session` 으로 정확히 열리고** LNB 페이지만 안 맞을 뿐이므로, 페이지를 서버에서 역산하지 않는다.)

이 페이지의 클라이언트 JS 는 이 복사 버튼 하나뿐이다.

**주의:** fragment 는 서버로 전송되지 않는다. 스크롤·하이라이트는 전적으로 브라우저 몫이며,
서버는 대상 메시지가 HTML 안에 실재하도록 세션 전체를 렌더하기만 하면 된다.

## 데이터 계층

`src/lib/db/ask-hansol-messages.ts` 에 **관리 전용 조회 함수 2개**를 추가한다.
기존 `listAskHansolMessages`(방문자용)는 **건드리지 않는다.**

### 왜 기존 함수를 재사용하지 않는가 (중요)

기존 `listAskHansolMessages` 는 평가 **유무**만 `has_feedback: boolean` 으로 내려준다.
관리 화면에 별점·의견 본문을 띄우려고 이 함수에 `rating`·`comment` 를 추가하면,
같은 함수를 쓰는 **방문자용 Ask Hansol API 가 남의 평가 본문을 그대로 응답에 실어 보낸다.**
그래서 관리 전용 조회를 분리한다. 이것은 중복이 아니라 노출면 분리다.

### 1) 세션 목록

```ts
export type ManageSessionRow = {
  session_id: string;
  user_count: number;      // 화면의 `문답 N회`
  assistant_count: number; // 화면에 직접 안 뜸 — user_count 와 다를 때 ⚠ 배지 판정에만 쓴다
  last_at: string;
  preview: string | null;  // 마지막 답변 100자
  has_rating: boolean;
};

export async function listAskHansolSessionsForManage(
  page: number,
): Promise<{ rows: ManageSessionRow[]; total: number }>;
```

한 쿼리로 집계 + 마지막 답변을 뽑는다:

```sql
WITH agg AS (
  SELECT session_id,
         count(*) FILTER (WHERE role = 'user')::int      AS user_count,
         count(*) FILTER (WHERE role = 'assistant')::int AS assistant_count,
         max(created_at) AS last_at,
         max(id)         AS last_id
  FROM ask_hansol_messages
  GROUP BY session_id
),
last_answer AS (
  SELECT DISTINCT ON (session_id) session_id, content
  FROM ask_hansol_messages
  WHERE role = 'assistant'
  ORDER BY session_id, id DESC
)
SELECT a.session_id, a.user_count, a.assistant_count, a.last_at::text AS last_at,
       left(la.content, 100) AS preview,
       EXISTS (SELECT 1 FROM ask_hansol_feedback f WHERE f.session_id = a.session_id) AS has_rating
FROM agg a
LEFT JOIN last_answer la ON la.session_id = a.session_id
ORDER BY a.last_id DESC
LIMIT 20 OFFSET <(page-1)*20>
```

총 세션 수는 `SELECT count(DISTINCT session_id) FROM ask_hansol_messages` 로 별도 조회(페이징 표시용).

### 2) 세션 상세 (평가 본문 포함)

```ts
export type ManageMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  rating: number | null;
  comment: string | null;
};

export async function listAskHansolMessagesForManage(
  sessionId: string,
): Promise<ManageMessageRow[]>;
```

기존 함수와 같은 `LEFT JOIN ask_hansol_feedback` 구조에 `has_feedback` 대신 `f.rating`·`f.comment`
를 select 하고 `ORDER BY m.id ASC LIMIT 200`.

### DB 미설정 시

두 함수 모두 기존 `getSql()` 패턴을 따라 `DATABASE_URL`/`POSTGRES_URL` 이 없으면 빈 결과를 반환한다.
페이지는 "대화 기록이 없습니다" 로 렌더된다(빌드·로컬에서 크래시 없음).

## 컴포넌트 구성

| 파일 | 역할 | 종류 |
| --- | --- | --- |
| `src/app/manage/page.tsx` | searchParams 읽기 → 두 쿼리 실행 → 2단 렌더, `chatdock.css` import | 서버 |
| `src/app/manage/copy-permalink.tsx` | 클릭 시 클립보드 복사 + "복사됨" | **클라이언트** |
| `src/app/manage/scroll-to-bottom.tsx` | hash 없을 때만 맨 아래로 | **클라이언트** |

클라이언트 컴포넌트는 이 둘뿐이다. 나머지는 전부 서버 렌더 + 브라우저 기본 동작 + CSS.

기존 `page.tsx` 는 `dynamic = "force-dynamic"` 과 세션 표시·로그아웃 폼을 이미 갖고 있다 — 유지하되
Tailwind 중립 색은 블루프린트 변수로 교체한다(위 UI 절). 파일이 커지면 LNB·대화 패널을
같은 폴더 안 서버 컴포넌트로 분리한다.

## 에러 처리

- DB 미설정/쿼리 실패 → 빈 상태 렌더(페이지 크래시 금지).
- 없는 `session` id → 빈 상태.
- 범위 밖 `page` → **가장 가까운 유효 페이지로 클램프**(라우팅 절과 동일 규칙 — 1페이지로 튕기지 않음).
- 클립보드 API 실패(비-HTTPS 등) → 복사 버튼이 실패를 조용히 무시하지 않고 "복사 실패" 표시.

## 테스트

Ponytail 원칙에 따라 **런타임 로직이 있는 곳에만** 검증을 남긴다.
순수 함수 하나를 뽑아 기존 `src/lib/manage-auth.check.ts` 와 같은 assert 기반 self-check 로 검증한다:

- `src/lib/db/ask-hansol-manage.check.ts` (또는 기존 check 파일에 합침)
- 대상 1 — 페이지 클램프 `clampPage(raw, totalPages)`(`"abc"` → 1, `"-3"` → 1, `"99"` → 총페이지,
  `"2"` → 2)와 OFFSET 계산. 이 산술이 틀리면 세션이 조용히 사라지거나 중복 표시된다.
- 대상 2 — 어긋남 배지 판정 `mismatchLabel(userCount, assistantCount)`:
  같으면 `null`, 답변이 적으면 `⚠ 답변 N 누락`, 많으면 `⚠ 질문 N 누락`.
  분기가 있으므로 순수 함수로 뽑아 검증한다.

SQL 자체는 실제 DB 로 한 번 실행해 결과를 눈으로 확인한다(모킹하지 않음).

## 보안 메모

- 이 페이지 전체는 이미 미들웨어의 팀 멤버십 게이트 뒤에 있다 — 추가 인증 불필요.
- 방문자 대화 본문에 개인정보가 섞여 있을 수 있으나, 열람 주체가 팀 멤버로 한정되고
  읽기 전용이므로 별도 마스킹은 하지 않는다.
- `session_id` 는 방문자 localStorage 의 UUID 다. permalink 에 그대로 들어가지만,
  게이트 뒤에서만 열리므로 노출 위험은 없다.
