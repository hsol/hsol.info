import { generateText, stepCountIs, type ModelMessage, type ToolSet } from "ai";

/**
 * Vercel AI Gateway 경유 LLM 호출 공용 헬퍼.
 *
 * - 모델 문자열을 `'anthropic/claude-...'` 슬러그로 넘기면 AI SDK가 자동으로
 *   Vercel AI Gateway를 통해 라우팅한다(관측성·폴백·프로바이더 교체를 Gateway에서 관리).
 * - 인증: Vercel 배포 시 OIDC(VERCEL_OIDC_TOKEN)로 자동, 로컬은 `vercel env pull`로
 *   받은 VERCEL_OIDC_TOKEN 또는 AI_GATEWAY_API_KEY 가 있으면 된다. 코드에서 키를 다루지 않는다.
 */

/** 환경변수 미설정 시 기본 모델(이미 Gateway 슬러그 형태). */
const DEFAULT_MODEL_ID = "anthropic/claude-opus-4.7";

/**
 * 모델 식별자를 AI Gateway 슬러그로 정규화한다.
 * - 이미 `provider/model` 형태면 그대로 사용.
 * - Anthropic ID(`claude-sonnet-4-6`)면 끝 `-N`을 `.N`으로 바꾸고 `anthropic/` 접두.
 *   예) `claude-sonnet-4-6` → `anthropic/claude-sonnet-4.6`
 * - 인자가 없으면 AI_GATEWAY_MODEL → ANTHROPIC_MODEL → 기본값 순으로 환경변수에서 읽는다.
 */
export function gatewayModel(raw?: string | null): string {
  const id = (
    raw ??
    process.env.AI_GATEWAY_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    DEFAULT_MODEL_ID
  ).trim();
  if (id.includes("/")) return id;
  const dotted = id.replace(/-(\d+)$/, ".$1");
  return `anthropic/${dotted}`;
}

export type ChatTextOptions = {
  /** 시스템 프롬프트(선택). */
  system?: string;
  /** 대화 메시지. */
  messages: ModelMessage[];
  /** 최대 출력 토큰. */
  maxOutputTokens: number;
  /** 모델 식별자(Gateway 슬러그 또는 Anthropic ID). 없으면 환경변수 기본값. */
  model?: string | null;
  /** 툴(있으면 multi-step 루프 자동 처리). */
  tools?: ToolSet;
  /** 툴 루프 최대 스텝 수(기본 4). */
  maxSteps?: number;
};

/**
 * 텍스트 응답을 받는다. 실패 시 null(기존 fetch 코드의 `!response.ok → null` 동작과 동일).
 * 툴을 넘기면 AI SDK가 tool_use/tool_result 루프를 maxSteps 까지 자동 수행하고
 * 최종 어시스턴트 텍스트를 반환한다.
 */
export async function chatText(opts: ChatTextOptions): Promise<string | null> {
  try {
    const { text } = await generateText({
      model: gatewayModel(opts.model),
      ...(opts.system ? { system: opts.system } : {}),
      messages: opts.messages,
      maxOutputTokens: opts.maxOutputTokens,
      ...(opts.tools
        ? { tools: opts.tools, stopWhen: stepCountIs(opts.maxSteps ?? 4) }
        : {}),
    });
    const trimmed = text.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}
