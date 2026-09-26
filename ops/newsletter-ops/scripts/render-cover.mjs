#!/usr/bin/env node
/**
 * Ask Hansol 자문록 — 커버 PNG 렌더러
 *
 * 토큰화 템플릿(assets/newsletter/cover-template.svg)의 3슬롯을 치환해 1200×628 PNG 생성.
 *  - ISSUE 번호 / 카테고리 태그 / 헤드라인 2줄(**강조**=시안 #00d9ff)
 *
 * 사용:
 *   node scripts/ask-hansol-newsletter/render-cover.mjs \
 *     --issue 02 --category "커리어 · 창업" \
 *     --hl1 "유료 30명 월 80만원," --hl2 "창업으로 **키울까 말까**"
 *
 * 출력은 기본으로 OS 임시 디렉터리(샌드박스)에 쓴다 — 업로드 전용 일회성 산출물이라
 * 리포에 저장/커밋하지 않는다. 경로를 stdout 마지막 줄에 출력하니 그걸 업로드에 쓴다.
 * (--out 으로 명시 가능하나, 리포 내부 경로는 지양.)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPS_ROOT = join(__dirname, ".."); // newsletter-ops/
const TEMPLATE = join(OPS_ROOT, "assets", "cover-template.svg");
const FONT_DIR = join(OPS_ROOT, "assets", "fonts"); // 있으면 번들 폰트 사용

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const xml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// "결론이 **안 납니다**" → <tspan #f5f5f7>결론이 </tspan><tspan #00d9ff>안 납니다</tspan>
function headlineTspans(line) {
  const parts = String(line).split(/\*\*(.+?)\*\*/g); // 홀수 index = 강조
  return parts
    .map((p, i) =>
      p === "" ? "" : `<tspan fill="${i % 2 ? "#00d9ff" : "#f5f5f7"}">${xml(p)}</tspan>`,
    )
    .join("");
}

// 라인 폭 추정(브라우저 없이): 한글/CJK ≈ 1.0×fs, ASCII/기호 ≈ 0.56×fs, 공백 ≈ 0.30×fs. **강조 마커는 폭에서 제외.
function estLineWidth(line, fs) {
  const plain = String(line).replace(/\*\*/g, "");
  let w = 0;
  for (const ch of plain) {
    const cp = ch.codePointAt(0);
    if (ch === " ") w += fs * 0.30;
    else if (cp >= 0x1100) w += fs * 1.0;
    else w += fs * 0.56;
  }
  return w;
}

function buildHeadlineBlock(hl1, hl2) {
  const BASE = 66;
  const MAX_W = 1040; // 안전 영역 x=80~1120 (하단 divider·pill과 동일 폭). 우측 여백 확보.
  const widest = Math.max(estLineWidth(hl1, BASE), estLineWidth(hl2, BASE));
  // 가장 긴 줄이 MAX_W를 넘으면 폰트를 비례 축소해 우측 여백을 항상 확보(최소 40).
  const fs = widest > MAX_W ? Math.max(40, Math.floor((BASE * MAX_W) / widest)) : BASE;
  const lh = Math.round(fs * 1.3); // 줄 간격도 폰트에 비례
  const y1 = 360;
  const y2 = y1 + lh;
  const common =
    `font-family="'Noto Sans CJK KR','Noto Sans','sans-serif'" font-size="${fs}" font-weight="700"`;
  return (
    `<text x="80" y="${y1}" ${common}>${headlineTspans(hl1)}</text>\n` +
    `  <text x="80" y="${y2}" ${common}>${headlineTspans(hl2)}</text>`
  );
}

// 카테고리 pill 폭: 좌패딩(54) + 글자수*폰트비율 + 우패딩(28)
function categoryWidth(text) {
  const plain = String(text);
  const w = 54 + plain.length * 25 + 28;
  return Math.max(180, Math.round(w));
}

function main() {
  const issue = arg("issue", "01");
  const category = arg("category", "제품 · 의사결정");
  const hl1 = arg("hl1", "우선순위 회의가 매번 길어지고");
  const hl2 = arg("hl2", "결론이 **안 납니다**");
  // 기본 출력 = 샌드박스 임시경로(업로드 전용, 미저장·미커밋). 리포 밖.
  const out = arg(
    "out",
    join(tmpdir(), `ask-hansol-cover-${String(issue).replace(/\W/g, "")}-${Date.now()}.png`),
  );

  let svg = readFileSync(TEMPLATE, "utf8");
  svg = svg
    .replace("{{ISSUE}}", xml(issue))
    .replace("{{CATEGORY}}", xml(category))
    .replace("{{CATEGORY_W}}", String(categoryWidth(category)))
    .replace("{{HEADLINE_BLOCK}}", buildHeadlineBlock(hl1, hl2));

  const resvg = new Resvg(svg, {
    background: "#0a0e27",
    fitTo: { mode: "width", value: 1200 },
    font: {
      loadSystemFonts: true,
      fontDirs: existsSync(FONT_DIR) ? [FONT_DIR] : [],
      defaultFontFamily: "Noto Sans CJK KR",
    },
  });
  const png = resvg.render().asPng();
  writeFileSync(out, png);
  console.log(`cover rendered → ${out} (${png.length} bytes)`);
}

main();
