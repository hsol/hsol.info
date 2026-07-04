import { NextResponse } from "next/server";
import { isValidAskHansolSessionId } from "@/lib/ask-hansol/shared";
import {
  isAskHansolFeedbackDbConfigured,
  upsertAskHansolFeedback,
} from "@/lib/db/ask-hansol-feedback";

/** 세션별 평가를 DB에 즉시 쓰므로 정적 캐시하지 않는다. */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sessionId?: unknown;
      messageId?: unknown;
      rating?: unknown;
      comment?: unknown;
    };

    const sessionId =
      typeof body.sessionId === "string" && isValidAskHansolSessionId(body.sessionId)
        ? body.sessionId
        : null;
    const messageId =
      typeof body.messageId === "string" && /^[0-9]+$/.test(body.messageId)
        ? body.messageId
        : null;
    const rating =
      typeof body.rating === "number" && Number.isInteger(body.rating) ? body.rating : null;
    const comment = typeof body.comment === "string" ? body.comment : null;

    if (!sessionId || !messageId) {
      return NextResponse.json({ error: "sessionId and messageId are required" }, { status: 400 });
    }
    if (rating === null && !(comment && comment.trim())) {
      return NextResponse.json({ error: "rating or comment is required" }, { status: 400 });
    }
    if (!isAskHansolFeedbackDbConfigured()) {
      // DB 미설정 환경에서도 UI가 깨지지 않도록 조용히 성공 처리(저장은 안 됨).
      return NextResponse.json({ ok: true, stored: false });
    }

    const stored = await upsertAskHansolFeedback(sessionId, messageId, rating, comment);
    return NextResponse.json({ ok: true, stored });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
