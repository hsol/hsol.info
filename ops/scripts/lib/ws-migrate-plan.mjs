/**
 * OneDrive 루트 워크스페이스 이동 계획. 매핑표 정본: OneDrive `OneDrive-WS-마이그레이션/이동-매핑표.md`.
 *
 * planDestination(rel) 은 hsol-info-blob 기준 상대경로(NFC)를 받아 다음 중 하나를 돌려준다.
 *   { kind: "move", dst }  OneDrive 루트 기준 새 경로(NFC)
 *   { kind: "stay" }       이번 이동에서 옮기지 않는다(팀 프루퍼로 갈 파일, .DS_Store 등)
 *   { kind: "delete" }     cleanup 단계에서만 지운다(.obsidian, 허가됨)
 *   { kind: "newsroom", dst }  .newsroom-watch. 쓰는 주체를 바꾼 뒤 --with-newsroom 으로만 옮긴다
 *   null                   매핑표에 없는 파일. 계획 단계가 실패한다
 *
 * buildOps() 는 파일 단위 계획을 서버측 이동 연산으로 묶는다. 한 폴더 아래 파일이 모두 같은 접두로 옮겨지고
 * 그 목적지가 비어 있으면 폴더를 통째로 한 번에 옮긴다(아이템 ID 와 내부 상대링크 유지).
 */
import { toWs } from "../../../src/lib/onedrive/ws-layout.mjs";

/** objects/concepts 를 frontmatter kind 로 나눈 결과(2026-11-16 실측, 68개). 여기에 없는 개념 노트가 있으면 계획이 실패한다. */
const CONCEPT_FOLDERS = {
  "가치관": ["2031-인수창업가-비전", "AI-Native-Team-Culture", "AI-Native-Workflow", "End-to-End-Process-Design", "Maker-vs-Engineer", "글쓰기-정체성", "일관성·진정성"],
  "관심사": ["Advanced-Industrial-Fusion", "Automation", "Productivity", "Search-Fund", "경제발전", "과학기술", "독서-사고형성", "문화예술", "형성기-취미-창작"],
  "스킬/기술": ["ASP", "ASP.NET", "Android", "CSS", "Django", "Flask", "HTML", "JSP", "Java", "MS-SQL", "Mantine", "MySQL", "Next.js", "Node.js", "Objective-C", "PHP", "PostgreSQL", "Python", "React", "Spring"],
  "스킬/도구": ["Claude-Code", "Linear", "Microsoft-Copilot"],
  "스킬/역량": ["Community-Operation", "Customer-Centricity", "Design-Thinking", "Entrepreneurship", "Event-Curation", "Product-Thinking", "Strategic-Thinking", "Technology-Commercialization", "Vibe-Coding-Protocol"],
  "스킬/프레임워크": ["DORA-Metrics", "DevEx-Framework", "SPACE-Framework"],
  "운영체계": ["AI-Clone-Charter", "Decision-Patterns", "Implicit-Patterns", "Risk-Playbook", "Trust-Construct-System", "Value-Hierarchy", "자기-웰니스-운영", "커리어데이-보상-기준"],
  "에이전트/런북": ["Careerday-Scout-Runbook", "Daily-Reflection-Runbook", "Morning-Ritual-Runbook", "Wishket-Scout-Runbook"],
  "에이전트/학습로그": ["Energy-Burnout-Log", "Focus-Rhythm-Log", "Mood-Log", "Morning-Ritual-Insights", "Sleep-Quality-Log"],
};
const CONCEPT_DST = new Map();
for (const [folder, names] of Object.entries(CONCEPT_FOLDERS)) for (const n of names) CONCEPT_DST.set(`${n}.md`, `${folder}/${n}.md`);

const DEPRECATED = "_context-protocol/_deprecated_vault";

/** 팀 프루퍼로 갈 파일. Google Drive 라 서버측 이동이 안 되어 호스트에서 따로 복사한다. */
const STAY_FILES = new Set([
  "okky-marketing-playbook-generic_2026-07-12.md",
  "outputs/쿨베어스-이민재-회신-초안.md",
  "커리어데이-일정충돌-채팅문안-2026-08-04.md",
]);

/** 접두 규칙 [hsol-info-blob 기준 접두, 새 접두]. 위에서부터 처음 맞는 것. */
const PREFIX_RULES = [
  ["vault/.gstack/", ".gstack/"],
  ["vault/Templates/", "templates/"],
  ["vault/_ontology/", "_context-protocol/_schema/vault-ontology/"],
  ["vault/functions/", `${DEPRECATED}/functions/`],
  ["vault/Attachments/", `${DEPRECATED}/Attachments/`],
  [".noslop/", ".noslop/"],
  ["drafts/", "원고/"],
  ["ontology-builder/", "프로젝트/온톨로지-빌더/"],
  ["skills/hsol-writing/", "에이전트/스킬/hsol-writing/"],
  ["hsol-writing-skill/", "에이전트/스킬/hsol-writing-이전본/"],
];

const FILE_MAP = new Map([
  ["vault/.cdcode", ".cdcode"],
  ["vault/action-log/README.md", `${DEPRECATED}/action-log-README.md`],
  ["CLAUDE.md", `${DEPRECATED}/hsol-info-blob-CLAUDE.md`],
  ["circulation.html", "프로젝트/AI-Native-취재노트/circulation.html"],
  ["body-for-linkedin.json", "프로젝트/AI-Native-취재노트/body-for-linkedin.json"],
  ["종훈님-인터뷰-감사메시지-초안.md", "프로젝트/AI-Native-취재노트/종훈님-인터뷰-감사메시지-초안.md"],
  ["자소-DMG배포-링크드인-초안.md", "원고/자소-DMG배포-링크드인-초안.md"],
  ["네이버-인물정보-본인참여-입력값.md", "산출물/네이버-인물정보-본인참여-입력값.md"],
  ["Claude outputs/hsol-info-scroll.mp4", "프로젝트/hsol-info/hsol-info-scroll.mp4"],
]);

const base = (p) => p.split("/").pop();

export function planDestination(relRaw) {
  const rel = relRaw.normalize("NFC");
  const name = base(rel);
  if (name === ".DS_Store" || name === "Icon\r") return { kind: "stay" };
  if (STAY_FILES.has(rel)) return { kind: "stay" };
  if (rel.startsWith(".obsidian/") || rel.startsWith("vault/.obsidian/")) return { kind: "delete" };
  if (rel.startsWith(".newsroom-watch/")) return { kind: "newsroom", dst: rel };
  if (FILE_MAP.has(rel)) return { kind: "move", dst: FILE_MAP.get(rel) };
  if (/^vault\/objects\/[^/]+\.base$/.test(rel)) return { kind: "move", dst: `${DEPRECATED}/${name}` };
  if (/^AI-Native-[^/]+\.(md|html)$/.test(rel)) return { kind: "move", dst: `프로젝트/AI-Native-취재노트/${name}` };
  const ws = toWs(rel);
  if (ws) return { kind: "move", dst: ws };
  const concept = rel.match(/^vault\/objects\/concepts\/([^/]+)$/);
  if (concept) return CONCEPT_DST.has(concept[1]) ? { kind: "move", dst: CONCEPT_DST.get(concept[1]) } : null;
  for (const [from, to] of PREFIX_RULES) if (rel.startsWith(from)) return { kind: "move", dst: to + rel.slice(from.length) };
  return null;
}

/**
 * files: [{ raw, rel(NFC), hash, size }] (hsol-info-blob 기준), existing: Set(OneDrive 루트 기준 NFC 경로, 파일과 폴더)
 * 돌려줌: { ops: [{ type: "dir"|"file", src(raw, 루트 기준), dst(루트 기준), files }], plan: [...], problems: [...] }
 */
export function buildOps(files, existing, { root = "hsol-info-blob", withNewsroom = false } = {}) {
  const problems = [];
  const plan = files.map((f) => {
    const d = planDestination(f.rel);
    if (!d) problems.push(`매핑 없음: ${f.rel}`);
    const movable = d && (d.kind === "move" || (d.kind === "newsroom" && withNewsroom));
    return { ...f, kind: d?.kind ?? "unmapped", dst: movable ? d.dst.normalize("NFC") : null };
  });

  const seen = new Map();
  for (const p of plan) {
    if (!p.dst) continue;
    if (seen.has(p.dst)) problems.push(`목적지 충돌: ${p.rel}, ${seen.get(p.dst)} -> ${p.dst}`);
    seen.set(p.dst, p.rel);
    if (existing.has(p.dst)) problems.push(`목적지에 이미 있음: ${p.dst} (원본 ${p.rel})`);
  }

  // 목적지 접두 아래로 들어오는 파일 수(겹침 판정용)
  const dstUnder = (prefix) => plan.filter((p) => p.dst && (p.dst === prefix || p.dst.startsWith(prefix + "/")));
  const existsUnder = (prefix) => existing.has(prefix) || [...existing].some((e) => e.startsWith(prefix + "/"));

  const done = new Set();
  const ops = [];
  function visit(dirSegs) {
    const dirRel = dirSegs.join("/");
    const inDir = plan.filter((p) => !done.has(p) && p.rel.startsWith(dirRel + "/"));
    if (!inDir.length) return;
    if (dirSegs.length) {
      const allMove = inDir.every((p) => p.dst);
      if (allMove) {
        const first = inDir[0];
        const suffix = first.rel.slice(dirRel.length);
        if (first.dst.endsWith(suffix)) {
          const prefix = first.dst.slice(0, first.dst.length - suffix.length);
          const uniform = inDir.every((p) => p.dst === prefix + p.rel.slice(dirRel.length));
          const inside = dirRel === "" ? [] : dstUnder(prefix);
          if (prefix && uniform && !existsUnder(prefix) && inside.length === inDir.length) {
            const rawDir = first.raw.split("/").slice(0, dirSegs.length).join("/");
            ops.push({ type: "dir", src: `${root}/${rawDir}`, dst: prefix, files: inDir.length });
            for (const p of inDir) done.add(p);
            return;
          }
        }
      }
    }
    const children = new Set();
    for (const p of inDir) {
      const segs = p.rel.split("/");
      if (segs.length > dirSegs.length + 1) children.add(segs[dirSegs.length]);
    }
    for (const c of [...children].sort()) visit([...dirSegs, c]);
    for (const p of inDir) {
      if (done.has(p) || !p.dst) continue;
      if (p.rel.split("/").length !== dirSegs.length + 1) continue;
      ops.push({ type: "file", src: `${root}/${p.raw}`, dst: p.dst, files: 1 });
      done.add(p);
    }
  }
  // 루트 바로 아래 파일도 다루려고 가상의 빈 접두에서 시작한다.
  const top = new Set(plan.map((p) => p.rel.split("/")[0]));
  for (const t of [...top].sort()) {
    const isFile = plan.some((p) => p.rel === t);
    if (isFile) {
      const p = plan.find((x) => x.rel === t);
      if (p.dst) {
        ops.push({ type: "file", src: `${root}/${p.raw}`, dst: p.dst, files: 1 });
        done.add(p);
      }
    } else visit([t]);
  }
  const moved = plan.filter((p) => p.dst).length;
  const covered = ops.reduce((s, o) => s + o.files, 0);
  if (moved !== covered) problems.push(`연산이 덮는 파일 수(${covered})와 옮길 파일 수(${moved})가 다르다`);
  return { ops, plan, problems };
}
