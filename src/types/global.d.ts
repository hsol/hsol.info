export {};

declare global {
  interface Window {
    claude?: {
      complete: (prompt: string) => Promise<string>;
    };
    Calendly?: {
      initInlineWidget: (opts: { url: string; parentElement: HTMLElement }) => void;
    };
  }
}
