# push가 거부될 때 - 세 모양, 처분이 갈린다

인라인 `AGENTS.md` §git에서 내려온 세부다.

## 1. non-fast-forward - 재시도한다

다른 세션이 먼저 올린 것이다. `git rebase dev` 후 재시도. 충돌은 **자기 티켓
범위만** 해결한다 - 남의 변경을 버려서 통과시키지 않는다. 3회 실패하면 `## 블록`으로 남기고
끝낸다.

## 2. `Working directory has staged changes` / `... unstaged changes` - 즉시 `## 블록`

재시도하지 않는다. 받는 트리(`/Users/hsol/Projects/hsol.info`, `dev` 체크아웃)가 깨끗할 때만
`updateInstead`가 push를 받는다. 더러운 건 저쪽 트리라서 **rebase도 push 대상 변경도 통하지
않는다.** 조사하지 말고, 무엇이 걸려 있는지만 본다(**읽기 전용 - 저 트리를 고치지 않는다**):

```
$ git -C /Users/hsol/Projects/hsol.info status --porcelain -uno | wc -l   # 이 숫자가 근거다
$ git -C /Users/hsol/Projects/hsol.info diff --cached --stat              # 무엇이 걸려 있나
```

원인은 둘이고 **둘 다 `## 블록`**이다. 갈리는 건 종료 방법이 아니라 블록에 적을 내용이다.

- **사람의 커밋 안 된 변경.** 사람이 그 트리를 커밋할 때까지 아무 세션도 통합할 수 없다.
- **경쟁 push가 남긴 잔해.** `updateInstead`는 **작업 트리를 먼저 갱신하고 ref를 나중에**
  잡는다. 두 세션이 동시에 밀면 ref 경쟁에서 진 쪽(`incorrect old value provided`)은 ref를
  못 얻지만 그 트리는 이미 바뀐 뒤다 - 진 쪽 내용이 staged로 남아 다음 push를 **전부** 막는다.
  사람은 아무것도 안 했다. `diff --cached`가 **이미 통합 브랜치에 있는 커밋을 되돌리는
  diff**면 이것이다. 블록에 그렇게 적어라: "경쟁 push 잔해로 보인다 - `git -C /Users/hsol/Projects/hsol.info
  restore --staged --worktree <파일>`로 풀린다." **당신이 지우지 마라. 커밋도 하지
  마라**(통합된 커밋을 되돌린다). 남의 트리에서 되돌릴 수 없는 명령을 실행하는 건 사람이 한다.

이 잔해로 세션 여럿이 헛돌고 같은 커밋이 워크트리 2곳에 2벌 생긴 사고가 실제로 있었다.
디스패처가 앞에서 막을 수 있는 건 첫 번째 원인뿐이다 - 두 번째는 게이트를 통과한 뒤에 생기고
사람의 편집과 구분되지 않는다.

## 어느 쪽이든 - 커밋 해시를 남기고 빨리 끝낸다

당신의 커밋은 브랜치에 남아 있으니 `## 블록`에 **브랜치와 커밋 해시**를 적어라. 사람이
그걸로 넣는다. **끝냈으면 빨리 끝내라** - 이 벽이 서 있는 동안 어떤 워커도 결과를 통합하지
못한다. 당신이 남긴 한 줄이 사람이 그걸 몇 초 만에 푸는 유일한 단서다.
