# `/manage` 콘솔 — 빌드 파이프라인 플래그 편집 설계

- 날짜: 2026-07-16
- 상태: 승인 대기 (구현 전 최종 리뷰)
- 선행: `2026-07-16-manage-ask-hansol-log-viewer-design.md` (콘솔 셸 + 첫 기능)

## 목표

콘솔의 **두 번째 관리 기능**. 지금 Vercel 대시보드에서만 만지는 콘텐츠 빌드 파이프라인
플래그를 `/manage` 안에서 읽고 토글한다. Edge Config 키 `contentPipeline` 을 직접 편집한다.

## 전제 (실측으로 확인됨, 2026-07-16)

- **플래그는 2개다** (메모리의 "5종"은 통합 전 옛 정보). `scripts/lib/pipeline-flags.ts`:
  - `contents: boolean` — 콘텐츠 파이프라인 전체(G2 게이트 → siteData 본문 + 구조 진화 → layout·composition). 옛 siteData·research·layout·composition 을 하나로 합친 것.
  - `onepager: boolean` — 원페이저(이력서 한 장 HTML). `contents` 와 독립.
- Edge Config 키: `contentPipeline` = `{ contents, onepager }` (객체).
- 우선순위: **env 오버라이드 ?? Edge Config ?? 기본값(둘 다 true)**.
- 이 플래그는 **빌드 시점에만** 읽힌다(리프레시 스크립트, GitHub Actions). 토글해도 라이브
  사이트가 즉시 바뀌지 않고 **다음 빌드/리프레시부터** 적용된다.
- 읽기 SDK `@vercel/edge-config` 의 `get()` 은 **읽기 전용**. 쓰기는 Vercel REST API.
- 이미 존재하는 것(재사용): `EDGE_CONFIG`(연결문자열, 경로에 `ecfg_…` 스토어ID 포함),
  `VERCEL_TOKEN`·`VERCEL_TEAM_ID`(OAuth 팀 검증이 쓰는 것과 동일), `@vercel/edge-config` 의존성.
- 앱은 정적 export 가 아니라 서버 함수로 배포된다 → API 라우트·서버 렌더 가능.

## 범위

**한다:** 두 플래그의 유효 상태 표시 + 토글 편집(즉시 저장).
**하지 않는다 (YAGNI):** 플래그 추가/삭제, 빌드/리프레시 즉시 트리거(강제 리프레시는 명시
요청 시에만 — 별도 관례), env 오버라이드 편집(env 는 CI 비상 레버라 UI 밖), 변경 이력·감사 로그.

## 표시 모델 — "변경 가능 / 고정"

출처(env/edge-config/default)라는 내부 메커니즘 이름은 **감춘다**. 각 플래그를 다음 둘 중
하나로만 보여준다:

- **변경 가능** — `source` 가 `edge-config` 또는 `default`. 토글로 켜고 끈다(→ Edge Config 쓰기).
- **고정(변경 불가)** — `source` 가 `env`. env 오버라이드가 Edge Config 를 이기므로 여기서
  토글해도 무의미하다. 토글을 disabled 로 두고 "고정됨" + 현재 유효값만 표시.

### 한계 (정직하게 명시)

"고정" 은 **이 페이지 런타임(Vercel)의 `process.env`** 에 오버라이드가 있을 때만 판정된다.
실제 빌드는 GitHub Actions 에서 도므로, **CI 에만** 걸린 오버라이드는 이 페이지가 보지 못한다.
다만 env 오버라이드는 상시 설정이 아니라 비상용(`CONTENT_PIPELINE=…` 한 줄 강제)이라 실무에서
어긋날 일은 드물다. 이 판정은 "이 환경이 계산하는 유효 상태" 라는 의미로 일관되게 쓴다.

## 데이터 계층

### 플래그 정의를 `src/lib/pipeline-flags.ts` 로 이관 (DRY)

지금 `scripts/lib/pipeline-flags.ts` 에 있는 정의(`PipelineFlags`·`DEFAULT_PIPELINE_FLAGS`·
`ENV_NAMES`·`coerceBool`·`envOverride`·`loadPipelineFlags`)를 `src/lib/pipeline-flags.ts` 로
옮긴다(파일 통째 이동 = `git mv`).

- **importer 는 단 하나**: `scripts/refresh-site-data-with-claude.ts:15` 이 `loadPipelineFlags`
  한 심볼만 가져온다(전수 확인함). `import … from "./lib/pipeline-flags"` →
  `from "../src/lib/pipeline-flags"` 한 줄만 바꾼다. 같은 파일 66행의 경로 언급 주석도 갱신.
- **이건 새 패턴이 아니다.** 그 스크립트는 이미 `../src/content/default-layout`·
  `../src/content/site-structure` 등을 상대경로로 import 하고 있다(12–14행). 즉 스크립트가
  `src/` 를 `../src/…` 로 참조하는 건 기존 관례이고, tsx 실행에서 이미 검증돼 있다.
- 앱은 `@/lib/pipeline-flags` 로 같은 파일을 쓴다. 로직·동작 불변.

tsconfig `include` 가 `**/*.ts` 라 두 위치 모두 같은 TS 프로젝트 안이고, `@/` 는 `src/` 만
가리키므로 공유 소스는 `src/` 에 두는 게 옳다.

### 읽기 — 기존 `loadPipelineFlags()` 재사용

관리 페이지(서버 컴포넌트)가 호출한다. 이미 `{ flags, source, edgeConfigOk }` 를 돌려주므로
각 플래그를 `source === "env" ? "locked" : "editable"` 로 변환해 렌더한다. 런타임에 `EDGE_CONFIG`
가 없거나 읽기 실패하면 `edgeConfigOk === false` 이고 env/기본값으로 폴백(빌드와 동일 동작).

### 쓰기 — 새 함수 `writePipelineFlag`

`src/lib/pipeline-flags-write.ts` (앱 전용 — 빌드 스크립트는 쓰지 않는다).

```ts
/** contentPipeline 의 한 키만 바꿔 전체 오브젝트를 Edge Config 에 upsert. 성공 여부 반환. */
export async function writePipelineFlag(
  key: keyof PipelineFlags,
  value: boolean,
): Promise<{ ok: true } | { ok: false; status: number; message: string }>;
```

- 스토어ID: `EDGE_CONFIG` 연결문자열에서 `ecfg_[A-Za-z0-9]+` 추출.
- 엔드포인트: `PATCH https://api.vercel.com/v1/edge-config/{storeId}/items?teamId={VERCEL_TEAM_ID}`,
  헤더 `Authorization: Bearer ${VERCEL_TOKEN}`.
- **부분 키만 쓰지 않는다.** 현재 `contentPipeline` 을 읽어(`get`) 그 키만 바꿔 병합한 뒤
  전체 오브젝트를 upsert 한다 — 부분 쓰기로 다른 키가 사라지는 것을 막는다.
  ```json
  { "items": [{ "operation": "upsert", "key": "contentPipeline", "value": { "contents": true, "onepager": false } }] }
  ```
- 필요한 env(`EDGE_CONFIG`·`VERCEL_TOKEN`·`VERCEL_TEAM_ID`) 중 하나라도 없으면 쓰기 불가 →
  `{ ok:false, status:500, message:"Edge Config 쓰기 환경 미설정" }`.

## 쓰기 API 라우트 + 인증

`src/app/api/manage/pipeline/route.ts` — `PATCH` 핸들러. `dynamic = "force-dynamic"`, Node 런타임.

**미들웨어가 `/api/*` 를 게이트에서 제외하므로(`matcher: /((?!_next/|api/|.*\.).*)`) 이 라우트는
게이트 밖이다. 핸들러가 스스로를 지키는 유일한 방어선이다.**

흐름:

1. **세션 검증** — `req.cookies.get(MANAGE_COOKIE)?.value` → `verifySession(token, MANAGE_SESSION_SECRET)`.
   실패 → `401`. (미들웨어·layout 이 쓰는 것과 **완전히 동일한** 쿠키·함수·시크릿. 새 시크릿 없음.
   팀 멤버십은 로그인 시 OAuth 콜백에서 이미 검증돼 세션에 담겼으므로 여기서 Vercel API 재호출 불필요.)
2. **바디 파싱** — `{ key: "contents" | "onepager", value: boolean }`. 한 번에 한 플래그.
   알 수 없는 키·비불리언 → `400`.
3. **env-고정 재확인** — 서버에서 `loadPipelineFlags()` 재호출, 그 키의 `source === "env"` 면
   `409`. 클라이언트가 잠긴 토글을 우회해 보내도 서버가 막는다. UI 잠금은 편의, 진짜 방어는 여기.
4. **쓰기** — `writePipelineFlag(key, value)`. 실패 → 그 함수의 status 를 그대로 응답.
5. **응답** — 갱신된 유효 상태를 다시 계산해(`loadPipelineFlags()`) JSON 으로 반환:
   `{ flags: {contents, onepager}, locked: {contents:boolean, onepager:boolean} }`.
   클라이언트는 이 값으로 화면을 맞추거나 `router.refresh()` 로 서버 재렌더를 유도한다.

## UI

### 라우트 · 나브

새 라우트 `/manage/pipeline`. `src/app/manage/nav.ts` 의 `MANAGE_NAV` 에 **한 줄** 추가:

```ts
export const MANAGE_NAV: ManageNavItem[] = [
  { href: "/manage/ask-hansol", label: "Ask Hansol 로그" },
  { href: "/manage/pipeline",   label: "빌드 파이프라인" },
];
```

이것만으로 2단 나브에 항목이 뜨고, 활성 표시(`nav-link.tsx` 의 `usePathname` exact match)가
자동 적용되며, `/manage` 는 여전히 첫 항목으로 리다이렉트된다.

### 셸 구조 조정 (이 기능이 정당화하는 리팩터)

현 `.manage-shell` 은 `grid-template-columns: 180px 300px 1fr` 3단 고정인데, `300px`(세션 목록)은
**Ask Hansol 뷰어 전용** 개념이지 콘솔 셸이 가질 게 아니다. 설정 패널은 이 틀에 안 맞는다.

- `.manage-shell` → `grid-template-columns: 180px 1fr` (나브 + 콘텐츠 영역).
- Ask Hansol 페이지: 세션 목록/대화의 `300px 1fr` 분할을 **페이지 안** 래퍼(`.ask-hansol-split`
  같은)로 옮긴다. layout 은 나브만, 각 기능이 콘텐츠 영역 내부 레이아웃을 스스로 결정한다.
- 빌드 파이프라인 페이지: `1fr` 콘텐츠 영역에 일반 설정 패널을 렌더.

기존 Ask Hansol 렌더 결과는 시각적으로 동일해야 한다(분할 위치만 layout→page 로 이동).

### 파이프라인 페이지 내용

- 상단 안내: "이 설정은 다음 빌드/리프레시부터 적용됩니다 — 라이브 사이트가 즉시 바뀌지 않습니다."
- 플래그별 행(라벨·설명·토글):
  - `contents` — "콘텐츠 파이프라인 · 사이트 본문·구조 진화(G2 게이트)"
  - `onepager` — "원페이저 · 이력서 한 장 HTML"
- **변경 가능** 행: 상호작용 토글(클라이언트). 클릭 → `PATCH /api/manage/pipeline` →
  성공 시 `router.refresh()` 로 서버 값 재반영, 요청 중 비활성, 실패 시 직전 값 복귀 + "저장 실패".
- **고정** 행: 토글 disabled + "고정됨" 표시 + 현재 유효값.

### 컴포넌트

| 파일 | 역할 | 종류 |
| --- | --- | --- |
| `src/app/manage/pipeline/page.tsx` | `loadPipelineFlags()` → 안내 + 플래그 행 렌더 | 서버 |
| `src/app/manage/pipeline/flag-toggle.tsx` | 토글 스위치, PATCH 호출, pending·실패 처리 | **클라이언트** |
| `src/app/api/manage/pipeline/route.ts` | 세션 검증 → env-고정 재확인 → 쓰기 → 유효상태 반환 | 서버(Node) |
| `src/lib/pipeline-flags.ts` | (신규 = `scripts/lib/pipeline-flags.ts` 를 `git mv`) 공유 정의·`loadPipelineFlags` | 공유 |
| `src/lib/pipeline-flags-write.ts` | Edge Config PATCH 쓰기 | 앱 |
| `scripts/refresh-site-data-with-claude.ts` | (수정) import 경로 한 줄 + 주석 | 빌드 |
| `src/styles/manage.css` | `.manage-toggle` 등 + 셸 그리드 `180px 1fr` | — |

`flag-toggle.tsx` prop: `{ flagKey: "contents"|"onepager"; value: boolean; locked: boolean }`.

## 에러 처리

- 세션 무효 → `401`, 클라이언트는 로그인 만료로 간주(새로고침 유도).
- 잘못된 바디 → `400`.
- env-고정 키 쓰기 시도 → `409`, 토글 복귀 + "고정된 플래그입니다".
- Edge Config 쓰기 환경 미설정/ API 실패 → `500`/해당 status, 토글 복귀 + "저장 실패".
- 읽기 시 `EDGE_CONFIG` 없음 → 페이지는 env/기본값으로 렌더(크래시 없음), 안내에 "Edge Config
  미연결 — 기본값 표시" 문구. 이 경우 모든 토글을 잠근다(쓸 대상이 없으므로).

## 테스트

Ponytail 원칙 — 순수/분기 로직에만 검증. 실제 Edge Config 쓰기는 라이브 API 라 모킹하지 않고
로컬에서 한 번 왕복으로 눈 확인.

- `src/lib/pipeline-flags-write.check.ts` (`npx tsx …`): 스토어ID 추출
  `parseEdgeConfigStoreId("https://edge-config.vercel.com/ecfg_abc?token=x")` → `"ecfg_abc"`,
  형식 불량 → `null`. 이 파싱이 틀리면 쓰기가 조용히 엉뚱한 스토어로 가거나 실패한다.
- 이관된 `loadPipelineFlags` 의 우선순위 로직은 기존 코드라 별도 신규 테스트 없음(동작 불변).

## 보안 메모

- 이 페이지·API 는 관리 세션 뒤에 있다(API 는 핸들러 자체 검증). 팀 멤버만 빌드 플래그를 바꾼다.
- `VERCEL_TOKEN` 은 서버에서만 쓰이고 클라이언트로 나가지 않는다. 토글은 `/api/manage/pipeline`
  만 호출하고, Vercel API 직접 호출은 서버가 대행한다.
- 쓰기는 빌드 동작만 바꾼다(라이브 즉시 영향 없음). 되돌리기는 다시 토글하면 된다.
- `/api/manage/*` 도 봇 노출 대상이 아니다 — robots·sitemap 에 없고, 게이트(자체 검증) 뒤다.
  (미들웨어 `X-Robots-Tag` 는 `/manage` 페이지에 붙지만 `/api/*` 는 matcher 제외라 안 붙는다.
  API 는 인덱싱될 HTML 을 내지 않으므로 문제되지 않는다.)
