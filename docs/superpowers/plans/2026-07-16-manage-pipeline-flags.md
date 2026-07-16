# /manage 빌드 파이프라인 플래그 편집 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 콘솔 두 번째 기능 — Edge Config `contentPipeline`(플래그 2개)을 `/manage/pipeline` 에서 읽고 토글(즉시 저장).

**Architecture:** 플래그 정의를 `src/lib/pipeline-flags.ts` 로 이관해 앱·빌드 스크립트가 공유. 서버 컴포넌트가 `loadPipelineFlags()` 로 유효 상태를 읽어 렌더하고, 클라이언트 토글이 `PATCH /api/manage/pipeline` 로 쓴다. 이 API 는 미들웨어 게이트 밖(`/api/*` 제외)이라 핸들러가 `manage_session` 을 자체 검증한다. 쓰기는 Vercel REST API 로 `contentPipeline` 전체 오브젝트를 병합해 갱신한다. 콘솔 셸을 `180px 1fr` 로 바꿔 설정 페이지가 들어올 자리를 만든다.

**Tech Stack:** Next.js 15 App Router (server components, route handlers, `force-dynamic`, Node runtime), React 19 (`"use client"` 토글), `@vercel/edge-config`(읽기) + Vercel REST API(쓰기), assert 기반 self-check(`npx tsx`).

**Spec:** `docs/superpowers/specs/2026-07-16-manage-pipeline-flags-design.md`

## Global Constraints

- **플래그는 2개다:** `contents`, `onepager`. (메모리의 "5종"은 옛 정보 — 통합됨.)
- **기존 세션 인증을 그대로 재사용:** `MANAGE_COOKIE`·`verifySession`·`process.env.MANAGE_SESSION_SECRET` (`@/lib/manage-auth`). 새 시크릿 없음.
- **`/api/manage/pipeline` 은 미들웨어 게이트 밖이다.** 핸들러 첫 단계에서 세션을 직접 검증(실패 → 401)한다. 이게 유일한 방어선.
- **env-고정 우회 쓰기를 서버가 막는다:** 쓰기 전 `loadPipelineFlags()` 로 재확인, `source[key] === "env"` 면 409.
- **부분 키만 쓰지 않는다:** 현재 `contentPipeline` raw 오브젝트를 읽어 한 키만 바꿔 **전체**를 쓴다.
- **쓰기 직후 재조회 금지:** Edge Config 는 write-후 read 가 stale 일 수 있다. 방금 쓴 값을 권위값으로 반환한다(`router.refresh()` 로 재조회하지 않는다).
- **`VERCEL_TOKEN` 은 서버 전용:** 클라이언트로 나가지 않는다. 토글은 `/api/manage/pipeline` 만 부른다.
- **빌드 스크립트 동작 불변:** `pipeline-flags.ts` 이관은 import 경로만 바뀌고 로직·동작은 그대로.
- Vercel Edge Config PATCH: `PATCH https://api.vercel.com/v1/edge-config/{storeId}/items?teamId={VERCEL_TEAM_ID}`, `Authorization: Bearer {VERCEL_TOKEN}`, 바디 `{ items: [{ operation: "create"|"update", key: "contentPipeline", value: {...} }] }`. operation 은 키 존재 여부로 분기(`upsert` 미사용).
- 커밋 메시지는 한국어(`feat(manage): …`)로, `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 로 끝낸다.
- 개발 서버는 에이전트가 띄우지 않는다(저장소 관례). 브라우저 확인이 필요한 스텝은 정적 검증으로 대체하고 리포트에 "사용자 확인 대기" 로 남긴다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `src/lib/pipeline-flags.ts` (신규=이동) | 공유 플래그 정의·`loadPipelineFlags`·`PIPELINE_FLAG_KEYS`·`parsePipelineFlagPatch` |
| `src/lib/pipeline-flags.check.ts` (신규) | `parsePipelineFlagPatch` self-check |
| `scripts/refresh-site-data-with-claude.ts` (수정) | import 경로 1줄 + 주석 |
| `src/lib/pipeline-flags-write.ts` (신규) | `parseEdgeConfigStoreId` + `writePipelineFlag` (Edge Config PATCH) |
| `src/lib/pipeline-flags-write.check.ts` (신규) | `parseEdgeConfigStoreId` self-check |
| `src/app/api/manage/pipeline/route.ts` (신규) | PATCH — 인증→검증→env재확인→쓰기→권위값 반환 |
| `src/app/manage/pipeline/page.tsx` (신규) | 서버 — `loadPipelineFlags()` → 안내 + 플래그 행 |
| `src/app/manage/pipeline/flag-toggle.tsx` (신규) | 클라이언트 — 토글, PATCH, pending·실패 처리 |
| `src/app/manage/nav.ts` (수정) | `MANAGE_NAV` 에 빌드 파이프라인 항목 1줄 |
| `src/app/manage/ask-hansol/page.tsx` (수정) | 두 패널을 단일 `.ask-hansol-split` 래퍼로 감쌈 |
| `src/styles/manage.css` (수정) | 셸 `180px 1fr` + `.ask-hansol-split` + 패널·토글 |

---

### Task 1: 플래그 정의 이관 + 바디 검증기

**Files:**
- Move: `scripts/lib/pipeline-flags.ts` → `src/lib/pipeline-flags.ts` (git mv)
- Modify: `scripts/refresh-site-data-with-claude.ts:15` (import), `:66` (주석)
- Create: `src/lib/pipeline-flags.check.ts`

**Interfaces:**
- Consumes: 없음
- Produces (Task 2·3 이 import):
  - 기존 그대로: `type PipelineFlags`, `DEFAULT_PIPELINE_FLAGS`, `loadPipelineFlags()`
  - 신규: `PIPELINE_FLAG_KEYS: (keyof PipelineFlags)[]`
  - 신규: `parsePipelineFlagPatch(body: unknown): { key: keyof PipelineFlags; value: boolean } | null`

- [ ] **Step 1: 파일 이동 (git mv)**

```bash
cd /Users/hsol/Projects/hsol.info
git mv scripts/lib/pipeline-flags.ts src/lib/pipeline-flags.ts
```

- [ ] **Step 2: 빌드 스크립트의 import·주석 갱신**

`scripts/refresh-site-data-with-claude.ts:15` 를:

```ts
import { loadPipelineFlags } from "./lib/pipeline-flags";
```

→ 로 바꾼다(같은 파일이 이미 `../src/content/...` 를 상대경로로 import 하므로 동일 패턴):

```ts
import { loadPipelineFlags } from "../src/lib/pipeline-flags";
```

같은 파일 `:66` 주석의 경로 언급도 갱신:

```ts
// (env 오버라이드·기본값은 src/lib/pipeline-flags.ts 가 담당)
```

- [ ] **Step 3: 실패하는 self-check 작성**

Create `src/lib/pipeline-flags.check.ts`:

```ts
/**
 * 공유 플래그 순수 로직 자체 점검:
 *   npx tsx src/lib/pipeline-flags.check.ts
 */
import assert from "node:assert";

import { parsePipelineFlagPatch } from "./pipeline-flags";

// 유효 입력
assert.deepStrictEqual(parsePipelineFlagPatch({ key: "contents", value: true }), {
  key: "contents",
  value: true,
});
assert.deepStrictEqual(parsePipelineFlagPatch({ key: "onepager", value: false }), {
  key: "onepager",
  value: false,
});

// 무효 입력 → null
assert(parsePipelineFlagPatch({ key: "unknown", value: true }) === null, "알 수 없는 키가 통과됨");
assert(parsePipelineFlagPatch({ key: "contents", value: "true" }) === null, "비불리언 value 가 통과됨");
assert(parsePipelineFlagPatch({ key: "contents" }) === null, "value 누락이 통과됨");
assert(parsePipelineFlagPatch(null) === null, "null 이 통과됨");
assert(parsePipelineFlagPatch("nope") === null, "문자열이 통과됨");

console.log("✓ pipeline-flags self-check passed");
```

- [ ] **Step 4: 실패 확인**

Run: `npx tsx src/lib/pipeline-flags.check.ts`
Expected: FAIL — `parsePipelineFlagPatch` 가 아직 export 되지 않아 import 에러 또는 assert 실패.

- [ ] **Step 5: `parsePipelineFlagPatch`·`PIPELINE_FLAG_KEYS` 추가**

`src/lib/pipeline-flags.ts` 의 `DEFAULT_PIPELINE_FLAGS` 정의 **바로 아래**에 추가:

```ts
/** 유효한 플래그 키 목록(런타임 검증용). DEFAULT 에서 파생 — 플래그가 늘면 자동 반영. */
export const PIPELINE_FLAG_KEYS = Object.keys(DEFAULT_PIPELINE_FLAGS) as (keyof PipelineFlags)[];

/**
 * HTTP 바디를 검증해 {key, value} 로 좁힌다. 유효하지 않으면 null.
 * 알 수 없는 키·비불리언·형태 불량을 모두 걸러 라우트가 안전하게 쓴다.
 */
export function parsePipelineFlagPatch(
  body: unknown,
): { key: keyof PipelineFlags; value: boolean } | null {
  if (!body || typeof body !== "object") return null;
  const { key, value } = body as { key?: unknown; value?: unknown };
  if (typeof value !== "boolean") return null;
  if (typeof key !== "string" || !PIPELINE_FLAG_KEYS.includes(key as keyof PipelineFlags)) {
    return null;
  }
  return { key: key as keyof PipelineFlags, value };
}
```

- [ ] **Step 6: self-check 통과 확인**

Run: `npx tsx src/lib/pipeline-flags.check.ts`
Expected: `✓ pipeline-flags self-check passed`

- [ ] **Step 7: 빌드 스크립트가 여전히 이관된 모듈을 찾는지 확인**

Run: `npx tsc --noEmit 2>&1 | rg "pipeline-flags|refresh-site-data" || echo "✓ 이관 관련 tsc 에러 없음"`
Expected: `✓ 이관 관련 tsc 에러 없음` (기존 무관 에러는 무시)

- [ ] **Step 8: 커밋**

```bash
git add src/lib/pipeline-flags.ts src/lib/pipeline-flags.check.ts scripts/refresh-site-data-with-claude.ts
git commit -m "$(cat <<'EOF'
refactor(manage): pipeline-flags 를 src/lib 로 이관 + 바디 검증기 추가

- scripts/lib/pipeline-flags.ts → src/lib/pipeline-flags.ts (git mv). 앱·빌드 스크립트가
  한 소스를 공유한다. importer 는 refresh 스크립트 한 곳(한 줄) — 그 파일은 이미
  ../src/content/* 를 상대경로로 import 하므로 동일 패턴. 로직·동작 불변.
- PIPELINE_FLAG_KEYS·parsePipelineFlagPatch 추가(관리 API 바디 검증용) + self-check.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Edge Config 쓰기 모듈

**Files:**
- Create: `src/lib/pipeline-flags-write.ts`
- Create: `src/lib/pipeline-flags-write.check.ts`

**Interfaces:**
- Consumes: `type PipelineFlags` (`./pipeline-flags`), `@vercel/edge-config` 의 `get`
- Produces (Task 3 이 import):
  - `parseEdgeConfigStoreId(connectionString: string | undefined): string | null`
  - `type WriteResult = { ok: true } | { ok: false; status: number; message: string }`
  - `writePipelineFlag(key: keyof PipelineFlags, value: boolean): Promise<WriteResult>`

- [ ] **Step 1: 실패하는 self-check 작성**

Create `src/lib/pipeline-flags-write.check.ts`:

```ts
/**
 * Edge Config 쓰기 순수 로직 자체 점검(스토어ID 파싱만 — 실제 쓰기는 라이브 API 라 제외):
 *   npx tsx src/lib/pipeline-flags-write.check.ts
 */
import assert from "node:assert";

import { parseEdgeConfigStoreId } from "./pipeline-flags-write";

assert(
  parseEdgeConfigStoreId("https://edge-config.vercel.com/ecfg_abc123?token=xyz") === "ecfg_abc123",
  "token 있는 정상 문자열에서 추출 실패",
);
assert(
  parseEdgeConfigStoreId("https://edge-config.vercel.com/ecfg_abc123") === "ecfg_abc123",
  "token 없는 정상 문자열에서 추출 실패",
);
assert(parseEdgeConfigStoreId(undefined) === null, "undefined 가 null 이 아님");
assert(parseEdgeConfigStoreId("") === null, "빈 문자열이 null 이 아님");
assert(parseEdgeConfigStoreId("nonsense") === null, "형식 불량이 null 이 아님");
assert(
  parseEdgeConfigStoreId("https://example.com/ecfg_bad") === null,
  "엉뚱한 호스트가 통과됨",
);

console.log("✓ pipeline-flags-write self-check passed");
```

- [ ] **Step 2: 실패 확인**

Run: `npx tsx src/lib/pipeline-flags-write.check.ts`
Expected: FAIL — `./pipeline-flags-write` 모듈 없음.

- [ ] **Step 3: 쓰기 모듈 작성**

Create `src/lib/pipeline-flags-write.ts`:

```ts
import { get } from "@vercel/edge-config";

import type { PipelineFlags } from "./pipeline-flags";

/**
 * /manage 전용 Edge Config 쓰기. 읽기(@vercel/edge-config get)는 read-only 라
 * 쓰기는 Vercel REST API 를 쓴다. contentPipeline 전체 오브젝트를 병합해 갱신한다.
 */

/** EDGE_CONFIG 연결문자열 경로의 `ecfg_…` 스토어ID 를 추출. 형식 불량이면 null. */
export function parseEdgeConfigStoreId(connectionString: string | undefined): string | null {
  if (!connectionString) return null;
  const m = connectionString.match(/edge-config\.vercel\.com\/(ecfg_[A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

export type WriteResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * contentPipeline 의 한 키만 바꿔 전체 오브젝트를 Edge Config 에 쓴다.
 * - 현재 raw 오브젝트를 읽어(get) 다른 키를 보존한다(env 오버라이드 적용 전 원본).
 * - 키가 이미 있으면 update, 없으면 create (Vercel batch API 는 upsert 미제공).
 */
export async function writePipelineFlag(
  key: keyof PipelineFlags,
  value: boolean,
): Promise<WriteResult> {
  const storeId = parseEdgeConfigStoreId(process.env.EDGE_CONFIG);
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!storeId || !token || !teamId) {
    return { ok: false, status: 500, message: "Edge Config 쓰기 환경 미설정" };
  }

  let current: Record<string, unknown> = {};
  let existed = false;
  try {
    const raw = (await get("contentPipeline")) as Record<string, unknown> | undefined;
    if (raw && typeof raw === "object") {
      current = raw;
      existed = true;
    }
  } catch {
    // 읽기 실패해도 create 로 쓰기를 시도한다.
  }

  const next = { ...current, [key]: value };

  const res = await fetch(
    `https://api.vercel.com/v1/edge-config/${storeId}/items?teamId=${teamId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ operation: existed ? "update" : "create", key: "contentPipeline", value: next }],
      }),
    },
  );

  if (!res.ok) {
    return { ok: false, status: res.status, message: `Edge Config 쓰기 실패 (${res.status})` };
  }
  return { ok: true };
}
```

- [ ] **Step 4: self-check 통과 확인**

Run: `npx tsx src/lib/pipeline-flags-write.check.ts`
Expected: `✓ pipeline-flags-write self-check passed`

- [ ] **Step 5: 라이브 라운드트립을 안전하게 1회 확인 (동작 무변경)**

실제 쓰기를 모킹하지 않는다. 단, **플래그를 현재 유효값 그대로 다시 써서**(idempotent) 빌드 동작을
바꾸지 않고 API 왕복만 검증한다. 루트에 임시 스크립트를 만들어 실행 후 삭제:

```bash
cat > .pipe-probe.mjs <<'EOF'
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8");
for (const k of ["EDGE_CONFIG", "VERCEL_TOKEN", "VERCEL_TEAM_ID"]) {
  const m = env.match(new RegExp(`^${k}=["']?([^"'\\n]+)`, "m"));
  if (m) process.env[k] = m[1];
}
const { writePipelineFlag } = await import("./src/lib/pipeline-flags-write.ts");
const { loadPipelineFlags } = await import("./src/lib/pipeline-flags.ts");
const before = await loadPipelineFlags();
console.log("현재 유효값:", JSON.stringify(before.flags), "출처:", JSON.stringify(before.source));
// 현재값 그대로 재기록 — 동작 변경 없음, API 왕복만 확인
const r = await writePipelineFlag("contents", before.flags.contents);
console.log("쓰기 결과:", JSON.stringify(r));
EOF
npx tsx .pipe-probe.mjs; rm -f .pipe-probe.mjs
```

Expected: `쓰기 결과: {"ok":true}`. `ok:false` 면 status·message 를 보고 원인(토큰 권한·스토어ID·teamId)을 파악한다. **`.env.local` 의 값은 리포트에 적지 말 것**(토큰 비밀).

- [ ] **Step 6: 커밋**

```bash
git add src/lib/pipeline-flags-write.ts src/lib/pipeline-flags-write.check.ts
git commit -m "$(cat <<'EOF'
feat(manage): Edge Config contentPipeline 쓰기 모듈

- writePipelineFlag: 현재 raw 오브젝트를 읽어 한 키만 바꿔 전체를 Vercel REST API 로 갱신.
  키 존재 여부로 create/update 분기(batch API 는 upsert 미제공). 다른 키 보존.
- parseEdgeConfigStoreId: EDGE_CONFIG 연결문자열에서 ecfg_ 스토어ID 추출 + self-check.
- 환경(EDGE_CONFIG·VERCEL_TOKEN·VERCEL_TEAM_ID) 미설정이면 500 반환(크래시 없음).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 쓰기 API 라우트 (인증 포함)

**Files:**
- Create: `src/app/api/manage/pipeline/route.ts`

**Interfaces:**
- Consumes:
  - `MANAGE_COOKIE`, `verifySession` (`@/lib/manage-auth`)
  - `loadPipelineFlags`, `parsePipelineFlagPatch` (`@/lib/pipeline-flags`)
  - `writePipelineFlag` (`@/lib/pipeline-flags-write`)
- Produces: `PATCH` 핸들러. 성공 시 `{ flags: PipelineFlags, locked: { contents: boolean, onepager: boolean } }` (Task 5 토글이 이 응답을 소비).

- [ ] **Step 1: 라우트 작성**

Create `src/app/api/manage/pipeline/route.ts`:

```ts
import type { NextRequest } from "next/server";

import { MANAGE_COOKIE, verifySession } from "@/lib/manage-auth";
import { loadPipelineFlags, parsePipelineFlagPatch } from "@/lib/pipeline-flags";
import { writePipelineFlag } from "@/lib/pipeline-flags-write";

// DB·Edge Config 를 런타임에 읽고 쓰므로 정적화 금지. Node 런타임(fetch·crypto·env).
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  // 1) 세션 검증 — /api/* 는 미들웨어 matcher 에서 제외돼 게이트 밖이다. 여기가 유일한 방어선.
  const token = req.cookies.get(MANAGE_COOKIE)?.value;
  const secret = process.env.MANAGE_SESSION_SECRET;
  const session = token && secret ? await verifySession(token, secret) : null;
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // 2) 바디 파싱·검증
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  const patch = parsePipelineFlagPatch(body);
  if (!patch) return Response.json({ error: "Invalid flag" }, { status: 400 });

  // 3) env-고정 재확인 — 클라이언트가 잠긴 토글을 우회해 보내도 서버가 막는다.
  const before = await loadPipelineFlags();
  if (before.source[patch.key] === "env") {
    return Response.json({ error: "고정된 플래그입니다" }, { status: 409 });
  }

  // 4) 쓰기
  const result = await writePipelineFlag(patch.key, patch.value);
  if (!result.ok) {
    return Response.json({ error: result.message }, { status: result.status });
  }

  // 5) 방금 쓴 값을 권위값으로 반환한다. Edge Config 는 write 직후 read 가 stale 일 수 있어
  //    재조회하지 않는다. 쓴 키는 env 가 아니므로(3단계 통과) 유효값 = 쓴 값. locked 는 write 와 무관.
  const flags = { ...before.flags, [patch.key]: patch.value };
  const locked = {
    contents: before.source.contents === "env",
    onepager: before.source.onepager === "env",
  };
  return Response.json({ flags, locked });
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit 2>&1 | rg "api/manage/pipeline" || echo "✓ 라우트 tsc 클린"`
Expected: `✓ 라우트 tsc 클린`

- [ ] **Step 3: 인증 거부를 정적으로 확인**

라우트가 쿠키 없이 401 을 내는지 코드로 확인한다(dev 서버 없이). 아래를 눈으로 대조:
- `verifySession` 실패·쿠키 없음 → 첫 분기에서 `401` 반환, 이후 로직(쓰기) 도달 불가.
- `parsePipelineFlagPatch` 가 `null` → `400`, 쓰기 도달 불가.
- `source[key] === "env"` → `409`, 쓰기 도달 불가.

리포트에 "실제 401/400/409 HTTP 확인은 dev 서버 필요 → 사용자 확인 대기" 로 남긴다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/manage/pipeline/route.ts
git commit -m "$(cat <<'EOF'
feat(manage): 파이프라인 플래그 쓰기 API (자체 세션 검증)

PATCH /api/manage/pipeline — 미들웨어가 /api/* 를 게이트에서 제외하므로 핸들러가
manage_session 을 직접 verifySession 으로 검증(실패 401). 바디 검증(400) →
env-고정 재확인(409) → Edge Config 쓰기 → 방금 쓴 값을 권위값으로 반환.
write 직후 stale read 를 피하려 재조회하지 않는다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 셸 리팩터 (180px 1fr) + Ask Hansol 페이지 래핑

**Files:**
- Modify: `src/styles/manage.css:5-12` (`.manage-shell` 그리드) + `.ask-hansol-split` 추가
- Modify: `src/app/manage/ask-hansol/page.tsx` (두 패널을 단일 래퍼로)

**Interfaces:**
- Consumes: 없음
- Produces: `.manage-shell` 이 `180px 1fr` (콘텐츠 영역이 단일 그리드 셀). Task 5 파이프라인 페이지가 이 `1fr` 에 단일 자식으로 들어온다.

**주의:** 셸을 `180px 1fr` 로 바꾸면 layout 의 `{children}` 은 **단일 그리드 아이템**이어야 한다.
Ask Hansol 페이지는 지금 프래그먼트로 두 div 를 반환하므로, 단일 래퍼로 감싸지 않으면 두 번째
div 가 implicit 3번째 열로 새어 레이아웃이 깨진다. **두 변경은 반드시 한 태스크에서 함께** 한다.

- [ ] **Step 1: 셸 그리드를 `180px 1fr` 로 변경**

`src/styles/manage.css:5-12` 의 `.manage-shell` 에서 `grid-template-columns` 를 바꾼다:

```css
.manage-shell {
  display: grid;
  grid-template-columns: 180px 1fr;   /* 나브 + 콘텐츠 영역. 300px 분할은 각 기능이 내부에서. */
  height: 100vh;
  overflow: hidden;          /* 각 단이 알아서 스크롤한다 */
  position: relative;
  z-index: 1;                /* body::before/::after 그리드 오버레이 위로 */
}
```

- [ ] **Step 2: Ask Hansol 전용 분할 클래스 추가**

`.manage-shell` 규칙 **바로 아래**에 추가:

```css
/* Ask Hansol 뷰어 전용 2열 분할(세션 목록 + 대화). 콘솔 셸이 아니라 이 기능의 내부 레이아웃이다. */
.ask-hansol-split {
  display: grid;
  grid-template-columns: 300px 1fr;
  min-height: 0;             /* 자식 패널이 내부 스크롤하도록 */
  overflow: hidden;
}
```

- [ ] **Step 3: Ask Hansol 페이지의 두 패널을 단일 래퍼로 감싼다**

`src/app/manage/ask-hansol/page.tsx` 의 `return (` 블록에서 프래그먼트를 래퍼 div 로 교체한다.
바꾸기 전(현재):

```tsx
  return (
    <>
      <div className="manage-list-pane">
```

바꾼 후:

```tsx
  return (
    <div className="ask-hansol-split">
      <div className="manage-list-pane">
```

그리고 같은 함수 끝의 닫는 태그를 교체한다. 바꾸기 전:

```tsx
      </div>
    </>
  );
}
```

바꾼 후:

```tsx
      </div>
    </div>
  );
}
```

(즉 `manage-chat` div 를 닫은 뒤의 `</>` → `</div>`.)

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit 2>&1 | rg "ask-hansol/page" || echo "✓ Ask Hansol 페이지 tsc 클린"`
Expected: `✓ Ask Hansol 페이지 tsc 클린`

- [ ] **Step 5: Ask Hansol 렌더 회귀를 정적으로 확인**

- `.ask-hansol-split` 이 `300px 1fr` 로 두 패널을 감싸므로 시각 결과는 리팩터 전과 동일해야 한다.
- `.manage-list-pane`·`.manage-chat` 규칙은 건드리지 않았는지 확인(그대로여야 함).
- 리포트에 "3단→래핑 후 Ask Hansol 시각 동일 여부는 브라우저 확인 필요 → 사용자 확인 대기" 로 남긴다.

- [ ] **Step 6: 커밋**

```bash
git add src/styles/manage.css src/app/manage/ask-hansol/page.tsx
git commit -m "$(cat <<'EOF'
refactor(manage): 콘솔 셸을 180px 1fr 로 — 300px 분할은 Ask Hansol 페이지 내부로

두 번째 기능(빌드 파이프라인)이 콘텐츠 영역에 들어올 수 있도록 셸에서 뷰어 전용
300px 세션목록 트랙을 걷어낸다. layout 은 나브 + 단일 콘텐츠 셀만 제공하고,
Ask Hansol 은 자기 두 패널을 .ask-hansol-split(300px 1fr) 로 감싸 내부에서 분할한다.
시각 결과는 동일.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 파이프라인 페이지 + 토글 + 나브 항목 + CSS

**Files:**
- Modify: `src/app/manage/nav.ts` (`MANAGE_NAV` 항목 추가)
- Create: `src/app/manage/pipeline/page.tsx`
- Create: `src/app/manage/pipeline/flag-toggle.tsx`
- Modify: `src/styles/manage.css` (패널·토글 규칙 추가)

**Interfaces:**
- Consumes:
  - `loadPipelineFlags` (`@/lib/pipeline-flags`)
  - Task 3 의 `PATCH /api/manage/pipeline` 응답 `{ flags, locked }`
  - Task 4 의 `.manage-shell` `180px 1fr` (단일 콘텐츠 셀)
- Produces: `/manage/pipeline` 라우트(콘솔 두 번째 기능)

- [ ] **Step 1: 나브 항목 추가**

`src/app/manage/nav.ts` 의 `MANAGE_NAV` 배열에 두 번째 항목을 넣는다:

```ts
export const MANAGE_NAV: ManageNavItem[] = [
  { href: "/manage/ask-hansol", label: "Ask Hansol 로그" },
  { href: "/manage/pipeline", label: "빌드 파이프라인" },
];
```

- [ ] **Step 2: 토글 클라이언트 컴포넌트 작성**

Create `src/app/manage/pipeline/flag-toggle.tsx`:

```tsx
"use client";

import { useState } from "react";

/**
 * 플래그 하나의 토글. 클릭 → 낙관적 반영 → PATCH → 성공 시 서버 권위값으로 확정, 실패 시 복귀.
 * router.refresh() 로 재조회하지 않는다 — Edge Config 는 write 직후 read 가 stale 일 수 있어
 * 방금 쓴 값(응답)이 가장 정확하다.
 */
export function FlagToggle({
  flagKey,
  value,
  locked,
}: {
  flagKey: string;
  value: boolean;
  locked: boolean;
}) {
  const [on, setOn] = useState(value);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    if (locked || pending) return;
    const next = !on;
    setOn(next); // 낙관적
    setPending(true);
    setFailed(false);
    try {
      const res = await fetch("/api/manage/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: flagKey, value: next }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { flags?: Record<string, boolean> };
      setOn(Boolean(data.flags?.[flagKey])); // 서버 권위값으로 확정
    } catch {
      setOn(!next); // 되돌리기
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="manage-toggle-wrap">
      {failed && <span className="manage-toggle-error">저장 실패</span>}
      {locked && <span className="manage-toggle-note">고정됨</span>}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={flagKey}
        className={"manage-toggle" + (on ? " is-on" : "") + (locked ? " is-locked" : "")}
        disabled={locked || pending}
        onClick={toggle}
      >
        <span className="manage-toggle-knob" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 파이프라인 페이지(서버) 작성**

Create `src/app/manage/pipeline/page.tsx`:

```tsx
import { loadPipelineFlags } from "@/lib/pipeline-flags";

import { FlagToggle } from "./flag-toggle";

export const dynamic = "force-dynamic";

const FLAG_META: { key: "contents" | "onepager"; label: string; desc: string }[] = [
  { key: "contents", label: "콘텐츠 파이프라인", desc: "사이트 본문·구조 진화 (G2 게이트)" },
  { key: "onepager", label: "원페이저", desc: "이력서 한 장 HTML" },
];

export default async function PipelinePage() {
  const { flags, source, edgeConfigOk } = await loadPipelineFlags();

  return (
    <div className="manage-panel">
      <div className="manage-panel-head">
        <h1 className="manage-panel-title">빌드 파이프라인</h1>
        <p className="manage-panel-note">
          이 설정은 다음 빌드/리프레시부터 적용됩니다 — 라이브 사이트가 즉시 바뀌지 않습니다.
          {!edgeConfigOk && " (Edge Config 미연결 — 기본값 표시, 수정 불가)"}
        </p>
      </div>
      <ul className="manage-flag-list">
        {FLAG_META.map((f) => {
          // env 오버라이드가 있거나 Edge Config 미연결이면 여기서 바꿀 수 없다.
          const locked = source[f.key] === "env" || !edgeConfigOk;
          return (
            <li key={f.key} className="manage-flag-row">
              <div className="manage-flag-info">
                <span className="manage-flag-label">{f.label}</span>
                <span className="manage-flag-desc">{f.desc}</span>
              </div>
              <FlagToggle flagKey={f.key} value={flags[f.key]} locked={locked} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: 패널·토글 CSS 추가**

`src/styles/manage.css` **맨 끝**에 추가:

```css
/* ── 콘텐츠 패널(빌드 파이프라인 등 설정형 기능 공통) ── */
.manage-panel { padding: 28px 32px; overflow-y: auto; }
.manage-panel-head { margin-bottom: 20px; }
.manage-panel-title { font-size: 20px; font-weight: 600; margin: 0 0 6px; color: var(--ink); }
.manage-panel-note { font-size: 12px; color: var(--ink-mute); margin: 0; line-height: 1.5; max-width: 560px; }
.manage-flag-list { list-style: none; margin: 0; padding: 0; max-width: 560px; }
.manage-flag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 0;
  border-bottom: 1px solid var(--bp-line);
}
.manage-flag-info { display: flex; flex-direction: column; gap: 3px; }
.manage-flag-label { font-size: 14px; color: var(--ink); }
.manage-flag-desc { font-size: 11.5px; color: var(--ink-faint); }

/* ── 토글 스위치 ── */
.manage-toggle-wrap { display: flex; align-items: center; gap: 8px; }
.manage-toggle {
  position: relative;
  width: 40px;
  height: 22px;
  flex: none;
  border-radius: 999px;
  border: 1px solid var(--bp-line-2);
  background: var(--bp-floor);
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.manage-toggle.is-on { background: var(--bp-bright); border-color: var(--bp-bright); }
.manage-toggle.is-locked { opacity: 0.45; }
.manage-toggle:disabled { cursor: not-allowed; }
.manage-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--ink);
  transition: transform 0.15s ease;
}
.manage-toggle.is-on .manage-toggle-knob { transform: translateX(18px); }
.manage-toggle-note { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.1em; color: var(--ink-faint); }
.manage-toggle-error { font-family: var(--mono); font-size: 9.5px; color: #ffb086; }
```

- [ ] **Step 5: 타입 체크 + 나브/리다이렉트 정합 확인**

Run: `npx tsc --noEmit 2>&1 | rg "manage/pipeline|nav.ts" || echo "✓ 파이프라인 페이지 tsc 클린"`
Expected: `✓ 파이프라인 페이지 tsc 클린`

정적 확인(코드 대조):
- `MANAGE_NAV` 가 2개 항목 → 2단 나브에 "빌드 파이프라인" 추가, `nav-link.tsx` 의 `usePathname`
  exact match 로 `/manage/pipeline` 에서 활성.
- `/manage` 리다이렉트 대상은 여전히 `MANAGE_NAV[0]` = Ask Hansol 로그(변화 없음).
- 리포트에 "3열→토글 렌더·저장 왕복은 브라우저 확인 필요 → 사용자 확인 대기" 로 남긴다.

- [ ] **Step 6: self-check 회귀 확인**

Run: `npx tsx src/lib/pipeline-flags.check.ts && npx tsx src/lib/pipeline-flags-write.check.ts`
Expected: 두 줄 모두 `✓ … self-check passed`

- [ ] **Step 7: 커밋**

```bash
git add src/app/manage/nav.ts src/app/manage/pipeline/page.tsx src/app/manage/pipeline/flag-toggle.tsx src/styles/manage.css
git commit -m "$(cat <<'EOF'
feat(manage): 빌드 파이프라인 플래그 편집 페이지 — 콘솔 두 번째 기능

- /manage/pipeline: loadPipelineFlags() 로 유효 상태 렌더. 각 플래그를 '변경 가능/고정'
  으로만 표시(출처 메커니즘 감춤). env 오버라이드·Edge Config 미연결이면 토글 잠금.
- 토글(클라이언트): 낙관적 반영 → PATCH /api/manage/pipeline → 성공 시 서버 권위값 확정,
  실패 시 복귀 + '저장 실패'. write 직후 stale read 회피로 재조회 안 함.
- MANAGE_NAV 에 항목 1줄 추가 → 2단 나브·활성 표시 자동. /manage 리다이렉트 대상 불변.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (계획 작성자용 — 실행자는 건너뛴다)

**스펙 커버리지:** 목표(Task 3·5) · 플래그 2개(Global Constraints) · 표시 모델 변경가능/고정(Task 5 page) · env-고정 한계(스펙에 기록, 코드는 source==="env" 로 판정 Task 3·5) · 플래그 이관(Task 1) · 읽기 재사용(Task 3·5) · 쓰기 함수(Task 2) · 부분키 금지·병합(Task 2) · 쓰기 API+자체인증(Task 3) · env 재확인 409(Task 3) · stale read 회피(Task 3·5) · 라우트·나브(Task 5) · 셸 180px 1fr + Ask Hansol 분할 이동(Task 4) · 패널 내용·안내문구(Task 5) · 컴포넌트 표 전부 · 에러 처리 401/400/409/500·미연결 잠금(Task 3·5) · 테스트 parseEdgeConfigStoreId·parsePipelineFlagPatch(Task 1·2) · 보안 메모(자체 인증·토큰 서버전용) — **누락 없음.**

**스펙과의 의도적 차이 1건:** 스펙 쓰기-흐름 5단계는 "loadPipelineFlags() 재호출로 유효상태 재계산" 이라 적었으나, 계획은 **재조회하지 않고 방금 쓴 값을 반환**한다. 이유: `@vercel/edge-config` 의 `get()` 은 같은 호출 안에서 메모이즈되고 write 직후 read 가 stale 이라, 재조회하면 옛값을 돌려줄 수 있다. 쓴 키는 env-비고정(3단계 통과)이라 유효값 = 쓴 값이고, locked 는 env 출처라 write 와 무관하므로 결과는 동일하되 stale 위험만 제거된다. 정확성 향상이며 스코프 변화 없음.

**플레이스홀더 스캔:** TBD·TODO·"적절히" 없음. 브라우저 확인은 저장소 관례(dev 서버 미기동)상 정적 검증으로 대체하고 리포트에 "사용자 확인 대기" 로 남기도록 각 태스크에 명시.

**타입 일관성:** `PipelineFlags`·`loadPipelineFlags`·`parsePipelineFlagPatch`(Task 1) ↔ Task 3 import 일치. `parseEdgeConfigStoreId`·`writePipelineFlag`·`WriteResult`(Task 2) ↔ Task 3 import 일치. `FlagToggle` prop `{flagKey,value,locked}`(Task 5) ↔ page 호출 일치. API 응답 `{flags,locked}`(Task 3) ↔ 토글 소비(Task 5) 일치. CSS 변수(`--bp-bright`·`--bp-line-2`·`--bp-floor`·`--ink`·`--ink-mute`·`--ink-faint`·`--mono`) 모두 main.css :root 존재.
