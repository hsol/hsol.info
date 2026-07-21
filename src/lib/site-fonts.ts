import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

/** Wanted Sans 가변 폰트(무게 100–900, 한글 전체 커버) — next/font가 preload·자체 호스팅 처리 */
export const wantedSans = localFont({
  src: [{ path: "../app/fonts/WantedSansVariable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-wanted-sans",
  display: "swap",
});

export const siteFontVariables = `${jetbrainsMono.variable} ${wantedSans.variable}`;
