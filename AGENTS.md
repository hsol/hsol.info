## Learned User Preferences

- 일반 대화 응답에서는 저장소 안의 소스 경로나 파일명을 직접 나열하지 말고, 모듈·기능·역할로만 짚길 기대한다(코드 인용 블록이 꼭 필요한 경우는 예외).
- Vercel CLI의 자동 링크(`vercel link --yes` 등)가 대시보드에서 쓰는 프로젝트와 다르면, 지정한 팀·프로젝트로 다시 맞추길 기대한다.
- 포트폴리오 상세에서 Ask Hansol(ChatDock)은 데스크톱에서는 기본으로 열리되, 모바일 뷰포트(약 `max-width: 768px`)에서는 기본으로 닫힌 상태를 기대한다.
- Ask Hansol 답변에는 "vault에서 확인", "Blob에서", "운영 매뉴얼상…"처럼 내부 출처·저장소 이름·조회 과정을 드러내는 표현을 넣지 않길 기대한다.
- 가족·배우자·결혼 여부 등은 vault에 적혀 있으면 Ask 답변에 말해도 되고, 운영 매뉴얼의 "외부 비공개" 문구만으로 vault에 있는 사실을 숨기거나 거절하는 답은 원하지 않는다.
- ChatDock이 열릴 때는 플로팅 ASK 버튼을 숨기고(투명 영역의 × FAB로 바꾸지 않음), 닫기는 헤더의 ×만 쓰길 기대한다.
- Ask Hansol(특히 드래그·선택 텍스트로 이어지는 질문)은 과친한 칭찬·환호로 시작하는 도입부 없이 담백하게 본론 위주로 답하길 기대한다. 쉬운 풀이식 설명보다는 포트폴리오 본문만으로 부족할 때 보완하는 수준의 밀도를 선호한다.

## Learned Workspace Facts

- 이 저장소의 Vercel 배포 대상 프로젝트는 팀 `hsol`의 `hsol-info`이다(`vercel link --scope hsol --project hsol-info`로 맞출 수 있다).
- `vercel env pull`은 기본이 development 환경이라, Production·Preview에만 있는 변수는 `.env.local`에 포함되지 않을 수 있다.
- Next.js 정적보내기(`output: "export"`, 산출물 `out/`)와 함께 쓸 때는 `vercel.json`에 `outputDirectory`를 중복으로 넣지 않는 편이 안전하며, 이 모드에서는 `app/api/*`가 배포되지 않아 `/api/*`가 404가 될 수 있다.
- 정적 export 빌드에서는 `dynamic = "force-dynamic"` 같은 강제 동적 페이지를 쓰면 export가 실패한다. `getSiteData()`는 Blob → `hsol-info-blob/vault/object-views/site-data.json` → 커밋된 `src/data/site.ts`의 `HSOL_DATA` 순으로 폴백한다.
- GitHub Actions 워크플로 `build-with-vault-refresh.yml`은 체크아웃된 서브모듈 vault를 그대로 쓴다. `content:refresh:claude`로 사이트 데이터 JSON을 갱신한 뒤, **부모 저장소의 현재 커밋 SHA 등**을 `vault/object-views/` 아래 전용 JSON에 매 실행 기록해 vault 트리가 항상 한 번은 바뀌게 한다(코드만 바뀐 푸시에서도 Blob·generate 쪽이 vault 변경을 감지할 수 있게). 이어서 서브모듈 커밋을 만들어 `hsol-info-blob` 원격 `main` 등(워크플로 `SUBMODULE_BRANCH`)으로만 푸시한다. **vault ↔ Vercel Blob 중 업로드는 오직** `hsol-info-blob` 저장소의 `Sync vault to Vercel Blob` 워크플로만 한다(저장소 시크릿 `BLOB_READ_WRITE_TOKEN` 필요). **Blob → 로컬 vault 내려받기**도 같은 저장소에서 `npm run sync:blob:pull`로만 한다. `GIT_DIFF_BASE_SHA`/`GIT_DIFF_HEAD_SHA`는 refresh 스킵 판단 등에 쓴다. `content:refresh:claude` 실패 시 `generated/content-refresh-failures/`를 아티팩트로 올린다.
- `scripts/refresh-site-data-with-claude.ts`는 `ANTHROPIC_MAX_TOKENS`(기본 64000)로 출력 상한을 두며, 응답이 `stop_reason=max_tokens`로 잘리면 파싱하지 않고 실패·덤프한다. 실패 본문은 기본적으로 `generated/content-refresh-failures/`에 쓴다. `tool_use` 페이로드에서 문자열로 감긴 JSON·루트 래핑(`data`/`siteData` 등)·모델이 자주 내는 대체 키 형태는 정규화·매핑 후 스키마 검증을 다시 시도한다.
- 서브모듈 저장소의 Blob→vault 풀 스크립트는 `.DS_Store`(및 `.DS-Store` 파일명)를 내려받지 않고 로컬 정리 시에도 제외한다.
- Ask Hansol API(`src/app/api/ask-hansol/route.ts`)는 시스템 프롬프트에 `vault/README.md`(vault 탐색·읽기 절차용 지침이며 답변 사실을 채우는 발췌 문서가 아님)와 `vault/object-views/AI-클론-운영-매뉴얼.md`를 넣고, Blob 토큰은 `ASK_HANSOL_BLOB_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `BLOB_READ_TOKEN` 순으로 쓴다. Claude는 `blob_lookup`으로 본문 근거 문서를 추가 조회한다.
- Ask Hansol API가 서버 함수로 실제 배포되는 환경에서는 세션 히스토리 GET이 DB를 읽으므로 `export const dynamic = "force-dynamic"`으로 두고, 클라이언트 히스토리·질문 `fetch`에는 `cache: "no-store"`를 쓴다(`force-static`이면 GET이 빌드·CDN에 고정되어 대화 목록이 비어 보일 수 있다). 순수 정적 export만 쓰는 빌드와는 타깃이 다를 수 있다.
- Ask Hansol 답변 URL 처리는 `src/lib/ask-hansol/answer-linkify.ts`에서 마크다운·괄호 등을 평문으로 정리한 뒤 클라이언트에서 분리 렌더하며, `https`/`http`뿐 아니라 `www.` 접두·스킴 없는 호스트 형태·`mailto:` 등도 링크로 인식한다.
