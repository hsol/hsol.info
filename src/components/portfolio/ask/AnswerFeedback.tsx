"use client";

import { useState } from "react";
import { submitAskHansolFeedback } from "@/lib/ask-hansol/client";
import { trackEvent } from "@/lib/analytics";

/**
 * Hansol 답변 말풍선 아래에 살짝 나오는 평가 UI.
 * - 별점(1~5)을 누르면 즉시 저장하고, 이어서 의견 입력창을 열어 코멘트를 청한다.
 * - "의견" 버튼으로 별점 없이 코멘트만 남길 수도 있다.
 * - 평소엔 반투명, 말풍선 hover 또는 상호작용 중이면 또렷하게 보인다.
 */
export function AnswerFeedback({
  sessionId,
  messageId,
}: {
  sessionId: string;
  messageId: string;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "commenting" | "done">("idle");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const engaged = phase !== "idle" || rating !== null;

  const pickRating = (value: number) => {
    if (phase === "done") return;
    setRating(value);
    trackEvent("ask_feedback_rating", { rating: value });
    // 별점은 클릭 즉시 저장(낙관적). 실패해도 UI는 계속 진행한다.
    void submitAskHansolFeedback({ sessionId, messageId, rating: value });
    setPhase("commenting");
  };

  const sendComment = async () => {
    const text = comment.trim();
    if (sending) return;
    if (!text && rating === null) return;
    setSending(true);
    trackEvent("ask_feedback_comment", { has_rating: rating !== null, has_comment: text.length > 0 });
    if (text) {
      await submitAskHansolFeedback({ sessionId, messageId, rating, comment: text });
    }
    setSending(false);
    setPhase("done");
  };

  const closeComment = () => {
    // 별점을 이미 줬으면 감사 상태로, 아니면 원위치.
    setPhase(rating !== null ? "done" : "idle");
  };

  if (phase === "done") {
    return (
      <div className="answer-feedback is-engaged is-done" data-no-translate>
        <span className="answer-feedback-thanks">평가 감사합니다{rating ? ` · ★${rating}` : ""}</span>
      </div>
    );
  }

  return (
    <div
      className={"answer-feedback" + (engaged ? " is-engaged" : "")}
      data-no-translate
      onMouseLeave={() => setHover(null)}
    >
      <div className="answer-feedback-bar">
        <span className="answer-feedback-label">이 답변, 도움이 되었나요?</span>
        <div className="answer-feedback-stars" role="radiogroup" aria-label="답변 별점">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = (hover ?? rating ?? 0) >= n;
            return (
              <button
                key={n}
                type="button"
                className={"answer-feedback-star" + (filled ? " is-filled" : "")}
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n}점`}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onClick={() => pickRating(n)}
              >
                ★
              </button>
            );
          })}
        </div>
        {phase === "idle" && (
          <button
            type="button"
            className="answer-feedback-comment-btn"
            onClick={() => setPhase("commenting")}
          >
            의견
          </button>
        )}
      </div>

      {phase === "commenting" && (
        <div className="answer-feedback-editor">
          <textarea
            className="answer-feedback-textarea"
            placeholder={
              rating !== null
                ? "이 별점을 준 이유나 더 하고 싶은 말이 있다면 들려주세요. (선택)"
                : "이 답변에 대한 의견을 남겨주세요."
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={2000}
            autoFocus
          />
          <div className="answer-feedback-editor-actions">
            <button
              type="button"
              className="answer-feedback-cancel"
              onClick={closeComment}
              disabled={sending}
            >
              {rating !== null ? "건너뛰기" : "취소"}
            </button>
            <button
              type="button"
              className="answer-feedback-send"
              onClick={() => void sendComment()}
              disabled={sending || (!comment.trim() && rating === null)}
            >
              {sending ? "보내는 중…" : "보내기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
