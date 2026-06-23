# 사이트 빌더 가이드 — 블록으로 페이지 레이아웃 짜기

이 문서는 **사이트 빌더**(CICD의 Claude, 또는 직접 손대는 사람)가 hsol.info의
페이지 레이아웃을 **데이터로** 구성하는 방법을 설명한다.

핵심 아이디어: 페이지는 **블록(block)** 을 위에서 아래로 쌓아 만든다.
콘텐츠 값(경력·카피 등)은 `site-data.json`의 기존 자리에 그대로 있고,
**layout은 "어떤 블록을 어떤 순서로 둘지"만** 기술한다.

```
{ "type": "<블록 키>", "props": { ... } }
```

---

## 1. 절대 규칙 (가드레일 — 넘을 수 없음)

`src/content/site-structure.ts`가 SSOT다. 빌더는 이 안에서만 자유롭다.

- **페이지 집합은 고정**: `home, hire, collab, builder, curious, about, architecture`.
  페이지를 추가·삭제·개명할 수 없다(라우트·sitemap·메타가 여기 묶여 있음).
- **4개 관점(hire/collab/builder/curious)과 경로는 고정.**
- 바꿀 수 있는 것: **각 페이지 안의 블록 구성·순서·props.**
- 알 수 없는 `type`이나 페이지 키는 Zod가 거부한다. 잘못되면 그 페이지는
  자동으로 코드의 **DEFAULT_LAYOUT**으로 폴백한다 → 사이트는 절대 안 깨진다.

---

## 2. 레이아웃이 정해지는 우선순위

```
LAYOUT_OVERRIDES(사람, 코드)  >  site-data.layout(빌더 생성)  >  DEFAULT_LAYOUT(코드 기본)
```

- 빌더는 `site-data.json`의 `layout.pages.<page>.blocks`를 만든다.
- 사람이 특정 페이지를 고정하고 싶으면 `src/content/layout-overrides.ts`에 적는다(그 페이지만 통째 우선).
- 둘 다 없으면 `src/content/default-layout.ts`(현재=초기 버전 레이아웃)로 렌더.

---

## 3. 블록 카탈로그

> 기계가 읽는 정본은 `registry.tsx`의 `MANIFESTS`다. 아래는 사람용 요약.

### 프레임/공통
| type | 이름 | 언제 |
|------|------|------|
| `back` | 뒤로가기 바 | 홈 제외 모든 페이지 첫 블록 |
| `plate` | 신원 플레이트 | standalone 셸에서 banner 필요 시(/architecture) |
| `viewHead` | 뷰 헤더 | back 다음 제목 영역. `persona` 주면 제목·lede 자동, 아니면 `titleText`/`lede`, `media`로 초상·다이어그램 |
| `callout` | 액션 콜아웃 | hire(JD)·collab(자문) AI 유도. `action: jd|advice` |
| `coffeeCta` | 커피챗 CTA | persona/about 마지막. `persona` 주면 해당 coffee 카피 |

### persona 섹션
| type | 이름 | 주 페이지 |
|------|------|----------|
| `strengthsSection` | 강점 3 pillars | hire |
| `pillarGridSection` | 필러 그리드(`sourceKey`로 methods/notes) | collab, curious |
| `careerSection` | 경력 타임라인(`persona`, `metaTemplate`, `note`) | hire/collab/builder |
| `hireFactsSection` | 채용 팩트 4종 | hire |
| `builderFactsSection` | 스택·도메인 + 자격증 | builder |
| `builderWritingSection` | 블로그+출판물+글 | builder |
| `ganttSection` | 간트 타임라인 | curious |

### about / home
| type | 이름 |
|------|------|
| `aboutProse` | about 줄글 6문단 |
| `aboutLinks` | 외부 프로필 + 관점 링크 |
| `homeHero` | 히어로 + 평면도 |
| `homeDoors` | 4관점 도어 |
| `homeBuilt` | 사이트 제작 방식 |
| `homeCoffee` | 홈 커피 인용 카드 |

### 탈출구
| type | 이름 | 언제 |
|------|------|------|
| `raw` | 원시 블록 | 빌더가 표현 못 하는 일회성 레이아웃을 **사람이 직접** HTML/텍스트로 |

각 블록이 받는 props·읽는 데이터는 `MANIFESTS`의 `props`/`reads` 참고.

---

## 4. 페이지 조합 규칙 (권장 패턴)

- **persona 페이지**(hire/collab/builder/curious)는 보통:
  `back` → `viewHead`(persona) → [선택: `callout`] → 섹션들… → `coffeeCta`(persona).
- **about**: `back` → `viewHead`(titleText+media:about-portrait) → `aboutProse` → `aboutLinks` → `coffeeCta`.
- **architecture**: `back` → `plate` → `viewHead`(media:architecture-mermaid).
- **home**: `homeHero` → `homeDoors` → `homeBuilt` → `homeCoffee`
  (hero·doors는 활성 키를 공유하므로 둘 다 두는 것을 권장).
- 섹션의 `num`(§ 번호)은 보이는 순서대로 매기면 깔끔하다.
- `dataSection`은 Ask Hansol의 "지금 보는 섹션" 추적에 쓰이므로 의미 있는 값을 준다.

빌더의 의도(예: "채용 담당자에겐 강점을 먼저")는 **블록 순서**로 관철한다.
콘텐츠를 바꾸려면 layout이 아니라 `site-data`의 해당 슬라이스를 고친다.

---

## 5. 작업 흐름 (빌더 → 데이터 → 사이트)

1. 빌더가 vault + 이 카탈로그를 보고 페이지별 `blocks` 배열을 짠다.
2. `layout`을 `site-data.json`에 넣는다(또는 `npm run content:layout:snapshot`으로
   현재 DEFAULT_LAYOUT+overrides를 데이터로 추출).
3. 기존처럼 콘텐츠 값을 채운다.
4. 배포 → BlockList가 layout을 읽어 렌더. 빠진/깨진 페이지는 DEFAULT로 폴백.

> Phase 2에서 `content:refresh:claude`가 layout까지 emit하도록 확장하면,
> vault 변화 → 레이아웃 변화가 CICD에서 자동으로 흐른다.

---

## 6. 새 블록 추가 (개발자)

세 군데를 함께 고친다(어긋나면 dev에서 `assertRegistryComplete`가 경고):
1. `src/content/layout-types.ts` → `BLOCK_TYPES`에 키
2. `src/components/portfolio/blocks/components.tsx` → 컴포넌트(기존 JSX를 그대로 옮겨 출력 보존)
3. `src/components/portfolio/blocks/registry.tsx` → `COMPONENTS` + `MANIFESTS`
