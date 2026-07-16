import Link from "next/link";

import { RenderMarkdownText } from "@/components/portfolio/ask/render-markdown-text";
import {
  MANAGE_SESSIONS_PER_PAGE,
  listAskHansolMessagesForManage,
  listAskHansolSessionsForManage,
  mismatchLabel,
  type ManageMessageRow,
} from "@/lib/db/ask-hansol-manage";
import { paginate, resolvePage } from "@/lib/pagination";
import "@/styles/legacy/chatdock.css";

import { CopyPermalink } from "./copy-permalink";
import { ScrollToBottom } from "./scroll-to-bottom";

export const dynamic = "force-dynamic";

/**
 * 타임스탬프 → `2026.07.14 17:32:05` (KST). 세션 목록·메시지 상세 공통.
 * sv-SE 로케일이 `2026-07-14 17:32:05`(ISO 유사)를 주므로 대시만 점으로 바꾼다.
 * (ko-KR 은 `2026. 07. 14.`처럼 점·공백이 섞여 원하는 모양이 안 나온다.)
 *
 * 문자열을 그대로 `new Date()` 에 넣는다 — 공백을 `T` 로 바꾸면 `+00` 오프셋이
 * 유효한 ISO 8601 이 아니라서 Invalid Date 가 된다(검증함).
 */
function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  })
    .format(new Date(iso))
    .replace(/-/g, ".");
}

function Stars({ rating }: { rating: number }) {
  return <span className="manage-rating-stars">{"★".repeat(rating) + "☆".repeat(5 - rating)}</span>;
}

function Message({ m }: { m: ManageMessageRow }) {
  // DB 는 role 을 'assistant' 로, ChatDock CSS 는 '--hansol' 로 부른다. 매핑을 빠뜨리면
  // .chatdock-msg--assistant 라는 없는 클래스가 붙어 버블이 무스타일로 나온다.
  const variant = m.role === "assistant" ? "hansol" : "user";
  return (
    <div id={`m-${m.id}`} className={`chatdock-msg chatdock-msg--${variant}`}>
      {variant === "hansol" && <div className="chatdock-msg-from">— Hansol</div>}
      <div className="chatdock-msg-body">
        <RenderMarkdownText text={m.content} />
      </div>
      {(m.rating !== null || m.comment) && (
        <div className="manage-rating">
          {m.rating !== null && <Stars rating={m.rating} />}
          {m.comment && <span className="manage-rating-comment">“{m.comment}”</span>}
        </div>
      )}
      <div className="manage-msg-foot">
        <time className="manage-msg-time" dateTime={m.created_at}>
          {formatStamp(m.created_at)}
        </time>
        <CopyPermalink messageId={m.id} />
      </div>
    </div>
  );
}

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string | string[]; page?: string | string[] }>;
}) {
  const sp = await searchParams;
  const activeId = Array.isArray(sp.session) ? sp.session[0] : sp.session;

  const all = await listAskHansolSessionsForManage();
  // resolvePage/paginate 가 ?page= 정규화와 [1, pageCount] 클램프를 이미 한다.
  const { items, page, pageCount } = paginate(
    all,
    resolvePage(sp.page),
    MANAGE_SESSIONS_PER_PAGE,
  );

  // 없는 session id 는 빈 상태와 동일하게 처리한다(에러 페이지 아님).
  const messages = activeId ? await listAskHansolMessagesForManage(activeId) : [];

  const pageQuery = (n: number) => `?page=${n}${activeId ? `&session=${activeId}` : ""}`;

  return (
    <>
      <div className="manage-list-pane">
        <ul className="manage-list">
          {items.map((s) => {
            const badge = mismatchLabel(s.user_count, s.assistant_count);
            return (
              <li key={s.session_id}>
                <Link
                  className={"manage-list-item" + (s.session_id === activeId ? " is-active" : "")}
                  href={`?session=${s.session_id}&page=${page}`}
                >
                  <div className="manage-list-head">
                    <span className="manage-list-time">{formatStamp(s.last_at)}</span>
                    {s.has_rating && <span className="manage-list-star">★</span>}
                  </div>
                  <div>
                    <span className="manage-list-count">문답 {s.user_count}회</span>
                    {badge && <span className="manage-list-badge">{badge}</span>}
                  </div>
                  <div className="manage-list-preview">{s.preview ?? "(답변 없음)"}</div>
                </Link>
              </li>
            );
          })}
          {items.length === 0 && <li className="manage-list-item">대화 기록이 없습니다.</li>}
        </ul>
        <div className="manage-pager">
          {page > 1 ? (
            <Link href={pageQuery(page - 1)}>‹ 이전</Link>
          ) : (
            <span aria-disabled="true">‹ 이전</span>
          )}
          <span>
            {page}/{pageCount}
          </span>
          {page < pageCount ? (
            <Link href={pageQuery(page + 1)}>다음 ›</Link>
          ) : (
            <span aria-disabled="true">다음 ›</span>
          )}
        </div>
      </div>

      <div className="manage-chat">
        {messages.length === 0 ? (
          <div className="manage-empty">왼쪽에서 대화를 고르세요.</div>
        ) : (
          <div className="chatdock-scroll">
            <div className="chatdock-scroll-inner">
              {messages.map((m) => (
                <Message key={m.id} m={m} />
              ))}
              <ScrollToBottom sessionId={activeId ?? ""} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
