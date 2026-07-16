# CLAUDE.md — hsol.info 진입점

이 저장소에서 작업하는 모든 에이전트(Claude Code / Cursor / Cowork)의 단일 진입점이다.
정책 본문은 중복 작성하지 않고 아래 두 문서를 import 해 단일 소스로 유지한다.

## 최우선 규약: Vault-First (예외 없음)

프로젝트와 조금이라도 관련된 질문이나 작업이면, 답변이나 코드 수정을 시작하기 전에
반드시 `hsol-info-blob/vault/README.md` 를 먼저 읽고 관련 디렉토리를 탐색한다.
대화 중 vault 에 없는 새 사실을 알게 되면, 답변 직후 능동적으로 vault 에 반영한다.
상세한 트리거·조회 절차·업데이트 절차·예외는 아래 import 된 `hsol-info-blob/CLAUDE.md` 의
"절대 규칙: Vault-First 조회 정책" 과 "절대 규칙: Vault 자동 업데이트 정책" 을 그대로 따른다.

## vault 편집 경로 정책 (요약)

능동 편집 허용(온톨로지 코어): `hsol-info-blob/vault/` 아래
`objects/`(people·organizations·projects·events·places·concepts·artifacts),
`object-sets/`, `_ontology/`, `action-log/YYYY/`, 사람이 직접 쓰는 `object-views/*.md`
(포트폴리오-요약, 작문-가이드 등), `datasources/README.md` 의 인덱스 메모.

직접 편집 금지(생성기·sync 도구 전용): `object-views/site-data.json`(refresh 생성기 산출물),
`datasources/<출처>/` 본문 페이로드(medium·blog·linkedin·notion 은 `sync:*` 도구가 채움),
`.newsroom-watch/`·`.onedrive-staging/` 스테이징. 이 경로들은 직접 손대지 말고 각 sync/생성 도구로 갱신한다.

## Import (단일 소스)

@hsol-info-blob/CLAUDE.md
@AGENTS.md
