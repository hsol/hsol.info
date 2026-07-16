# `/manage` 관리페이지 — Sign in with Vercel 게이트 설계

- 날짜: 2026-07-16
- 상태: 승인 대기 (구현 전 최종 리뷰)

## 목표

`/manage` 이하 모든 경로를 "Sign in with Vercel"(OAuth 2.0 / OIDC) 로그인 뒤에 둔다.
나머지 사이트는 그대로 공개. 지금 범위는 **인증 게이트 + 최소 관리 셸**까지이며,
실제 관리 기능은 이후 라운드에서 추가한다(YAGNI).

## 전제 (확인됨)

- 라이브 배포는 정적 export 가 아니라 일반 Next.js 서버 배포다 → **미들웨어가 실행됨**.
  따라서 `/manage/*` 를 미들웨어 한 곳에서 게이트할 수 있다.
- Vercel "Sign in with Vercel"(GA)이 돌려주는 신원 claim 은 `sub`(유저 id)·`email`·`name`·
  `preferred_username`·`picture` 뿐이다. **팀 소속 claim/scope 는 없다**.
- 그래서 팀 소속 판정은 **우리 서버가 보유한 `VERCEL_TOKEN` 으로 팀 멤버 목록을 실시간 조회**해
  로그인 유저를 대조하는 방식으로 한다. → 이메일 allowlist 불필요, 팀에 멤버가 추가되면 자동 통과.

## 인증 방식

- Provider: Vercel IdP (Sign in with Vercel). Authorize `https://vercel.com/oauth/authorize`,
  Token `POST https://api.vercel.com/login/oauth/token`. PKCE `S256`, scope `openid email profile`
  (`offline_access` 미사용 — refresh 토큰 불필요).
- 로그인 시 **한 번만** 신원을 확인하고 우리 **자체 서명 세션 쿠키**를 발급한다.
- 통과 조건(팀 멤버십): 콜백에서 받은 ID Token 의 `sub`(유저 id)·`email` 로
  `GET https://api.vercel.com/v3/teams/{VERCEL_TEAM_ID}/members` (헤더 `Authorization: Bearer VERCEL_TOKEN`)
  를 조회해 멤버 목록의 `uid`(1순위) 또는 `email`(폴백)과 일치하면 세션 발급. 아니면 403.
  - `VERCEL_TOKEN`·`VERCEL_TEAM_ID` 는 이미 프로젝트 env(dev·preview·prod)에 존재 → 재사용.

## 흐름

```
방문자 → /manage/*  ─(middleware)→ manage_session 쿠키 유효?
  예 → 통과
  아니오 → /api/auth/authorize (state·nonce·PKCE 쿠키 심고 Vercel authorize 로 리다이렉트)
     → Vercel 동의 화면 → Allow
     → /api/auth/callback (state 검증 → code→token 교환 → id_token 의 nonce 검증
                           → 팀 멤버 조회로 sub/email 대조)
        → 팀 멤버 → manage_session 서명쿠키 발급 → 원래 /manage 경로로
        └ 아님 → /manage 접근 거부(403)
```

## 구성 요소

| 파일 | 역할 |
| --- | --- |
| `src/middleware.ts` | matcher `['/manage/:path*']`. `manage_session` 쿠키를 Web Crypto HMAC 로 로컬 검증(엣지 호환, 네트워크 호출 없음). 없거나 만료면 `/api/auth/authorize?from=<path>` 로 리다이렉트. |
| `src/lib/manage-auth.ts` | 세션 쿠키 서명/검증(HMAC-SHA256, Web Crypto만). 미들웨어+콜백 공용. payload = `{ sub, email, name, exp }`. |
| `src/app/api/auth/authorize/route.ts` | state·nonce·code_verifier 생성 → 임시 쿠키(10분) → Vercel authorize 로 리다이렉트. `from` 은 서명된 state 에 실어 보냄. |
| `src/app/api/auth/callback/route.ts` | state 검증 → token 교환 → id_token 파싱 → nonce 검증 → 팀 멤버 조회로 통과 판정 → `manage_session`(HttpOnly·Secure·SameSite=Lax·~8h) 발급 후 `from` 으로. 실패 시 거부. (Node 런타임) |
| `src/app/api/auth/signout/route.ts` | `manage_session` 제거 후 `/` 로. |
| `src/app/manage/page.tsx` | 최소 셸: "관리 콘솔" 제목 + 로그인 계정(name/email) 표시 + 로그아웃 버튼. 실제 기능 자리표시. |

## 세션 저장

스테이트리스 서명 쿠키. `base64url(payload).hmac`. DB 불필요.
→ 원격 강제 로그아웃/폐기 필요해지면 그때 Neon 세션 테이블. 지금은 과함.

## 환경변수

로컬 `.env.local` + Vercel dev·preview·prod 등록 완료:
- `NEXT_PUBLIC_VERCEL_APP_CLIENT_ID`
- `VERCEL_APP_CLIENT_SECRET`
- `MANAGE_SESSION_SECRET` — 세션 서명키(랜덤 32B).

재사용(이미 존재):
- `VERCEL_TOKEN` — 팀 멤버 조회용. (이미 프로젝트 전 타깃에 배포돼 있어 blast radius 증가 없음.
  더 좁히려면 팀 스코프 read 토큰으로 교체 — ponytail 상한.)
- `VERCEL_TEAM_ID` — 조회 대상 팀.

## 대시보드 설정 (완료)

Vercel 팀 `hsol` → Settings → Apps → "hsol.info Manage" 앱 생성. client_secret_post 방식,
콜백 URL `https://hsol.info/api/auth/callback` · `http://localhost:9999/api/auth/callback`,
scope openid·email·profile.

## CSP / 엣지 런타임

- Vercel 로 가는 건 top-level 리다이렉트, 토큰·멤버 조회는 서버 라우트의 `api.vercel.com` fetch —
  둘 다 브라우저 CSP `connect-src` 대상 아님. 현행 CSP 유지.
- 미들웨어는 엣지에서 돈다 → `manage-auth.ts` 는 Node `crypto` 대신 Web Crypto(`crypto.subtle`)만 사용.

## 검증

- 유닛 체크 1개: 세션 쿠키 서명/검증 라운드트립 + 변조 거부 + 만료 거부(보안 핵심 로직).
- OAuth·팀 게이트는 실제 로그인으로 확인(로컬 `:9999`, 이후 프리뷰/프로덕션).

## 남은 리스크

- 콜백에서 팀 멤버가 아니어서 거부될 때, 들어온 sub/email 을 서버 로그로 남겨 원인 추적 가능하게 한다.
- `sub` ↔ 멤버 `uid` 매칭이 어긋날 가능성 대비해 email 폴백을 둔다(둘 중 하나만 맞아도 통과).
