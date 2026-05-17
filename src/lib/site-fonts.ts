import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

/** CDN @font-face 체인(HTML→CSS→jsdelivr) 제거 — next/font가 preload·자체 호스팅 처리 */
export const lineSeedKR = localFont({
  src: [
    { path: "../app/fonts/LINESeedKR-Rg.woff2", weight: "400", style: "normal" },
    { path: "../app/fonts/LINESeedKR-Bd.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-line-seed",
  display: "swap",
});

export const siteFontVariables = `${jetbrainsMono.variable} ${lineSeedKR.variable}`;
