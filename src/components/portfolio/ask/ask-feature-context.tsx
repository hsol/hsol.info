"use client";

/**
 * Ask 기능(JD 적합도 분석 · 의사결정 자문)의 공유 상태.
 * ------------------------------------------------------------------
 * 같은 기능을 두 곳에서 연다: (1) 화면 중앙 모달(AskFeatureDialog), (2) 우측 챗독의 하단 패널.
 * 둘이 완전히 싱크되도록 입력값·활성 여부·제출을 여기서 단일 소스로 들고, 두 컴포넌트가 공유한다.
 *
 * - dialogMode: 모달이 열려 있는 기능(null 이면 닫힘). 모달 마운트/애니메이션을 지배.
 * - panelActive: 챗독 하단 패널이 열려 있는 기능(null 이면 닫힘).
 *   모달을 열면 패널도 함께 열려, 모달을 닫을 때 그 패널 자리로 최소화될 수 있다.
 * - text: 두 입력창이 공유하는 본문(양방향 싱크).
 * - submitSignal: 제출 트리거. 실제 제출(메시지 적층·스트리밍)은 ChatDock 이 수행한다.
 * - dockOpenSignal: 모달을 열 때 챗독(모바일에선 지연 마운트)이 뜨도록 하는 신호.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AskFeature = "jd" | "advice";

export interface AskFeatureValue {
  dialogMode: AskFeature | null;
  panelActive: AskFeature | null;
  text: string;
  submitSignal: number;
  dockOpenSignal: number;
  /** 본문 CTA — 모달과 패널을 함께 연다(입력 초기화). */
  openDialog: (f: AskFeature) => void;
  /** 챗독 내부 토글 — 패널만 연다. */
  openPanel: (f: AskFeature) => void;
  setText: (t: string) => void;
  /** 모달만 닫는다(패널은 유지 — 최소화되어 들어간 모양새). */
  closeDialog: () => void;
  /** 패널을 닫고 입력을 비운다(제출 후에도 호출). */
  closePanel: () => void;
  /** 제출 요청 — ChatDock 이 소비해 실제 분석/자문을 실행한다. */
  requestSubmit: () => void;
}

const FALLBACK: AskFeatureValue = {
  dialogMode: null,
  panelActive: null,
  text: "",
  submitSignal: 0,
  dockOpenSignal: 0,
  openDialog: () => {},
  openPanel: () => {},
  setText: () => {},
  closeDialog: () => {},
  closePanel: () => {},
  requestSubmit: () => {},
};

const AskFeatureContext = createContext<AskFeatureValue>(FALLBACK);

/** 상태를 소유하는 훅. Provider 를 다는 컴포넌트가 직접 쓰고, 자식엔 context 로 흘린다. */
export function useAskFeatureController(): AskFeatureValue {
  const [dialogMode, setDialogMode] = useState<AskFeature | null>(null);
  const [panelActive, setPanelActive] = useState<AskFeature | null>(null);
  const [text, setText] = useState("");
  const [submitSignal, setSubmitSignal] = useState(0);
  const [dockOpenSignal, setDockOpenSignal] = useState(0);

  return useMemo(
    () => ({
      dialogMode,
      panelActive,
      text,
      submitSignal,
      dockOpenSignal,
      openDialog: (f) => {
        setText("");
        setPanelActive(f);
        setDialogMode(f);
        setDockOpenSignal((n) => n + 1); // 모바일 등 지연 마운트된 챗독을 띄운다
      },
      openPanel: (f) => {
        setText("");
        setPanelActive(f);
      },
      setText,
      closeDialog: () => setDialogMode(null),
      closePanel: () => {
        setPanelActive(null);
        setText("");
      },
      requestSubmit: () => setSubmitSignal((n) => n + 1),
    }),
    [dialogMode, panelActive, text, submitSignal, dockOpenSignal],
  );
}

export function AskFeatureProvider({
  value,
  children,
}: {
  value: AskFeatureValue;
  children: ReactNode;
}) {
  return <AskFeatureContext.Provider value={value}>{children}</AskFeatureContext.Provider>;
}

export function useAskFeature(): AskFeatureValue {
  return useContext(AskFeatureContext);
}
