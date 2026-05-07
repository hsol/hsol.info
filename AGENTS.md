## Learned User Preferences

- Vercel CLI의 자동 링크(`vercel link --yes` 등)가 대시보드에서 쓰는 프로젝트와 다르면, 지정한 팀·프로젝트로 다시 맞추길 기대한다.

## Learned Workspace Facts

- 이 저장소의 Vercel 배포 대상 프로젝트는 팀 `hsol`의 `hsol-github-io`이다(`vercel link --scope hsol --project hsol-github-io`로 맞출 수 있다).
- `vercel env pull`은 기본이 development 환경이라, Production·Preview에만 있는 변수는 `.env.local`에 포함되지 않을 수 있다.
- Next.js 정적보내기(`output: "export"`, 산출물 `out/`)와 함께 쓸 때는 `vercel.json`에 `outputDirectory`를 중복으로 넣지 않는 편이 안전하다.
