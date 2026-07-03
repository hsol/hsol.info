"use client";

import "@/styles/legacy/chatdock.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { type AskFeature, useAskFeature } from "./ask-feature-context";

type ModeConfig = {
  eyebrow: string;
  title: string;
  placeholder: string;
  submit: string;
  minLen: number;
};

const CONFIG: Record<AskFeature, ModeConfig> = {
  jd: {
    eyebrow: "AI 분석 · 채용 공고 적합도",
    title: "채용 공고 적합도 분석",
    placeholder:
      "채용 공고(JD) 전문을 붙여넣어 주세요. 주요 업무·자격 요건·우대 사항이 있으면 더 정확합니다.",
    submit: "적합도 분석하기",
    minLen: 40,
  },
  advice: {
    eyebrow: "AI 자문 · 한솔님은 어떻게 보시나요?",
    title: "임한솔의 AI 클론 의사결정 자문요청",
    placeholder:
      "고민 중인 이슈를 적어주세요. 배경·제약·목표·지금까지 시도한 것을 함께 적으면 더 깊이 짚어드려요. (예: 초기 팀에 PM을 따로 둬야 할까요? 상황은...)",
    submit: "제 관점은요!",
    minLen: 20,
  },
};

/**
 * 본문 상세 CTA(자문/JD)로 여는 모달 진입점. 챗독 하단 패널과 **완전히 싱크**된다.
 * ------------------------------------------------------------------
 * - 입력(text)·활성 기능(panelActive)·제출(submitSignal)을 공유 컨텍스트로 도크 패널과 공유.
 *   → 모달이 열리면 도크 패널도 열리고, 어느 쪽에 타이핑해도 양쪽이 같이 반영된다.
 * - 제출: requestSubmit() 만 보낸다. 실제 분석/자문·스트리밍은 ChatDock 이 도크 대화에 수행.
 *   제출과 동시에 모달은 닫힘 애니메이션(도크 패널로 최소화)으로 사라진다.
 * - 그냥 닫기(X/Esc/백드롭): 모달만 닫고 패널은 남긴다(패널 자리로 빨려 들어가는 모양새).
 * 답변 표시·세션 로직이 없어 가볍다(react-markdown 미포함).
 */
export function AskFeatureDialog() {
  const af = useAskFeature();
  const mode = af.dialogMode;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const closingRef = useRef(false);
  const [closeStyle, setCloseStyle] = useState<{ transform: string; opacity: number } | null>(null);

  // mode 가 켜지면 초기화 후 모달을 연다. 꺼지면 닫는다.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (mode) {
      setCloseStyle(null);
      closingRef.current = false;
      if (!d.open) d.showModal();
      requestAnimationFrame(() => textareaRef.current?.focus());
    } else if (d.open) {
      d.close();
    }
  }, [mode]);

  /**
   * 닫힘 애니메이션 — 대응하는 챗독 패널(우측, 지금은 열려 있음) 위치로 축소·이동하며 페이드아웃
   * (맥 dock 최소화 느낌). 애니메이션 후 실제 닫힘(closeDialog — 패널은 유지). reduced-motion 이거나
   * 타깃을 못 찾으면 즉시 닫는다. onSubmit=true 면 닫힘만 담당(제출은 호출부에서 requestSubmit).
   */
  const beginClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    const card = cardRef.current;
    const dock =
      document.querySelector(".chatdock-jd-panel") ??
      document.querySelector(".chatdock.is-open") ??
      document.querySelector(".chatdock") ??
      document.querySelector(".chatdock-fab");
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!card || !dock || reduce) {
      af.closeDialog();
      return;
    }

    const c = card.getBoundingClientRect();
    const t = dock.getBoundingClientRect();
    const isFullDock = dock.classList.contains("chatdock");
    const tx = t.left + t.width / 2 - (c.left + c.width / 2);
    const ty = t.top + t.height * (isFullDock ? 0.72 : 0.5) - (c.top + c.height / 2);
    const scale = Math.max(0.06, Math.min(t.width / Math.max(c.width, 1), 0.4));

    setCloseStyle({ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, opacity: 0 });
    window.setTimeout(af.closeDialog, 380);
  }, [af]);

  const submit = useCallback(() => {
    if (!mode) return;
    if (af.text.trim().length < CONFIG[mode].minLen) return;
    beginClose(); // 패널이 아직 열려 있을 때 위치를 잡아 최소화 애니메이션
    af.requestSubmit(); // 실제 분석/자문은 ChatDock 이 도크 대화에서 수행
  }, [mode, af, beginClose]);

  if (!mode) {
    return <dialog ref={dialogRef} className="ask-dialog" aria-label="Ask Hansol" />;
  }

  const cfg = CONFIG[mode];
  const canSubmit = af.text.trim().length >= cfg.minLen;

  return (
    <dialog
      ref={dialogRef}
      className={"ask-dialog" + (closeStyle ? " is-closing" : "")}
      aria-label={cfg.title}
      data-no-translate
      onCancel={(e) => {
        e.preventDefault();
        beginClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) beginClose();
      }}
    >
      <div
        ref={cardRef}
        className={"ask-dialog-card" + (closeStyle ? " is-closing" : "")}
        style={closeStyle ?? undefined}
      >
        <header className="ask-dialog-head">
          <div>
            <div className="ask-dialog-eyebrow">{cfg.eyebrow}</div>
            <div className="ask-dialog-title">{cfg.title}</div>
          </div>
          <button type="button" className="chatdock-x" onClick={beginClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className="chatdock-jd-panel ask-dialog-panel">
          <textarea
            ref={textareaRef}
            className="chatdock-jd-textarea"
            placeholder={cfg.placeholder}
            value={af.text}
            onChange={(e) => af.setText(e.target.value)}
            rows={7}
          />
          <button
            type="button"
            className="chatdock-jd-submit"
            onClick={submit}
            disabled={!canSubmit}
          >
            {cfg.submit}
          </button>
        </div>
      </div>
    </dialog>
  );
}
