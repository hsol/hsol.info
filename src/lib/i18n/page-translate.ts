/**
 * 페이지 영문 보기 — 브라우저 내장(온디바이스) 번역 API 활용.
 *
 * 구글 번역 웹 프록시(translate.goog)는 한국 등 일부 지역에서 차단되므로 쓰지 않는다.
 * 대신 Chrome/Edge 138+의 내장 `Translator` API로 #main-content의 한글 텍스트 노드를
 * 그 자리에서 영어로 바꾼다(온디바이스라 지역 제한 없음). 미지원 브라우저에서는
 * `translatorSupported()`가 false를 반환하므로 호출부에서 안내 폴백을 보여준다.
 *
 * KO 복귀는 별도 복원 대신 페이지 새로고침으로 처리한다(원문이 기본이라 가장 안전).
 */

const LANG_KEY = "hsol-lang";
const HANGUL = /[가-힣]/;

export type PageLang = "ko" | "en";

type TranslatorInstance = { translate(input: string): Promise<string> };
type TranslatorStatic = {
  availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(opts: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorInstance>;
};

export type TranslateResult = {
  ok: boolean;
  reason?: "unsupported" | "unavailable" | "no-root" | "error";
};

function getTranslatorStatic(): TranslatorStatic | null {
  if (typeof self === "undefined") return null;
  const g = self as unknown as { Translator?: TranslatorStatic };
  return g.Translator ?? null;
}

export function translatorSupported(): boolean {
  return getTranslatorStatic() !== null;
}

export function getPreferredLang(): PageLang {
  if (typeof window === "undefined") return "ko";
  try {
    return window.localStorage.getItem(LANG_KEY) === "en" ? "en" : "ko";
  } catch {
    return "ko";
  }
}

export function setPreferredLang(lang: PageLang): void {
  if (typeof window === "undefined") return;
  try {
    if (lang === "en") window.localStorage.setItem(LANG_KEY, "en");
    else window.localStorage.removeItem(LANG_KEY);
  } catch {
    /* localStorage 사용 불가(프라이빗 모드 등) — 무시 */
  }
}

let cachedTranslator: TranslatorInstance | null = null;
let pendingTranslator: Promise<TranslatorInstance | null> | null = null;

async function getTranslator(): Promise<TranslatorInstance | null> {
  if (cachedTranslator) return cachedTranslator;
  const Static = getTranslatorStatic();
  if (!Static) return null;
  if (!pendingTranslator) {
    pendingTranslator = (async () => {
      try {
        const availability = await Static.availability({
          sourceLanguage: "ko",
          targetLanguage: "en",
        });
        if (availability === "unavailable" || availability === "no") return null;
        // 'downloadable'/'downloading'이면 create()가 모델을 내려받는다(클릭 제스처 필요).
        const instance = await Static.create({ sourceLanguage: "ko", targetLanguage: "en" });
        cachedTranslator = instance;
        return instance;
      } catch {
        return null;
      } finally {
        pendingTranslator = null;
      }
    })();
  }
  return pendingTranslator;
}

const translatedNodes = new WeakSet<Text>();

function collectHangulTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue ?? "";
      if (!HANGUL.test(text)) return NodeFilter.FILTER_REJECT;
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-no-translate]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index;
      index += 1;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

async function translateOnce(rootSelector: string): Promise<TranslateResult> {
  if (typeof document === "undefined") return { ok: false, reason: "error" };
  const translator = await getTranslator();
  if (!translator) {
    return { ok: false, reason: translatorSupported() ? "unavailable" : "unsupported" };
  }
  const root = document.querySelector<HTMLElement>(rootSelector);
  if (!root) return { ok: false, reason: "no-root" };

  const nodes = collectHangulTextNodes(root).filter((node) => !translatedNodes.has(node));
  if (nodes.length === 0) {
    document.documentElement.setAttribute("data-tr", "en");
    return { ok: true };
  }

  await runPool(nodes, 6, async (node) => {
    const original = node.nodeValue ?? "";
    const trimmed = original.trim();
    if (!trimmed) return;
    try {
      const translated = await translator.translate(trimmed);
      if (translated && node.nodeValue === original) {
        // 앞뒤 공백은 보존하고 본문만 치환.
        node.nodeValue = original.replace(trimmed, translated);
        translatedNodes.add(node);
      }
    } catch {
      /* 개별 노드 실패는 건너뛴다 */
    }
  });

  document.documentElement.setAttribute("data-tr", "en");
  return { ok: true };
}

let busy = false;
let rerunRequested = false;

/**
 * #main-content의 한글을 영어로 번역(제자리). 동시 호출은 합쳐서(coalesce) 처리하므로
 * 클릭·라우팅 effect에서 자유롭게 여러 번 불러도 안전하다. 이미 번역된 노드는 건너뛴다.
 */
export async function applyEnglishTranslation(
  rootSelector = "#main-content",
): Promise<TranslateResult> {
  if (busy) {
    rerunRequested = true;
    return { ok: true };
  }
  busy = true;
  try {
    let result = await translateOnce(rootSelector);
    while (rerunRequested) {
      rerunRequested = false;
      result = await translateOnce(rootSelector);
    }
    return result;
  } finally {
    busy = false;
  }
}
