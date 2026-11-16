/**
 * AI Gateway 장시간 호출용 fetch 타임아웃. import 만 하면 적용된다(부수효과 모듈).
 *
 * generateText 는 응답이 끝나야 헤더를 받는다. 출력이 큰 site-data OVERHAUL 은 5분을 넘기는데,
 * Node fetch(undici) 기본 headersTimeout 이 300초라 "Headers Timeout Error" 로 끊기고 재시도도 같은 이유로 전부 실패한다
 * (2026-11-16 Build With Vault Refresh 43764430554). Vercel 문서의 권장대로 전역 디스패처의 타임아웃을 늘린다.
 * 값은 LLM_FETCH_TIMEOUT_MS(기본 30분)로 바꿀 수 있다.
 */
import { Agent, setGlobalDispatcher } from "undici";

const timeout = Number(process.env.LLM_FETCH_TIMEOUT_MS ?? 30 * 60_000);
setGlobalDispatcher(new Agent({ headersTimeout: timeout, bodyTimeout: timeout }));
