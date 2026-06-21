"use client";

import { useEffect } from "react";
import {
  enableEnglishMode,
  getPreferredLang,
  translatorSupported,
} from "@/lib/i18n/page-translate";

/**
 * 루트 레이아웃에 두어 모든 라우트(/, 페르소나, /about 등)에서 동작.
 * EN 선택 상태로 진입/새로고침하면 본문을 영어로 번역하고, 이후 라우팅·지연 로드되는
 * 콘텐츠도 옵저버로 계속 번역되게 한다.
 */
export function PageTranslateBootstrap() {
  useEffect(() => {
    if (getPreferredLang() === "en" && translatorSupported()) {
      void enableEnglishMode();
    }
  }, []);
  return null;
}
