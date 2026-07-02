"use client";

import ReactMarkdown from "react-markdown";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkGfm from "remark-gfm";

export function MarkdownBody({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <div className={"md-body" + (streaming ? " cursor-blink" : "")}>
      {/* CommonMark flanking 규칙상 `**C#**으로`처럼 강조 경계가 문장부호+한글로
          이어지면 강조가 닫히지 않는다 — CJK 친화 규칙으로 보정한다. */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCjkFriendly]}
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
