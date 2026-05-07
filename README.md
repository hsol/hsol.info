# hsol.github.io

Next.js(App Router) + TypeScript + Tailwind CSS로 패키징된 포트폴리오입니다.

## 명령

- `npm install`
- `npm run dev` — 로컬 개발 (기본 포트 **9999**, <http://localhost:9999>)
- `npm run build` — 정적보내기 → `out/` (GitHub Pages에 `out` 내용 배포)

## 구조

- `src/app/` — 레이아웃·페이지·`globals.css`(Tailwind + 기존 레거시 CSS import)
- `src/components/portfolio/` — 메인 앱(`PortfolioApp.tsx`), `Atoms.tsx`
- `src/data/site.ts` — 프로필 데이터 단일 소스
- `public/` — `signature.svg`, `hansol.png`, `og.png` 등 정적 자산

## 참고

`next.config.ts`에 `typescript.ignoreBuildErrors`가 켜져 있습니다. Claude Design에서 가져온 `TweaksPanel.tsx` 전체 타입을 정리한 뒤 제거하는 것을 권장합니다.
