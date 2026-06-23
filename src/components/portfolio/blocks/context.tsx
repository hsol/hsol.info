"use client";

/**
 * 블록이 페이지 셸로부터 콜백·상호작용 상태를 받는 통로.
 * 블록 자체는 site-data(useSiteData) + 이 컨텍스트만 알면 그려진다.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSiteData } from "@/components/portfolio/Atoms";
import type { PersonaKey } from "@/components/portfolio/portfolio-types";

/* ------------------------------------------------------------------ */
/* 페이지 콜백(뒤로가기·JD 분석·자문·페르소나 선택)                      */
/* ------------------------------------------------------------------ */

export interface BlockCallbacks {
  onBack?: () => void;
  onAnalyzeJd?: () => void;
  onAskAdvice?: () => void;
  onPick?: (key: PersonaKey) => void;
  /** curious 간트 강조색 등 페이지 단위 시각 파라미터 */
  accent?: string;
}

const BlockCallbacksContext = createContext<BlockCallbacks>({});

export function BlockCallbacksProvider({
  value,
  children,
}: {
  value: BlockCallbacks;
  children: ReactNode;
}) {
  return <BlockCallbacksContext.Provider value={value}>{children}</BlockCallbacksContext.Provider>;
}

export function useBlockCallbacks(): BlockCallbacks {
  return useContext(BlockCallbacksContext);
}

/* ------------------------------------------------------------------ */
/* 홈 전용 상호작용(hero 평면도 ↔ doors 목록이 공유하는 활성 상태)        */
/* ------------------------------------------------------------------ */

export interface HomeInteraction {
  activeKey: PersonaKey;
  hovered: PersonaKey | null;
  setHovered: (key: PersonaKey | null) => void;
  bumpInteract: () => void;
  onPick: (key: PersonaKey) => void;
}

const HomeInteractionContext = createContext<HomeInteraction | null>(null);

/**
 * 홈 페이지 셸이 감싸는 provider. hero·doors 블록이 같은 활성 키를 공유하도록
 * 기존 HomeView 의 상태 로직을 그대로 옮겨 둔다(자동 순환 + hover + 최근 상호작용 억제).
 * children 은 wrapper 핸들러(onMouseMove/onClick/onKeyDown)를 받아 `.view` 에 붙인다.
 */
export function HomeInteractionProvider({
  onPick,
  children,
}: {
  onPick: (key: PersonaKey) => void;
  children: (handlers: {
    onMouseMove: () => void;
    onClick: () => void;
    onKeyDown: () => void;
  }) => ReactNode;
}) {
  const D = useSiteData();
  const [hovered, setHovered] = useState<PersonaKey | null>(null);
  const [autoIdx, setAutoIdx] = useState(0);
  const lastInteractRef = useRef(0);
  const bumpInteract = useCallback(() => {
    lastInteractRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const keys = D.personas.map((p) => p.key);
    const tick = window.setInterval(() => {
      if (document.hidden || hovered) return;
      if (Date.now() - lastInteractRef.current < 1000) return;
      setAutoIdx((i) => (i + 1) % keys.length);
    }, 2000);
    return () => window.clearInterval(tick);
  }, [hovered, D.personas]);

  const activeKey: PersonaKey = hovered ?? (D.personas[autoIdx].key as PersonaKey);

  const value = useMemo<HomeInteraction>(
    () => ({ activeKey, hovered, setHovered, bumpInteract, onPick }),
    [activeKey, hovered, bumpInteract, onPick],
  );

  const handlers = useMemo(
    () => ({ onMouseMove: bumpInteract, onClick: bumpInteract, onKeyDown: bumpInteract }),
    [bumpInteract],
  );

  return (
    <HomeInteractionContext.Provider value={value}>
      {children(handlers)}
    </HomeInteractionContext.Provider>
  );
}

export function useHomeInteraction(): HomeInteraction {
  const value = useContext(HomeInteractionContext);
  if (!value) throw new Error("HomeInteractionProvider is missing.");
  return value;
}
