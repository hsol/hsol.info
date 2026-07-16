# /manage Ask Hansol 대화 로그 뷰어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팀 멤버십 게이트 뒤의 빈 `/manage` 셸에 방문자↔Ask Hansol 대화를 읽는 3단 콘솔(전체 LNB / 세션 목록 / chat UI)을 채운다.

**Architecture:** `manage/layout.tsx` 가 1단 전체 LNB(향후 관리 기능 공통 셸), `manage/page.tsx` 가 2단 세션 목록 + 3단 대화를 서버 렌더한다. 상태는 전부 URL(`?session=&page=#m-<id>`)에 있고 클라이언트 컴포넌트는 클립보드 복사·초기 스크롤 둘뿐이다. 버블 UI 는 기존 `chatdock.css` 전역 클래스를 그대로 재사용하고, 페이징은 기존 `pagination.ts` 를 재사용한다.

**Tech Stack:** Next.js 15 App Router (server components, `searchParams` 는 Promise), React 19, Neon serverless Postgres (`@neondatabase/serverless`), 전역 CSS(모듈 아님), assert 기반 self-check(`npx tsx`).

**Spec:** `docs/superpowers/specs/2026-07-16-manage-ask-hansol-log-viewer-design.md`

## Global Constraints

- **읽기 전용.** 편집·삭제·재실행·평가 입력 없음.
- **기존 방문자용 `listAskHansolMessages`(`src/lib/db/ask-hansol-messages.ts`)를 수정하지 않는다.** 거기에 `rating`·`comment` 를 추가하면 방문자용 Ask Hansol API 가 남의 평가 본문을 응답에 실어 보낸다. 관리 전용 조회는 새 파일에 분리한다.
- **역할 이름 매핑 필수:** DB 는 `"user" | "assistant"`, ChatDock CSS 는 `--user` / `--hansol`. `assistant → hansol` 로 매핑하지 않으면 버블이 무스타일로 렌더된다.
- **`renderMarkdownText(text, streaming)` 함수는 `@deprecated`.** 신규 코드는 `<RenderMarkdownText text={...} />` 컴포넌트를 쓴다.
- **페이징을 새로 만들지 않는다.** `src/lib/pagination.ts` 의 `resolvePage`·`paginate` 재사용(범위 클램프 포함). 세션 목록에 SQL `LIMIT/OFFSET` 없음, 임의 상한 없음(silent cap 금지).
- **robots.txt 에 `/manage` 를 절대 적지 않는다.** 공개 파일이라 적는 순간 관리자 페이지 존재를 광고하는 것이며 "봇이 존재도 모르게" 요구에 정면으로 어긋난다.
- **DB 미설정 시 크래시 금지.** `DATABASE_URL`/`POSTGRES_URL` 없으면 빈 결과 → 빈 상태 렌더.
- **데스크톱 전용.** `max-width: 768px` 에서 CSS 로 차단.
- 페이지당 세션 수: `20`. 마지막 답변 미리보기: `100`자. 세션당 메시지 상한: `200`.
- 커밋 메시지는 한국어 관례(`feat(manage): …`)를 따르고 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 로 끝낸다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `src/lib/db/ask-hansol-manage.ts` (신규) | 관리 전용 DB 조회 2개 + `mismatchLabel` 순수 함수 + 상수 |
| `src/lib/db/ask-hansol-manage.check.ts` (신규) | `mismatchLabel` assert self-check |
| `src/styles/manage.css` (신규) | 콘솔 셸(3단 그리드)·LNB·읽기전용 별점·`:target`·모바일 차단 |
| `src/app/manage/layout.tsx` (신규) | 1단 전체 LNB + 로그인 사용자·로그아웃 + noindex metadata |
| `src/app/manage/page.tsx` (수정) | 2단 세션 목록 + 3단 대화 렌더 |
| `src/app/manage/copy-permalink.tsx` (신규) | 클립보드 복사 버튼 (client) |
| `src/app/manage/scroll-to-bottom.tsx` (신규) | hash 없을 때만 맨 아래로 (client) |
| `src/middleware.ts` (수정) | `/manage` 응답에 `X-Robots-Tag` |

---

### Task 1: 봇 차단 헤더 (`X-Robots-Tag`)

가장 작고 독립적이라 먼저 한다. 다른 태스크에 의존하지 않는다.

**Files:**
- Modify: `src/middleware.ts:42-53`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (미들웨어 동작만 변경)

- [ ] **Step 1: 현재 `/manage` 분기 확인**

`src/middleware.ts:42-53` 이 아래와 같은지 읽어서 확인한다:

```ts
  const { pathname, search } = req.nextUrl;
  if (pathname === "/manage" || pathname.startsWith("/manage/")) {
    const secret = process.env.MANAGE_SESSION_SECRET;
    const token = req.cookies.get(MANAGE_COOKIE)?.value;
    if (!(secret && token && (await verifySession(token, secret)))) {
      const authorize = new URL("/api/auth/authorize", req.url);
      authorize.searchParams.set("from", pathname + search);
      return NextResponse.redirect(authorize);
    }
  }

  return NextResponse.next();
```

- [ ] **Step 2: 리다이렉트·통과 응답 양쪽에 헤더를 붙이도록 수정**

위 블록을 통째로 아래로 교체한다:

```ts
  const { pathname, search } = req.nextUrl;
  if (pathname === "/manage" || pathname.startsWith("/manage/")) {
    const secret = process.env.MANAGE_SESSION_SECRET;
    const token = req.cookies.get(MANAGE_COOKIE)?.value;
    if (!(secret && token && (await verifySession(token, secret)))) {
      const authorize = new URL("/api/auth/authorize", req.url);
      authorize.searchParams.set("from", pathname + search);
      const redirect = NextResponse.redirect(authorize);
      redirect.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      return redirect;
    }
    // 로그인 상태의 관리 페이지도 색인 금지. 경로 접두로 판정하므로 앞으로 추가될
    // /manage/<기능> 라우트가 자동으로 덮인다 — 페이지마다 metadata 를 다는 방식은
    // 새 라우트에서 빠뜨리기 쉽다. (robots.txt 에는 적지 않는다 — 공개 파일이라
    // 적는 순간 관리자 페이지의 존재를 광고하게 된다.)
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res;
  }

  return NextResponse.next();
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (기존 에러가 있다면 이 파일과 무관한 것만)

- [ ] **Step 4: 헤더가 실제로 붙는지 확인**

개발 서버는 **사용자가 직접 띄운다**(이 저장소 관례: 에이전트가 포그라운드로 dev 서버를 띄우지 않는다).
서버가 떠 있는 상태에서:

Run: `curl -sI http://localhost:3000/manage | grep -i "x-robots-tag\|location\|HTTP/"`
Expected: `HTTP/1.1 307`(또는 302) + `x-robots-tag: noindex, nofollow, noarchive` + `location: /api/auth/authorize?from=%2Fmanage`

- [ ] **Step 5: robots.txt 에 `/manage` 가 없는지 재확인 (회귀 방지)**

Run: `curl -s http://localhost:3000/robots.txt`
Expected: `Disallow: /api/` 와 `Disallow: /_next/` 만 있고 **`manage` 라는 문자열이 없어야 한다.**

- [ ] **Step 6: 커밋**

```bash
git add src/middleware.ts
git commit -m "$(cat <<'EOF'
feat(manage): /manage 응답에 X-Robots-Tag noindex 부착

경로 접두 판정이라 앞으로 추가될 /manage/<기능> 라우트도 자동으로 덮인다.
robots.txt 에는 적지 않는다 — 공개 파일이라 적는 순간 관리자 페이지의 존재를
광고하게 되어 "봇이 존재도 모르게" 요구에 어긋난다. 접근 차단은 기존 게이트가 한다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 관리 전용 DB 조회 + `mismatchLabel`

**Files:**
- Create: `src/lib/db/ask-hansol-manage.ts`
- Test: `src/lib/db/ask-hansol-manage.check.ts`

**Interfaces:**
- Consumes: `@neondatabase/serverless` 의 `neon` (기존 `ask-hansol-messages.ts` 와 동일 패턴)
- Produces (Task 4 가 이 이름들을 그대로 import 한다):
  - `MANAGE_SESSIONS_PER_PAGE: number` (= 20)
  - `type ManageSessionRow = { session_id: string; user_count: number; assistant_count: number; last_at: string; preview: string | null; has_rating: boolean }`
  - `type ManageMessageRow = { id: string; role: "user" | "assistant"; content: string; created_at: string; rating: number | null; comment: string | null }`
  - `listAskHansolSessionsForManage(): Promise<ManageSessionRow[]>`
  - `listAskHansolMessagesForManage(sessionId: string): Promise<ManageMessageRow[]>`
  - `mismatchLabel(userCount: number, assistantCount: number): string | null`

- [ ] **Step 1: 실패하는 self-check 를 먼저 쓴다**

Create `src/lib/db/ask-hansol-manage.check.ts`:

```ts
/**
 * 관리 콘솔 순수 로직 자체 점검. 프레임워크 없이 tsx 로 직접 실행:
 *   npx tsx src/lib/db/ask-hansol-manage.check.ts
 *
 * DB 조회 함수는 여기서 검증하지 않는다(실 DB 로 눈으로 확인). 분기가 있는
 * mismatchLabel 만 대상. 페이지 클램프는 기존 pagination.ts 재사용이라 제외.
 */
import assert from "node:assert";

import { mismatchLabel } from "./ask-hansol-manage";

function main() {
  // 정상 대화 — 배지 없음
  assert(mismatchLabel(12, 12) === null, "같은 수인데 배지가 붙었다");
  assert(mismatchLabel(0, 0) === null, "빈 세션에 배지가 붙었다");

  // 답변이 모자란 경우 — 가장 흔한 이상(답변 실패·중도 이탈)
  assert(mismatchLabel(12, 11) === "⚠ 답변 1 누락", `답변 누락 라벨 불일치: ${mismatchLabel(12, 11)}`);
  assert(mismatchLabel(3, 0) === "⚠ 답변 3 누락", `답변 누락 라벨 불일치: ${mismatchLabel(3, 0)}`);

  // 반대 방향(비정상이지만 표시는 해야 한다)
  assert(mismatchLabel(11, 12) === "⚠ 질문 1 누락", `질문 누락 라벨 불일치: ${mismatchLabel(11, 12)}`);

  console.log("✓ ask-hansol-manage self-check passed");
}

main();
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx src/lib/db/ask-hansol-manage.check.ts`
Expected: FAIL — `Cannot find module './ask-hansol-manage'` (아직 안 만들었으므로)

- [ ] **Step 3: 조회 모듈을 만든다**

Create `src/lib/db/ask-hansol-manage.ts`:

```ts
import { neon } from "@neondatabase/serverless";

/**
 * /manage 관리 콘솔 **전용** 조회. 방문자용 `ask-hansol-messages.ts` 와 분리한 이유:
 * 방문자용 `listAskHansolMessages` 는 평가 유무만 boolean 으로 내려준다. 관리 화면에
 * 별점·의견 본문을 띄우려고 그 함수에 rating·comment 를 추가하면, 같은 함수를 쓰는
 * 방문자용 Ask Hansol API 가 남의 평가 본문을 그대로 응답에 실어 보낸다.
 * 중복이 아니라 노출면 분리다.
 */

/** 한 페이지에 보여줄 세션 수. 자르기는 lib/pagination.ts 의 paginate() 가 인메모리로 한다. */
export const MANAGE_SESSIONS_PER_PAGE = 20;

/** 마지막 답변 미리보기 길이(자). */
const PREVIEW_CHARS = 100;

/** 세션 하나에서 읽어올 최대 메시지 수. */
const MESSAGE_LIMIT = 200;

export type ManageSessionRow = {
  session_id: string;
  /** 화면의 `문답 N회`. */
  user_count: number;
  /** 화면에 직접 뜨지 않는다 — user_count 와 다를 때 ⚠ 배지 판정에만 쓴다. */
  assistant_count: number;
  last_at: string;
  /** 마지막 답변 앞부분. 답변이 하나도 없는 세션이면 null. */
  preview: string | null;
  has_rating: boolean;
};

export type ManageMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  rating: number | null;
  comment: string | null;
};

function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) return null;
  return neon(url);
}

/**
 * 질문 수와 답변 수가 어긋난 세션에만 붙는 배지 라벨. 같으면 null.
 * 숫자 둘을 나란히 띄우고 사람이 매번 비교하게 하는 대신 시스템이 판정한다 —
 * 정상 세션은 조용하고 이상 세션만 튄다.
 */
export function mismatchLabel(userCount: number, assistantCount: number): string | null {
  if (userCount === assistantCount) return null;
  const diff = Math.abs(userCount - assistantCount);
  return userCount > assistantCount ? `⚠ 답변 ${diff} 누락` : `⚠ 질문 ${diff} 누락`;
}

/**
 * 전체 세션을 최신순으로. 페이지 자르기는 호출부에서 paginate() 가 한다.
 * `/news`·`/build-log` 와 같은 관례(목록 전체 로드 후 인메모리 slice)이며,
 * 임의의 LIMIT 을 두지 않는다 — 세션이 조용히 사라지는 편이 더 나쁘다.
 */
export async function listAskHansolSessionsForManage(): Promise<ManageSessionRow[]> {
  const sql = getSql();
  if (!sql) return [];

  const rows = await sql`
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
    SELECT a.session_id,
           a.user_count,
           a.assistant_count,
           a.last_at::text AS last_at,
           left(la.content, ${PREVIEW_CHARS}) AS preview,
           EXISTS (
             SELECT 1 FROM ask_hansol_feedback f WHERE f.session_id = a.session_id
           ) AS has_rating
    FROM agg a
    LEFT JOIN last_answer la ON la.session_id = a.session_id
    ORDER BY a.last_id DESC
  `;
  return rows as ManageSessionRow[];
}

/** 세션 하나의 전체 대화 + 평가 본문. 방문자용과 달리 rating·comment 를 그대로 내려준다. */
export async function listAskHansolMessagesForManage(
  sessionId: string,
): Promise<ManageMessageRow[]> {
  const sql = getSql();
  if (!sql || !sessionId) return [];

  const rows = await sql`
    SELECT m.id::text AS id,
           m.role,
           m.content,
           m.created_at::text AS created_at,
           f.rating,
           f.comment
    FROM ask_hansol_messages m
    LEFT JOIN ask_hansol_feedback f
      ON f.message_id = m.id AND f.session_id = m.session_id
    WHERE m.session_id = ${sessionId}
    ORDER BY m.id ASC
    LIMIT ${MESSAGE_LIMIT}
  `;
  return rows as ManageMessageRow[];
}
```

- [ ] **Step 4: self-check 통과 확인**

Run: `npx tsx src/lib/db/ask-hansol-manage.check.ts`
Expected: `✓ ask-hansol-manage self-check passed`

- [ ] **Step 5: 실제 DB 로 SQL 을 한 번 실행해 눈으로 확인**

SQL 은 모킹하지 않는다. 임시 스크립트를 저장소 루트에 만들어 실행하고 **바로 지운다**
(`node_modules` 해석 때문에 루트여야 한다):

```bash
cat > .manage-probe.mjs <<'EOF'
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8");
const m = env.match(/^(?:DATABASE_URL|POSTGRES_URL)=["']?([^"'\n]+)/m);
process.env.DATABASE_URL = m[1];
const { listAskHansolSessionsForManage, listAskHansolMessagesForManage, mismatchLabel } =
  await import("./src/lib/db/ask-hansol-manage.ts");
const rows = await listAskHansolSessionsForManage();
console.log("총 세션:", rows.length);
console.log("최근 3개:", JSON.stringify(rows.slice(0, 3), null, 1));
console.log("어긋난 세션:", rows.filter(r => mismatchLabel(r.user_count, r.assistant_count)).length);
const msgs = await listAskHansolMessagesForManage(rows[0].session_id);
console.log("첫 세션 메시지:", msgs.length, "평가 달린 것:", msgs.filter(m => m.rating !== null).length);
EOF
npx tsx .manage-probe.mjs; rm -f .manage-probe.mjs
```

Expected: `총 세션: 43` 근처, 각 행에 `session_id`·`user_count`·`assistant_count`·`last_at`·`preview`(문자열 또는 null)·`has_rating`(true/false)가 채워져 있어야 한다. `preview` 가 전부 `null` 이면 `left()`/`DISTINCT ON` 이 잘못된 것이다.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/db/ask-hansol-manage.ts src/lib/db/ask-hansol-manage.check.ts
git commit -m "$(cat <<'EOF'
feat(manage): Ask Hansol 관리 전용 DB 조회 + 문답 어긋남 판정

- 세션 목록(집계 + 마지막 답변 미리보기 + 평가 유무)을 한 쿼리로. LIMIT 없음 —
  페이지 자르기는 기존 lib/pagination.ts 가 인메모리로 한다(/news·/build-log 관례).
- 세션 상세는 rating·comment 본문까지 내려준다. 방문자용 listAskHansolMessages 에
  이를 추가하면 방문자 API 가 남의 평가 본문을 노출하므로 파일을 분리했다.
- mismatchLabel: 질문 수 ≠ 답변 수인 세션에만 배지. self-check 포함.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 콘솔 셸 — 1단 전체 LNB (`layout.tsx`) + `manage.css`

**Files:**
- Create: `src/app/manage/layout.tsx`
- Create: `src/styles/manage.css`
- Modify: `src/app/manage/page.tsx` (셸 코드 제거 — 로그인 표시·로그아웃 폼이 layout 으로 이동)

**Interfaces:**
- Consumes: `MANAGE_COOKIE`·`verifySession` (`@/lib/manage-auth`)
- Produces (Task 4 가 이 CSS 클래스 안에 렌더한다):
  - `.manage-shell` — 3단 그리드 컨테이너 (layout 이 그림)
  - `.manage-nav` — 1단 (layout 이 그림)
  - Task 4 가 쓸 클래스: `.manage-list`, `.manage-list-item`, `.manage-list-item.is-active`, `.manage-list-time`, `.manage-list-count`, `.manage-list-badge`, `.manage-list-preview`, `.manage-list-star`, `.manage-pager`, `.manage-chat`, `.manage-empty`, `.manage-rating`, `.manage-copy`

- [ ] **Step 1: `manage.css` 를 만든다**

Create `src/styles/manage.css`:

```css
/* /manage 관리 콘솔 셸. 버블 UI 는 legacy/chatdock.css 를 그대로 재사용하고,
   여기엔 도크에 대응물이 없는 것만 둔다 — 3단 셸·LNB·읽기전용 별점·permalink 하이라이트.
   색·폰트는 main.css :root 의 블루프린트 변수를 그대로 쓴다. */

.manage-shell {
  display: grid;
  grid-template-columns: 180px 300px 1fr;
  height: 100vh;
  overflow: hidden;          /* 각 단이 알아서 스크롤한다 */
  position: relative;
  z-index: 1;                /* body::before/::after 그리드 오버레이 위로 */
}

/* ── 1단: 전체 LNB (관리 기능) ─────────────────────────── */
.manage-nav {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--bp-line);
  background: var(--bp-floor);
  padding: 20px 0;
}
.manage-nav-brand {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  color: var(--ink-faint);
  padding: 0 16px 16px;
}
.manage-nav-list { list-style: none; margin: 0; padding: 0; flex: 1; }
.manage-nav-item {
  display: block;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--ink-2);
  text-decoration: none;
  border-left: 2px solid transparent;
}
.manage-nav-item:hover { background: var(--bp-wall); color: var(--ink); }
.manage-nav-foot {
  border-top: 1px solid var(--bp-line);
  padding: 12px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.manage-nav-who {
  font-size: 11px;
  color: var(--ink-faint);
  overflow-wrap: anywhere;
}
.manage-signout {
  border: 1px solid var(--bp-line);
  background: none;
  color: var(--ink-2);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  padding: 5px 8px;
  border-radius: 3px;
  cursor: pointer;
}
.manage-signout:hover { background: var(--bp-wall); color: var(--ink); }

/* ── 2단: 세션 목록 ───────────────────────────────────── */
.manage-list-pane {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--bp-line);
  min-height: 0;             /* flex 자식이 스크롤하려면 필요 */
}
.manage-list {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
}
.manage-list-item {
  display: block;
  padding: 12px 14px;
  border-bottom: 1px solid var(--bp-line);
  text-decoration: none;
  color: inherit;
}
.manage-list-item:hover { background: var(--bp-floor); }
.manage-list-item.is-active {
  background: var(--bp-wall);
  border-left: 2px solid var(--bp-glow);
}
.manage-list-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.manage-list-time {
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--ink-mute);
}
.manage-list-star { color: #f0b429; font-size: 11px; margin-left: auto; }
.manage-list-count {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--ink-faint);
}
.manage-list-badge {
  font-family: var(--mono);
  font-size: 10px;
  color: #ffb086;
  margin-left: 6px;
}
.manage-list-preview {
  font-size: 12px;
  line-height: 1.45;
  color: var(--ink-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.manage-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--bp-line);
  background: var(--bp-floor);
  font-family: var(--mono);
  font-size: 10.5px;
}
.manage-pager a { color: var(--ink-2); text-decoration: none; }
.manage-pager a:hover { color: var(--bp-glow); }
.manage-pager span[aria-disabled="true"] { color: var(--bp-line-2); }

/* ── 3단: 대화 ────────────────────────────────────────── */
.manage-chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.manage-empty {
  margin: auto;
  color: var(--ink-faint);
  font-size: 13px;
}

/* permalink 로 도착한 메시지 강조 — 스크롤은 브라우저가, 강조는 CSS 가 한다. JS 없음. */
.chatdock-msg:target .chatdock-msg-body {
  outline: 1px solid var(--bp-glow);
  outline-offset: 3px;
}

/* 읽기 전용 평가 표시(도크의 AnswerFeedback 은 방문자 입력용이라 쓰지 않는다) */
.manage-rating {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 6px;
  font-size: 11.5px;
  color: var(--ink-mute);
}
.manage-rating-stars { color: #f0b429; letter-spacing: 1px; }
.manage-rating-comment { color: var(--ink-2); font-style: italic; }

/* permalink 복사 버튼 — 메시지에 호버할 때만 드러난다 */
.manage-copy {
  align-self: flex-start;
  border: none;
  background: none;
  padding: 2px 0;
  margin-top: 2px;
  font-family: var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.chatdock-msg:hover .manage-copy,
.manage-copy:focus-visible { opacity: 1; }
.manage-copy:hover { color: var(--bp-glow); }

/* ── 모바일 차단 ──────────────────────────────────────── */
.manage-mobile-block { display: none; }

@media (max-width: 768px) {
  .manage-shell { display: none; }
  .manage-mobile-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 100vh;
    padding: 24px;
    text-align: center;
  }
  .manage-mobile-block-title {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }
}
```

- [ ] **Step 2: `layout.tsx` 를 만든다**

Create `src/app/manage/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import Link from "next/link";

import { MANAGE_COOKIE, verifySession } from "@/lib/manage-auth";
import "@/styles/manage.css";

/**
 * 관리 콘솔 공통 셸 — 1단 전체 LNB. 앞으로 /manage/<기능> 라우트를 추가하면
 * 이 셸이 자동으로 입혀진다. 기능별 화면(2·3단)은 각 page 가 그린다.
 */

// 봇 차단의 실효는 미들웨어의 X-Robots-Tag 헤더가 낸다(게이트 때문에 봇은 이 HTML 을
// 볼 일이 없다). 여기 metadata 는 의도를 코드에 남기는 용도.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ManageLayout({ children }: { children: ReactNode }) {
  // 미들웨어가 이미 세션을 보장하지만, 표시용으로 한 번 더 읽는다.
  const store = await cookies();
  const token = store.get(MANAGE_COOKIE)?.value;
  const session = token
    ? await verifySession(token, process.env.MANAGE_SESSION_SECRET as string)
    : null;
  const who = session?.name ?? session?.email ?? "";

  return (
    <>
      <div className="manage-shell">
        <nav className="manage-nav">
          <div className="manage-nav-brand">CONSOLE</div>
          <ul className="manage-nav-list">
            <li>
              {/* 활성 표시는 기능이 2개 이상 될 때 붙인다 — 지금은 항목이 하나라 무의미하다. */}
              <Link className="manage-nav-item" href="/manage">
                Ask 로그
              </Link>
            </li>
          </ul>
          <div className="manage-nav-foot">
            <div className="manage-nav-who">{who}</div>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="manage-signout">
                로그아웃
              </button>
            </form>
          </div>
        </nav>
        {children}
      </div>
      <div className="manage-mobile-block">
        <div className="manage-mobile-block-title">CONSOLE</div>
        <p>관리 콘솔은 데스크톱에서 이용해주세요.</p>
      </div>
    </>
  );
}
```

- [ ] **Step 3: `page.tsx` 에서 셸 코드를 걷어낸다**

`src/app/manage/page.tsx` 를 통째로 아래로 교체한다. 로그인 표시·로그아웃 폼은 layout 으로
갔고, Tailwind 중립 색(사이트 블루프린트 테마와 어긋난다)도 함께 사라진다.
뷰어 본체는 Task 4 에서 채운다.

```tsx
export const dynamic = "force-dynamic";

export default async function ManagePage() {
  return (
    <div className="manage-empty">Ask 로그 — 준비 중</div>
  );
}
```

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 브라우저로 셸 확인**

개발 서버가 떠 있는 상태에서 `http://localhost:3000/manage` 를 연다(로그인 필요).
Expected:
- 좌측에 폭 180px 짙은 남색 LNB, 상단 `CONSOLE`, 항목 `Ask 로그`, 하단에 내 이름/이메일 + `로그아웃`
- 페이지 전체가 다크 블루프린트 톤(흰 배경·회색 글씨가 **아님**)
- 브라우저 창을 768px 이하로 줄이면 3단이 사라지고 "관리 콘솔은 데스크톱에서 이용해주세요" 만 보임
- `로그아웃` 클릭 시 기존과 동일하게 로그아웃됨

- [ ] **Step 6: 커밋**

```bash
git add src/app/manage/layout.tsx src/app/manage/page.tsx src/styles/manage.css
git commit -m "$(cat <<'EOF'
feat(manage): 콘솔 공통 셸 — 1단 전체 LNB 를 layout.tsx 로 분리

- layout.tsx 가 전체 LNB·로그인 사용자·로그아웃을 맡는다. 앞으로 /manage/<기능>
  라우트를 추가하면 셸이 자동으로 입혀진다. 활성 표시는 항목이 2개 이상일 때(YAGNI).
- manage.css: 3단 그리드·LNB·모바일 차단·:target 하이라이트·읽기전용 별점.
  버블 UI 는 legacy/chatdock.css 재사용이라 여기 없다.
- page.tsx 의 Tailwind 중립 색 제거 — 사이트 body 는 이미 블루프린트 다크라
  기존 셸이 오히려 튀고 있었다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 뷰어 본체 — 2단 세션 목록 + 3단 대화

**Files:**
- Modify: `src/app/manage/page.tsx` (전체 교체)

**Interfaces:**
- Consumes:
  - Task 2 의 `MANAGE_SESSIONS_PER_PAGE`, `ManageMessageRow`, `listAskHansolSessionsForManage()`, `listAskHansolMessagesForManage(sessionId)`, `mismatchLabel(u, a)`
  - 기존 `resolvePage(raw)`·`paginate(items, page, perPage)` (`@/lib/pagination`)
  - 기존 `<RenderMarkdownText text={...} />` (`@/components/portfolio/ask/render-markdown-text`)
  - Task 3 의 `.manage-*` CSS 클래스, 기존 `.chatdock-*` 클래스
  - Task 5 의 `<CopyPermalink messageId={...} />`, `<ScrollToBottom />` — **Task 5 를 먼저 만들지 않으려면 이 태스크에서 import 를 잠시 빼고, Task 5 에서 붙인다.** 아래 Step 은 Task 5 를 나중에 하는 순서로 쓰여 있다.
- Produces: 없음 (최종 화면)

- [ ] **Step 1: `page.tsx` 를 뷰어로 교체한다**

Replace `src/app/manage/page.tsx` 전체:

```tsx
import Link from "next/link";

import { RenderMarkdownText } from "@/components/portfolio/ask/render-markdown-text";
import {
  MANAGE_SESSIONS_PER_PAGE,
  listAskHansolMessagesForManage,
  listAskHansolSessionsForManage,
  mismatchLabel,
  type ManageMessageRow,
} from "@/lib/db/ask-hansol-manage";
import { paginate, resolvePage } from "@/lib/pagination";
import "@/styles/legacy/chatdock.css";

export const dynamic = "force-dynamic";

/**
 * `2026-07-15 05:38:59.703471+00` → `7. 15. 14:38` (KST).
 *
 * 문자열을 그대로 `new Date()` 에 넣는다. 공백을 `T` 로 바꾸면(`...T05:38:59.703471+00`)
 * Postgres 의 `+00` 오프셋이 유효한 ISO 8601 이 아니라서 **Invalid Date 가 된다** — 검증함:
 *   new Date("2026-07-15 05:38:59.703471+00")  → Wed Jul 15 2026 14:38:59 GMT+0900  ✅
 *   new Date("2026-07-15T05:38:59.703471+00")  → Invalid Date                        ❌
 */
function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(iso));
}

function Stars({ rating }: { rating: number }) {
  return <span className="manage-rating-stars">{"★".repeat(rating) + "☆".repeat(5 - rating)}</span>;
}

function Message({ m }: { m: ManageMessageRow }) {
  // DB 는 role 을 'assistant' 로, ChatDock CSS 는 '--hansol' 로 부른다. 매핑을 빠뜨리면
  // .chatdock-msg--assistant 라는 없는 클래스가 붙어 버블이 무스타일로 나온다.
  const variant = m.role === "assistant" ? "hansol" : "user";
  return (
    <div id={`m-${m.id}`} className={`chatdock-msg chatdock-msg--${variant}`}>
      {variant === "hansol" && <div className="chatdock-msg-from">— Hansol</div>}
      <div className="chatdock-msg-body">
        <RenderMarkdownText text={m.content} />
      </div>
      {(m.rating !== null || m.comment) && (
        <div className="manage-rating">
          {m.rating !== null && <Stars rating={m.rating} />}
          {m.comment && <span className="manage-rating-comment">“{m.comment}”</span>}
        </div>
      )}
    </div>
  );
}

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string | string[]; page?: string | string[] }>;
}) {
  const sp = await searchParams;
  const activeId = Array.isArray(sp.session) ? sp.session[0] : sp.session;

  const all = await listAskHansolSessionsForManage();
  // resolvePage/paginate 가 ?page= 정규화와 [1, pageCount] 클램프를 이미 한다.
  const { items, page, pageCount } = paginate(
    all,
    resolvePage(sp.page),
    MANAGE_SESSIONS_PER_PAGE,
  );

  // 없는 session id 는 빈 상태와 동일하게 처리한다(에러 페이지 아님).
  const messages = activeId ? await listAskHansolMessagesForManage(activeId) : [];

  const pageQuery = (n: number) => `?page=${n}${activeId ? `&session=${activeId}` : ""}`;

  return (
    <>
      <div className="manage-list-pane">
        <ul className="manage-list">
          {items.map((s) => {
            const badge = mismatchLabel(s.user_count, s.assistant_count);
            return (
              <li key={s.session_id}>
                <Link
                  className={"manage-list-item" + (s.session_id === activeId ? " is-active" : "")}
                  href={`?session=${s.session_id}&page=${page}`}
                >
                  <div className="manage-list-head">
                    <span className="manage-list-time">{formatWhen(s.last_at)}</span>
                    {s.has_rating && <span className="manage-list-star">★</span>}
                  </div>
                  <div>
                    <span className="manage-list-count">문답 {s.user_count}회</span>
                    {badge && <span className="manage-list-badge">{badge}</span>}
                  </div>
                  <div className="manage-list-preview">{s.preview ?? "(답변 없음)"}</div>
                </Link>
              </li>
            );
          })}
          {items.length === 0 && <li className="manage-list-item">대화 기록이 없습니다.</li>}
        </ul>
        <div className="manage-pager">
          {page > 1 ? (
            <Link href={pageQuery(page - 1)}>‹ 이전</Link>
          ) : (
            <span aria-disabled="true">‹ 이전</span>
          )}
          <span>
            {page}/{pageCount}
          </span>
          {page < pageCount ? (
            <Link href={pageQuery(page + 1)}>다음 ›</Link>
          ) : (
            <span aria-disabled="true">다음 ›</span>
          )}
        </div>
      </div>

      <div className="manage-chat">
        {messages.length === 0 ? (
          <div className="manage-empty">왼쪽에서 대화를 고르세요.</div>
        ) : (
          <div className="chatdock-scroll">
            <div className="chatdock-scroll-inner">
              {messages.map((m) => (
                <Message key={m.id} m={m} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 브라우저로 확인**

`http://localhost:3000/manage` 를 연다.
Expected:
- 2단에 세션이 최신순으로 20개, 각 항목에 `7/15 14:38` · `문답 N회` · 마지막 답변 2줄 미리보기
- 평가 달린 세션에 `★`, 질문/답변 수가 어긋난 세션에만 `⚠ 답변 N 누락`
- 하단 페이저 `1/3`, `다음 ›` 클릭 시 `?page=2` 로 이동하고 2페이지가 뜬다
- 세션 클릭 → 우측에 대화가 ChatDock 과 **똑같은 버블**로 렌더(질문=파란 우측 정렬, 답변=테두리 좌측 + `— Hansol`)
- 평가가 있는 답변 아래에 `★★★★☆` + 의견
- 우측 상단이 아니라 **`?session=` 이 URL 에 남아** 새로고침해도 유지된다

- [ ] **Step 4: 시각 표시가 깨지지 않는지 확인 (Invalid Date 회귀)**

`formatWhen` 은 Postgres 의 `+00` 오프셋 때문에 파싱이 깨지기 쉬운 지점이다.
브라우저에서 2단 목록의 시각이 **`7. 15. 14:38` 같은 실제 시각**으로 나오는지 본다.
`Invalid Date` 가 하나라도 보이면 `formatWhen` 이 문자열을 건드리고 있는 것이다(그대로 넣어야 한다).

- [ ] **Step 5: 어긋난 세션 배지를 실제 데이터와 대조**

브라우저 육안 확인. Task 2 Step 5 probe 가 출력한 `어긋난 세션: N` 과,
전체 페이지를 넘겨보며 센 `⚠` 배지 개수가 일치해야 한다.

- [ ] **Step 6: 커밋**

```bash
git add src/app/manage/page.tsx
git commit -m "$(cat <<'EOF'
feat(manage): Ask Hansol 대화 로그 뷰어 — 세션 목록 + chat UI

- 상태는 전부 URL(?session·?page). LNB 항목·페이저는 Link 라 클라이언트 상태 0.
- 버블은 chatdock.css 전역 클래스 재사용 — 방문자 도크와 동일한 UI.
  DB role 'assistant' → CSS '--hansol' 매핑 주의.
- 페이징은 기존 resolvePage/paginate 재사용(범위 클램프 포함).
- 문답 수가 어긋난 세션에만 ⚠ 배지.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: permalink 복사 + 초기 스크롤

**Files:**
- Create: `src/app/manage/copy-permalink.tsx`
- Create: `src/app/manage/scroll-to-bottom.tsx`
- Modify: `src/app/manage/page.tsx` (두 컴포넌트 삽입)

**Interfaces:**
- Consumes: Task 3 의 `.manage-copy` CSS
- Produces:
  - `<CopyPermalink messageId={string} />`
  - `<ScrollToBottom />` — 렌더 위치에 `<div id="chat-end" />` 를 남긴다

- [ ] **Step 1: 복사 버튼 클라이언트 컴포넌트를 만든다**

Create `src/app/manage/copy-permalink.tsx`:

```tsx
"use client";

import { useState } from "react";

/**
 * 이 메시지의 permalink 를 클립보드에 복사한다.
 * 현재 URL 의 hash 만 갈아끼우므로 ?session·?page 가 저절로 보존된다 —
 * ?session 만 넣으면 링크를 받은 쪽이 LNB 1페이지를 보게 되어 정작 그 세션이 목록에 없다.
 */
export function CopyPermalink({ messageId }: { messageId: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");

  async function copy() {
    try {
      const url = new URL(window.location.href);
      url.hash = `m-${messageId}`;
      await navigator.clipboard.writeText(url.toString());
      setState("done");
    } catch {
      // 비-HTTPS 등에서 clipboard API 가 없을 수 있다. 조용히 넘기지 않고 알린다.
      setState("fail");
    }
    setTimeout(() => setState("idle"), 1500);
  }

  return (
    <button type="button" className="manage-copy" onClick={copy}>
      {state === "done" ? "복사됨" : state === "fail" ? "복사 실패" : "링크 복사"}
    </button>
  );
}
```

- [ ] **Step 2: 초기 스크롤 클라이언트 컴포넌트를 만든다**

Create `src/app/manage/scroll-to-bottom.tsx`:

```tsx
"use client";

import { useEffect } from "react";

/**
 * 세션을 열면 chat UI 관례대로 마지막 메시지가 보이게 한다.
 * hash 가 있으면(permalink 진입) 아무것도 하지 않고 브라우저 기본 스크롤에 양보한다 —
 * 두 동작이 경쟁하면 안 된다.
 *
 * flex-direction: column-reverse 로 하면 JS 0줄이지만 DOM 에 메시지를 역순으로 심어야 해
 * 스크린리더 읽기 순서와 텍스트 드래그 복사가 뒤집힌다. 접근성을 CSS 트릭과 바꾸지 않는다.
 */
export function ScrollToBottom({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    if (window.location.hash) return;
    document.getElementById("chat-end")?.scrollIntoView();
  }, [sessionId]); // 세션이 바뀌면 다시 바닥으로

  return <div id="chat-end" />;
}
```

- [ ] **Step 3: `page.tsx` 에 붙인다**

`src/app/manage/page.tsx` 상단 import 에 추가:

```tsx
import { CopyPermalink } from "./copy-permalink";
import { ScrollToBottom } from "./scroll-to-bottom";
```

`Message` 컴포넌트의 평가 표시 **아래**(닫는 `</div>` 직전)에 복사 버튼을 넣는다:

```tsx
      {(m.rating !== null || m.comment) && (
        <div className="manage-rating">
          {m.rating !== null && <Stars rating={m.rating} />}
          {m.comment && <span className="manage-rating-comment">“{m.comment}”</span>}
        </div>
      )}
      <CopyPermalink messageId={m.id} />
    </div>
  );
}
```

대화 스택 맨 끝(`chatdock-scroll-inner` 안, `messages.map` 뒤)에 스크롤 앵커를 넣는다:

```tsx
          <div className="chatdock-scroll">
            <div className="chatdock-scroll-inner">
              {messages.map((m) => (
                <Message key={m.id} m={m} />
              ))}
              <ScrollToBottom sessionId={activeId ?? ""} />
            </div>
          </div>
```

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: permalink 왕복을 브라우저로 확인**

문답이 많은 세션(Task 2 probe 가 보고한 24메시지짜리 등)을 연다.
Expected:
1. 세션을 열면 **맨 아래(최신 메시지)** 가 보인다
2. 메시지에 호버하면 `링크 복사` 가 나타난다 → 클릭하면 `복사됨` 으로 1.5초간 바뀐다
3. 복사된 주소가 `http://localhost:3000/manage?session=<id>&page=<n>#m-<messageId>` 형태다
4. 새 탭에 그 주소를 붙여넣으면 **해당 메시지로 스크롤**되고 버블에 하이라이트 테두리가 생긴다
5. 그 상태에서 새로고침해도 같은 메시지에 머문다(맨 아래로 튕기지 않는다)

- [ ] **Step 6: self-check 재실행 (회귀 확인)**

Run: `npx tsx src/lib/db/ask-hansol-manage.check.ts`
Expected: `✓ ask-hansol-manage self-check passed`

- [ ] **Step 7: 커밋**

```bash
git add src/app/manage/copy-permalink.tsx src/app/manage/scroll-to-bottom.tsx src/app/manage/page.tsx
git commit -m "$(cat <<'EOF'
feat(manage): 메시지 permalink 복사 + 세션 초기 스크롤

- permalink 는 #m-<id> fragment — 스크롤은 브라우저 기본 동작이, 하이라이트는
  CSS :target 이 한다(JS 0줄). 복사 시 현재 URL 의 hash 만 갈아끼워 ?session·?page 보존.
- 세션 진입 시 맨 아래(최신)로. hash 가 있으면 브라우저에 양보해 경쟁하지 않는다.
  column-reverse 는 DOM 역순이 스크린리더·복사 순서를 뒤집어 쓰지 않았다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (계획 작성자용 — 실행자는 건너뛴다)

**스펙 커버리지:** 목표/전제(Task 2 probe 로 실측 재확인) · 범위 결정(페이징 Task 4) · UI ChatDock 계승(Task 4) · 역할 매핑(Task 4 Step 1 주석) · Tailwind 제거(Task 3 Step 3) · 새로 만드는 것 LNB·읽기전용 평가·복사 버튼(Task 3 CSS + Task 4/5) · 레이아웃 3단(Task 3 CSS) · 1단 layout.tsx(Task 3) · 2단 항목 구성(Task 4) · 스크롤 모델(Task 3 CSS) · 초기 스크롤(Task 5) · 페이징(Task 4) · 모바일 차단(Task 3) · 라우팅(Task 4) · permalink(Task 5) · 데이터 계층 2함수(Task 2) · 노출면 분리 이유(Task 2 주석) · DB 미설정(Task 2 `getSql`) · 컴포넌트 구성(전 태스크) · 에러 처리(Task 4 빈 상태 + Task 5 복사 실패) · 테스트 mismatchLabel(Task 2) · 봇 차단(Task 1) — **누락 없음.**

**플레이스홀더 스캔:** `<코드 참조>` 가 들어간 curl 예시를 제거하고 브라우저 확인 절차로 대체했다(인증 쿠키가 필요해 curl 로 재현 불가). TBD·"적절히 처리"류 없음.

**타입 일관성:** Task 2 가 내보내는 이름(`MANAGE_SESSIONS_PER_PAGE`·`ManageSessionRow`·`ManageMessageRow`·`listAskHansolSessionsForManage`·`listAskHansolMessagesForManage`·`mismatchLabel`)과 Task 4 의 import 가 일치. Task 5 의 `<CopyPermalink messageId>`·`<ScrollToBottom sessionId>` prop 이름이 Task 4 삽입 코드와 일치. CSS 클래스는 Task 3 정의 ↔ Task 4/5 사용이 일치.

**계획 작성 중 실측으로 잡은 함정 2개(코드 작성 전에 검증함):**

1. `new Date("2026-07-15T05:38:59.703471+00")` → **Invalid Date**. Postgres `timestamptz` 텍스트를 `replace(" ", "T")` 로 ISO 화하면 오프셋 `+00` 때문에 깨진다. 원문 그대로 `new Date()` 에 넣어야 한다(Task 4 `formatWhen` 주석에 근거 포함).
2. `renderMarkdownText()` 는 `@deprecated` — `<RenderMarkdownText>` 컴포넌트를 쓴다(Global Constraints).
