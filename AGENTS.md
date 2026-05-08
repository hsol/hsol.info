## Learned User Preferences

- Vercel CLI의 자동 링크(`vercel link --yes` 등)가 대시보드에서 쓰는 프로젝트와 다르면, 지정한 팀·프로젝트로 다시 맞추길 기대한다.

## Learned Workspace Facts

- 이 저장소의 Vercel 배포 대상 프로젝트는 팀 `hsol`의 `hsol-info`이다(`vercel link --scope hsol --project hsol-info`로 맞출 수 있다).
- `vercel env pull`은 기본이 development 환경이라, Production·Preview에만 있는 변수는 `.env.local`에 포함되지 않을 수 있다.
- Next.js 정적보내기(`output: "export"`, 산출물 `out/`)와 함께 쓸 때는 `vercel.json`에 `outputDirectory`를 중복으로 넣지 않는 편이 안전하며, 이 모드에서는 `app/api/*`가 배포되지 않아 `/api/*`가 404가 될 수 있다.
- 정적 export 빌드에서는 `dynamic = "force-dynamic"` 같은 강제 동적 페이지를 쓰면 export가 실패한다. `getSiteData()`는 Blob → `hsol-info-blob/vault/object-views/site-data.json` → 커밋된 `src/data/site.ts`의 `HSOL_DATA` 순으로 폴백한다.
- GitHub Actions 워크플로 `build-with-vault-refresh.yml`은 `hsol-info-blob/vault`와 `hsol-info-blob/.blob-sync-state.json`을 `actions/cache`로 복원해 Blob 풀싱크를 줄이고, `content:refresh:claude` 실패 시 `generated/content-refresh-failures/`를 아티팩트로 올린다.
- `scripts/refresh-site-data-with-claude.ts`는 `ANTHROPIC_MAX_TOKENS`(기본 64000)로 출력 상한을 두며, 응답이 `stop_reason=max_tokens`로 잘리면 파싱하지 않고 실패·덤프한다. 실패 본문은 기본적으로 `generated/content-refresh-failures/`에 쓴다.
- `scripts/pull-blob-to-submodule.mjs`는 `hsol-info-blob` 동기화 시 `.DS_Store`(및 `.DS-Store` 파일명)를 내려받지 않고 로컬 수집에서도 제외한다.
- Ask Hansol API(`src/app/api/ask-hansol/route.ts`)는 Blob 조회 시 `vault/README.md`와 `vault/object-views/AI-클론-운영-매뉴얼.md`를 기본 컨텍스트에 넣고, 토큰은 `ASK_HANSOL_BLOB_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `BLOB_READ_TOKEN` 순으로 쓴다. Claude는 필요할 때 `blob_lookup` 도구로 Blob 문서를 추가 조회한다.
