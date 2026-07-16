"use client";

import ReactMarkdown from "react-markdown";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkGfm from "remark-gfm";

export function MarkdownBody({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <div className={"md-body" + (streaming ? " cursor-blink" : "")}>
      {/* CommonMark flanking 규칙상 `**C#**으로`처럼 강조 경계가 문장부호+한글로
          이어지면 강조가 닫히지 않는다 — CJK 친화 규칙으로 보정한다. */}
      {/* 한글 범위 표기(3~5, 10~20%)가 두 물결 사이 취소선으로 오인되지 않게
          단일 물결 strikethrough 를 끈다 — GFM 취소선은 `~~두 물결~~` 만. */}
      <ReactMarkdown
        remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkCjkFriendly]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
