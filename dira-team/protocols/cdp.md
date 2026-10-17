# 브라우저를 띄울 때 (CDP)

인라인 `AGENTS.md` §브라우저를 띄울 때에서 내려온 세부다. 에이전트가 브라우저를 띄우는
프로젝트에서만 해당한다.

사람이 이 화면 앞에서 다른 일을 하고 있다. **크롬이 앞으로 튀어나오면 그 사람의 작업을
끊는다.**

- 기본은 헤드리스다. 스크린샷-클릭-폼 입력-팝오버 전부 CDP로 되고 창이 아예 안 뜬다:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --remote-debugging-port=<포트> --user-data-dir=/tmp/qa-<해시>/chrome-profile --window-size=1440,900 about:blank &`
- **사람의 로그인이 들어 있는 프로필에는 헤드리스를 붙이지 않는다.** 헤드리스는 키체인에 못
  붙어 쿠키를 복호화하지 못하고 **그 쿠키를 지운다** - 읽기가 아니라 파괴다. 한 번 지우면
  사람이 다시 로그인해야 한다(실측: 인증쿠키 18건 -> 0건, 다음 로드가 로그인 화면).
  그런 프로필은 아래 `open -g`로 띄우고 CDP로 몬다.
- 눈으로 볼 창이 정말 필요하면 **`open -g`로 띄운다**(창은 뜨고 포커스는 안 넘어간다):
  `open -na "Google Chrome" -g --args --remote-debugging-port=<포트> --user-data-dir=/tmp/qa-<해시>/chrome-profile --no-first-run --no-default-browser-check about:blank`
  바이너리를 직접 실행하면 앱이 활성화돼 포커스를 뺏는다 - 창이 필요할 땐 `open -g`만 쓴다.
  창이 떠 있어도 `Page.navigate`-`Runtime.evaluate`-클릭은 전부 CDP로 된다.
- 포트는 세션마다 다르게(9222는 이미 다른 프로세스가 쓰고 있을 수 있다). `--user-data-dir`은
  반드시 전용 임시 경로 - 빼면 사람이 쓰는 크롬 창에 붙는다.
- **끝나면 죽인다.** 남긴 크롬은 다음 세션의 포트를 먹는다.
