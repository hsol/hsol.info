// hsol.info architecture, large figure: sources, vault layers, build stations, server, Ask, five visitor kiosks.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../anatomy/kit/iso-kit.mjs";
import { kitScript } from "../../anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const EMBED_OUT = (() => { const i = process.argv.indexOf("--embed"); return i > 0 ? process.argv[i + 1] : null; })();

const WIDTH = 900;
const HEIGHT = 480;

// ---------- world ----------
const PLATE = { x: -272, y: -94, w: 584, d: 180, r: 10 };
const PLATE_H = 13;
const FOOT_H = 5;

// press (GitHub Actions build + LLM ETL)
const DX = -40;
const POSTS = [[-172 + DX, -28], [-108 + DX, -28], [-172 + DX, 22], [-108 + DX, 22]];
const NEAR_POST = 3;
const POST_R = 3.6;
const PLATEN = { x: -178 + DX, y: -34, w: 76, d: 62, r: 3 };
const PLATEN_H = 8;
const PLATEN_REST = 36;
const PLATEN_DOWN = 7.7;
const CROWN = { x: -180 + DX, y: -36, w: 80, d: 66, r: 3 };
const CROWN_Z = 72;
const CROWN_H = 10;
const WHEEL = [-140 + DX, -6];

// shuttle rails: press -> composing stick -> gate -> dock
const RAIL_FROM = -208;
const RAIL_TO = -68;
const RAILS = [-9, 4];
const SHUTTLE_PRESS = -140 + DX;
const SHUTTLE_COMPOSE = -122;
const SHUTTLE_DOCK = -80;
const GATE_X = -99;
const COMPOSE = { x: -122, colY: -24, armZ: 30, headR: 4, rest: 19, tap: 8.3 };

// one-pager unit, back row between press and cabinet
const ONEP = { x: -122, y: -80, w: 38, d: 26, r: 2 };
const ONEP_H = 24;

// cabinet (OneDrive vault)
const CAB = { x: -40, y: -40, w: 120, d: 60, r: 2 };
const CAB_Z = 6;
const CAB_TOP = 86;
const CAP_TOP = 90;
const FRONT_Y = CAB.y + CAB.d; // 20
const COLS = [[-36, -2], [3, 37], [42, 76]];
const ROWS = [[12, 34], [38, 60], [62, 84]];
const DS = { col: 0, row: 0 }; // datasources tray
const OV = { col: 2, row: 0 }; // object-views tray
const DRAWER_OUT = 18;
const CLOCK = [-14, -18];
const CLOCK_R = 16;
const CLOCK_TOP = CAP_TOP + 6;
const TRAY = { x: 12, y: -34, w: 24, d: 24, r: 1.5 };
const DROP = 38;
const RACK = { x: 46, y: -30, w: 28, d: 14, r: 1.2 };

// sources desk and belt (front left)
const DESK = { x: -262, y: 40, w: 104, d: 30, r: 2 };
const DESK_Z = 10;
const STACKS = [
  { name: "blog", x: -252, w: 18, h: 17 },
  { name: "medium", x: -228, w: 16, h: 6 },
  { name: "linkedin", x: -206, w: 18, h: 10 },
  { name: "book", x: -182, w: 16, h: 5 },
];
const BELT = { x0: -156, x1: -20, y: 46, d: 10, z: 7 };

// server (Next.js on Vercel)
const SRV = { x: 120, y: -40, w: 112, d: 56, r: 2 };
const SRV_Z = 6;
const SRV_TOP = 54;
const SRV_CAP = 58;
const SFRONT = SRV.y + SRV.d; // 16
const TTL = [212, -16];
const TTL_R = 11;
const TTL_TOP = SRV_CAP + 5;
const ASKS = [[140, -28], [155, -28], [170, -28]];
const SCREEN = { x0: 128, x1: 180, z0: 18, z1: 46 };
const TIERS = [[34, 44], [22, 32], [10, 20]];
const TIER_X = 186;
const KIOSK_Y = 46;
const KIOSKS = ["hire", "collab", "builder", "curious", "news"].map((label, i) => ({ label, x: 132 + i * 25 }));

// reader rod (Graph API) from server to cabinet
const ROD_Y = 6;
const ROD_Z = 35;
const ROD_TIP_OUT = CAB.x + CAB.w + 2; // 82
const ROD_LEN = 56;
const ROD_STROKE = 52;

// Neon and the AI Gateway
const NEON = { x: 246, y: -66, w: 52, d: 24, r: 3 };
const NEON_H = 20;
const GATEWAY = { x: 250, y: -32, w: 42, d: 22, r: 2 };
const GATEWAY_H = 16;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(CROWN, CROWN_Z, CROWN_Z + CROWN_H + 16), [CLOCK[0], CLOCK[1], CLOCK_TOP + 4], [TRAY.x + 12, TRAY.y + 12, CAP_TOP + DROP + 2], [RACK.x, RACK.y, CAP_TOP + 18]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 58 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);
const screwsOn = (plan, z, inset = 3, size = 0.45) => D(k.corners(plan, inset).map(([x, y]) => at([x, y, z])), { size });
const fx = (v) => v.toFixed(1);
const facePoly = (y, pts) => "M" + pts.map(([x, z]) => at([x, y, z]).map(fx).join(" ")).join("L") + "Z";
const xFacePoly = (x, pts) => "M" + pts.map(([y, z]) => at([x, y, z]).map(fx).join(" ")).join("L") + "Z";
const wire = (pts3, ends = "from") => {
  const pts = pts3.map(at);
  return k.wireSvg(pts[0], pts[pts.length - 1], { via: pts.slice(1, -1), tone: "lo", ends, size: 1.1 });
};
const led = (name, x, y, z, ring = 1.5) => L(k.ring(x, y, ring, z, P, 14), { tone: "lo" }) + `<g data-led="${name}" class="led">${D([at([x, y, z])], { size: 0.85, tone: "faint" })}</g>`;
function convexHull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// ---------- plate ----------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const mx = PLATE.x + PLATE.w / 2;
  const feet = [...k.corners(PLATE, 24), [mx, PLATE.y + 24], [mx, PLATE.y + PLATE.d - 24]];
  for (const [x, y] of byDepth(feet)) {
    out.push(S(k.cylinder(x, y, 7.5, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.8, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(slab(PLATE, -PLATE_H, PLATE_H, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
  // ruler along the front edge
  const strip = { x: -150, y: PLATE.y + PLATE.d - 15, w: 270, d: 7, r: 1 };
  out.push(S(slab(strip, 0, 0.6, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // name plate, front right
  const name = { x: 248, y: 50, w: 52, d: 18, r: 1.5 };
  out.push(S(slab(name, 0, 0.8, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(name, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([name.x + name.w / 2, name.y + 11.2], 0.8, P, "x"), "HSOL.INFO", { size: 5, tone: "mid", anchor: "middle" }));
  out.push(D([at([name.x + 4, name.y + 9, 0.8]), at([name.x + name.w - 4, name.y + 9, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ---------- back row ----------
function gateway() {
  // AI Gateway: where the model calls go out
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(GATEWAY, 2), 0, 2, P)}" style="filter:blur(5px)"/>`];
  out.push(S(slab(GATEWAY, 0, 3, 4, 0.4), { tone: "lo" }));
  const body = k.insetPlan(GATEWAY, 1.5);
  out.push(S(slab(body, 3, GATEWAY_H - 3, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(body, 9, P, 4), { tone: "faint" }) }));
  for (let i = 0; i < 4; i++) out.push(L(k.planOutline({ x: GATEWAY.x + 6 + i * 4, y: GATEWAY.y + 6, w: 1.6, d: 11, r: 0.8 }, GATEWAY_H, P, 2), { tone: "lo" }));
  out.push(led("gateway", GATEWAY.x + 30, GATEWAY.y + 12, GATEWAY_H, 1.8));
  out.push(screwsOn(body, GATEWAY_H, 3));
  return out.join("");
}

function backCables() {
  const z = 0.5;
  return [
    // gateway -> press pedestal, along the back edge
    wire([[GATEWAY.x + 12, GATEWAY.y + 8, z], [GATEWAY.x + 12, -86, z], [POSTS[0][0], -86, z], [POSTS[0][0], POSTS[0][1] - 6.5, z], [POSTS[0][0], POSTS[0][1] - 6.5, 1.2]], "to"),
    // server (Ask) -> gateway
    wire([[SRV.x + SRV.w + 2, -16, 3], [SRV.x + SRV.w + 2.1, -16, z], [GATEWAY.x + 8, -16, z]], "from"),
    // press, cabinet -> Neon, along the back edge
    wire([[POSTS[1][0], POSTS[1][1] - 6.5, 1.2], [POSTS[1][0], -54, z], [10, -54, z], [10, -50, z], [NEON.x + 10, -76, z], [NEON.x + 10, NEON.y + 4, z]], "from"),
  ].join("");
}

function onepager() {
  // one-pager unit: writes KO, translates EN, checks self-designation, prints the PDF
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(ONEP, 2), 0, 2, P)}" style="filter:blur(5px)"/>`];
  out.push(S(slab(ONEP, 0, 3, 4, 0.4), { tone: "lo" }));
  const body = k.insetPlan(ONEP, 1.5);
  out.push(S(slab(body, 3, ONEP_H - 3, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(body, 8, P, 4), { tone: "faint" }) }));
  const fy = ONEP.y + ONEP.d - 1.5;
  // output slot on the front face, closed outline
  out.push(`<path class="iso-shade" data-shade="0" d="${facePoly(fy + 0.05, [[ONEP.x + 7, 12], [ONEP.x + ONEP.w - 7, 12], [ONEP.x + ONEP.w - 7, 14.5], [ONEP.x + 7, 14.5]])}"/>`);
  out.push(L(facePoly(fy + 0.06, [[ONEP.x + 7, 12], [ONEP.x + ONEP.w - 7, 12], [ONEP.x + ONEP.w - 7, 14.5], [ONEP.x + 7, 14.5]]), { tone: "lo" }));
  const top = ONEP_H;
  out.push(L(k.planOutline(k.insetPlan(ONEP, 5), top, P, 3), { tone: "faint" }));
  out.push(led("op-ko", ONEP.x + 10, ONEP.y + 10, top));
  out.push(led("op-en", ONEP.x + 16, ONEP.y + 10, top));
  out.push(led("op-gate", ONEP.x + 22, ONEP.y + 10, top));
  out.push(S(k.cylinder(ONEP.x + 30, ONEP.y + 12, 3.2, top, 2, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(ONEP.x + 30, ONEP.y + 12, 3.2, top, top + 2, 20, P), { tone: "lo" }));
  out.push(screwsOn(body, top, 3));
  return out.join("");
}

function onepagerSheet() {
  // built in the slot; moved +y as it prints
  const fy = ONEP.y + ONEP.d - 1.5;
  const sh = { x: ONEP.x + 8.5, y: fy - 14, w: ONEP.w - 17, d: 14, r: 0.4 };
  return S(slab(sh, 12.6, 0.6, 2), { tone: "hi", crease: "none" }) + [3, 6, 9].map((dy, i) => L(k.lineOnTop([sh.x + 2, sh.y + dy], [sh.x + (i === 1 ? 12 : 18), sh.y + dy], 13.2, P), { tone: "mid", free: true })).join("");
}

// ---------- press ----------
function rails() {
  const out = [];
  for (const y of RAILS) {
    out.push(S(slab({ x: RAIL_FROM, y, w: RAIL_TO - RAIL_FROM, d: 4, r: 1 }, 0, 3, 3, 0.4), { tone: "mid" }));
    out.push(D([RAIL_FROM + 5, -150, -110, RAIL_TO - 5].map((x) => at([x, y + 2, 3])), { size: 0.4 }));
  }
  out.push(S(slab({ x: RAIL_FROM - 5, y: -12, w: 5, d: 20, r: 1.2 }, 0, 7, 3, 0.5), { tone: "mid" }));
  out.push(D([at([RAIL_FROM - 2.5, -8, 7]), at([RAIL_FROM - 2.5, 4, 7])], { size: 0.45 }));
  return out.join("");
}
function pedestals() {
  return byDepth(POSTS).map(([x, y]) => S(k.cylinder(x, y, 6.5, 0, 2, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 5, 2, 2.6, P, 24), { tone: "mid" })).join("");
}
function postSvg(index, platenZ) {
  const [x, y] = POSTS[index];
  const below = S(k.cylinder(x, y, POST_R, 4.6, Math.max(0.1, platenZ - 4.6), P, 20), { tone: "mid", crease: "none" });
  const fromZ = platenZ + PLATEN_H + 3;
  return below + S(k.cylinder(x, y, POST_R, fromZ, CROWN_Z - fromZ, P, 20), { tone: "mid", crease: "none" });
}
function platenSvg() {
  const out = [S(slab(PLATEN, 0, PLATEN_H, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(PLATEN, 3, P, 4), { tone: "faint" }) })];
  out.push(L(k.planOutline(k.insetPlan(PLATEN, 12), PLATEN_H, P, 3), { tone: "faint" }));
  for (const [x, y] of byDepth(POSTS)) {
    out.push(S(k.cylinder(x, y, 6, PLATEN_H, 3, P, 24), { tone: "mid" }));
    out.push(L(k.ring(x, y, POST_R + 0.4, PLATEN_H + 3, P, 20), { tone: "lo" }));
  }
  out.push(D(k.corners(k.insetPlan(PLATEN, 12), 2).map(([x, y]) => at([x, y, PLATEN_H])), { size: 0.45 }));
  return out.join("");
}
function shaftSvg(platenZ) {
  const [x, y] = WHEEL;
  const z0 = platenZ + PLATEN_H;
  return S(k.cylinder(x, y, 5, z0, 2.5, P, 24), { tone: "mid" }) + S(k.cylinder(x, y, 2.8, z0 + 2.5, CROWN_Z - z0 - 2.5, P, 20), { tone: "mid", crease: "none" });
}
function crown() {
  const out = [S(slab(CROWN, CROWN_Z, CROWN_H, 4, 1), { tone: "mid", inner: L(k.sideSeam(CROWN, CROWN_Z + 3, P, 4), { tone: "faint" }) })];
  const top = CROWN_Z + CROWN_H;
  out.push(L(k.planOutline(k.insetPlan(CROWN, 4), top, P, 4), { tone: "lo" }));
  for (const [x, y] of POSTS) out.push(L(k.ring(x, y, 4.6, top, P, 20), { tone: "lo" }));
  out.push(D(POSTS.map(([x, y]) => at([x, y, top])), { size: 0.55 }));
  const [x, y] = WHEEL;
  out.push(S(k.cylinder(x, y, 6, top, 4, P, 28), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 14, top + 4, 3, P, 64, 0.6), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 14, top + 4, top + 7, 72, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(x, y, 10.5, top + 7, P, 48), { tone: "lo" }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    out.push(L(k.lineOnTop([x + Math.sin(a) * 3, y - Math.cos(a) * 3], [x + Math.sin(a) * 10.5, y - Math.cos(a) * 10.5], top + 7, P), { tone: "lo" }));
  }
  out.push(L(k.ring(x, y, 3, top + 7, P, 16), { tone: "lo" }));
  const knob = [x + 10.5 * Math.sin(2.2), y - 10.5 * Math.cos(2.2)];
  out.push(S(k.cylinder(knob[0], knob[1], 1.8, top + 7, 7, P, 16), { tone: "mid" }));
  // ink well: model output feeds the press from the gateway cable
  out.push(S(k.cylinder(CROWN.x + 12, CROWN.y + 12, 5.5, top, 6, P, 28, 0.4), { tone: "mid" }));
  out.push(L(k.ring(CROWN.x + 12, CROWN.y + 12, 3.6, top + 6, P, 24), { tone: "lo" }));
  return out.join("");
}
function rejectBin() {
  const bin = { x: -138, y: 26, w: 24, d: 16, r: 1.5 };
  const out = [S(slab(bin, 0, 10, 3, 0.5), { tone: "lo" })];
  const inner = k.insetPlan(bin, 2);
  out.push(`<path class="iso-shade" data-shade="0" d="${k.slabOf(inner, 10, 0.01, P, 3).fill}"/>`);
  out.push(L(k.planOutline(inner, 10, P, 3), { tone: "lo" }));
  out.push(S(slab({ x: bin.x + 4, y: bin.y + 4, w: 11, d: 7, r: 0.6 }, 4, 0.6, 2), { tone: "lo", crease: "none" }));
  return out.join("");
}
function gateBack() {
  return S(slab({ x: GATE_X - 2, y: -17, w: 4, d: 4, r: 1 }, 0, 24, 3, 0.4), { tone: "mid" });
}
function gateFront() {
  const out = [S(slab({ x: GATE_X - 2, y: 13, w: 4, d: 4, r: 1 }, 0, 24, 3, 0.4), { tone: "mid" })];
  out.push(S(k.cylinder(GATE_X, -1, 1, 14, 10, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(slab({ x: GATE_X - 3, y: -18, w: 6, d: 36, r: 1.2 }, 24, 4, 3, 0.5), { tone: "mid" }));
  out.push(D([at([GATE_X, -15, 28]), at([GATE_X, 15, 28])], { size: 0.45 }));
  return out.join("");
}

// composing stick: stamps each persona page's component tree onto the sheet
function composeColumn() {
  const { x, colY, armZ } = COMPOSE;
  return S(k.cylinder(x, colY, 6, 0, 2, P, 24), { tone: "lo" }) + S(k.cylinder(x, colY, 3, 2, armZ - 2, P, 20), { tone: "mid", crease: "none" }) + L(k.sideArc(x, colY, 3, 12, P, 12), { tone: "faint" });
}
function composeArm() {
  const { x, colY, armZ } = COMPOSE;
  const out = [S(slab({ x: x - 5, y: colY - 5, w: 10, d: colY * -1 + 4, r: 1.6 }, armZ, 5, 3, 0.5), { tone: "mid" })];
  out.push(S(k.cylinder(x, -1, 4.2, armZ - 3, 3, P, 24), { tone: "mid" }));
  out.push(D([at([x, colY, armZ + 5]), at([x, -1, armZ + 5])], { size: 0.45 }));
  return out.join("");
}
function composeRodSvg(headZ) {
  const { x, armZ, headR } = COMPOSE;
  return S(k.cylinder(x, -1, 1.4, headZ + 3, armZ - 3 - headZ - 3, P, 14), { tone: "mid", crease: "none" });
}
function composeHead() {
  const { x, headR } = COMPOSE;
  // built at z = 0; moved
  return S(k.cylinder(x, -1, headR, 0, 3, P, 24, 0.3), { tone: "hi", crease: "lo" }) + L(k.ring(x, -1, headR - 1.4, 3, P, 20), { tone: "lo" });
}

function shuttle() {
  const out = [];
  const car = { x: -11, y: -11, w: 22, d: 20, r: 2 };
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(car, 2), 3, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(`<g data-litgroup="3">${S(slab(car, 3, 4, 4, 0.5), { tone: "mid" })}</g>`);
  const bush = [[-10, -10.5], [5, -10.5], [-10, 3.5], [5, 3.5]];
  for (const [x, y] of byDepth(bush)) out.push(S(slab({ x, y, w: 5, d: 5, r: 1 }, 3, 5.4, 2, 0.3), { tone: "mid" }) + D([at([x + 2.5, y + 2.5, 8.4])], { size: 0.4 }));
  out.push(S(slab({ x: -3, y: 9, w: 6, d: 2, r: 0.6 }, 4, 2, 2), { tone: "mid", crease: "none" }));
  out.push(`<g data-part="order">${S(slab({ x: -7, y: -5, w: 14, d: 8, r: 0.6 }, 7, 0.6, 2), { tone: "hi", crease: "none" })}${L(k.lineOnTop([-5, -2.5], [3, -2.5], 7.6, P), { tone: "lo", free: true })}${L(k.lineOnTop([-5, 0], [5, 0], 7.6, P), { tone: "lo", free: true })}</g>`);
  const marks = [[-5.6, -4.6], [-1.2, -4.6], [3.2, -4.6], [-5.6, 0.2]];
  out.push(
    `<g data-part="sheet" style="display:none">${S(slab({ x: -8, y: -6.5, w: 16, d: 11, r: 0.5 }, 7, 0.6, 2), { tone: "hi", crease: "none" })}` +
      marks.map(([x, y], i) => `<g data-mark="${i}" style="display:none">${L(k.planOutline({ x, y, w: 3.6, d: 3.6, r: 0.4 }, 7.6, P, 2), { tone: "mid" })}</g>`).join("") +
      `</g>`,
  );
  return out.join("");
}
function dock() {
  return S(slab({ x: RAIL_TO, y: -12, w: 4, d: 20, r: 1 }, 0, 9, 3, 0.4), { tone: "mid" }) + D([at([RAIL_TO + 2, -8, 9]), at([RAIL_TO + 2, 4, 9])], { size: 0.45 });
}

// ---------- sources desk and belt ----------
function desk() {
  const out = [`<path class="iso-halo" d="${k.haloOf(DESK, 0, 6, P)}" style="filter:blur(6px)"/>`];
  for (const [x, y] of byDepth(k.corners(DESK, 4))) out.push(S(k.cylinder(x, y, 2, 0, DESK_Z - 2, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(slab(DESK, DESK_Z - 2, 2, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(DESK, 3), DESK_Z, P, 3), { tone: "faint" }));
  for (const s of STACKS) {
    const tray = { x: s.x - 2, y: DESK.y + 6, w: s.w + 4, d: 18, r: 1 };
    out.push(S(slab(tray, DESK_Z, 1.4, 2, 0.3), { tone: "lo" }));
    const plan = { x: s.x, y: DESK.y + 8, w: s.w, d: 14, r: 0.6 };
    if (s.name === "book") {
      out.push(S(slab(plan, DESK_Z + 1.4, s.h, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, DESK_Z + 1.4 + s.h - 1, P, 3), { tone: "faint" }) }));
    } else {
      const seams = [];
      for (let z = DESK_Z + 3; z < DESK_Z + 1.4 + s.h - 0.8; z += 2.2) seams.push(k.sideSeam(plan, z, P, 3));
      out.push(S(slab(plan, DESK_Z + 1.4, s.h, 3, 0.3), { tone: "mid", inner: L(seams.join(""), { tone: "faint" }) }));
      out.push(L(k.lineOnTop([plan.x + 2, plan.y + 4], [plan.x + plan.w - 5, plan.y + 4], DESK_Z + 1.4 + s.h, P), { tone: "lo", free: true }));
    }
  }
  out.push(screwsOn(DESK, DESK_Z, 2.2, 0.4));
  return out.join("");
}
function belt() {
  const { x0, x1, y, d, z } = BELT;
  const out = [];
  for (const x of [x0 + 6, (x0 + x1) / 2, x1 - 6]) for (const yy of [y + 1.5, y + d - 1.5]) out.push(S(k.cylinder(x, yy, 1.2, 0, z - 2, P, 12), { tone: "mid", crease: "none" }));
  const frame = { x: x0, y, w: x1 - x0, d, r: d / 2 - 0.5 };
  out.push(S(slab(frame, z - 2, 2, 6, 0.4), { tone: "mid" }));
  out.push(`<path class="iso-shade" data-shade="1" d="${k.slabOf(k.insetPlan(frame, 1.6), z, 0.01, P, 6).fill}"/>`);
  out.push(L(k.planOutline(k.insetPlan(frame, 1.6), z, P, 6), { tone: "lo" }));
  // slats across the belt, each ending on the belt's inset edge
  for (let x = x0 + 9; x < x1 - 8; x += 7) out.push(L(k.lineOnTop([x, y + 1.6], [x, y + d - 1.6], z, P), { tone: "faint" }));
  out.push(D([at([x0 + 4.4, y + d / 2, z]), at([x1 - 4.4, y + d / 2, z])], { size: 0.5 }));
  return out.join("");
}
function beltCard() {
  const { y, d, z } = BELT;
  const c = { x: -6, y: y + 1.8, w: 12, d: d - 3.6, r: 0.4 };
  return S(slab(c, z + 0.1, 0.6, 2), { tone: "hi", crease: "none" }) + L(k.lineOnTop([c.x + 1.6, c.y + 2], [c.x + 8, c.y + 2], z + 0.7, P), { tone: "mid", free: true }) + L(k.lineOnTop([c.x + 1.6, c.y + 4.2], [c.x + 10, c.y + 4.2], z + 0.7, P), { tone: "mid", free: true });
}

// ---------- cabinet ----------
function cabinet() {
  const out = [`<path class="iso-halo" d="${k.haloOf(CAB, 0, 30, P)}"/>`];
  out.push(S(slab(k.insetPlan(CAB, -2), 0, CAB_Z, 4, 0.6), { tone: "lo" }));
  out.push(S(slab(CAB, CAB_Z, CAB_TOP - CAB_Z, 3, 0), { tone: "mid", inner: L([36, 61].map((z) => k.sideSeam(CAB, z, P, 3)).join(""), { tone: "faint" }) }));
  const cap = k.insetPlan(CAB, -2);
  out.push(S(slab(cap, CAB_TOP, CAP_TOP - CAB_TOP, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(cap, 4), CAP_TOP, P, 4), { tone: "lo" }));
  out.push(screwsOn(cap, CAP_TOP, 3));
  // column dividers on the front face, edge to edge
  for (const x of [0.5, 39.5]) out.push(L(k.segment([x, FRONT_Y + 0.05, CAB_Z], [x, FRONT_Y + 0.05, CAB_TOP], P), { tone: "faint" }));
  for (const t of [DS, OV]) {
    const [x0, x1] = COLS[t.col];
    const [z0, z1] = ROWS[t.row];
    out.push(`<path class="iso-shade" data-shade="0" d="${facePoly(FRONT_Y + 0.05, [[x0 + 1, z0 + 1], [x1 - 1, z0 + 1], [x1 - 1, z1 - 1], [x0 + 1, z1 - 1]])}"/>`);
  }
  for (let c = 0; c < COLS.length; c++)
    for (let r = ROWS.length - 1; r >= 0; r--) {
      if ((c === DS.col && r === DS.row) || (c === OV.col && r === OV.row)) continue;
      out.push(drawerFront(COLS[c], ROWS[r], FRONT_Y));
    }
  // side plate on the right face
  const sx = CAB.x + CAB.w;
  out.push(S(slab({ x: sx, y: -34, w: 0.8, d: 24, r: 0.4 }, 64, 15, 2, 0.3), { tone: "mid" }));
  out.push(L([[-31, 75, -16], [-31, 71.5, -13], [-31, 68, -20]].map(([y0, z, y1]) => k.segment([sx + 0.8, y0, z], [sx + 0.8, y1, z], P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([sx + 0.8, -32.5, 66]), at([sx + 0.8, -11.5, 66])], { size: 0.4 }));
  // reader boss on the right face
  out.push(S(slab({ x: sx, y: ROD_Y - 5, w: 2, d: 10, r: 1 }, ROD_Z - 6, 12, 3, 0.4), { tone: "mid" }));
  return out.join("");
}
function drawerFront([x0, x1], [z0, z1], y) {
  const out = [S(slab({ x: x0, y, w: x1 - x0, d: 2, r: 0.6 }, z0, z1 - z0, 2, 0.4), { tone: "mid" })];
  const cx = (x0 + x1) / 2;
  const mid = (z0 + z1) / 2;
  out.push(S(slab({ x: cx - 7, y: y + 2, w: 14, d: 0.5, r: 0.2 }, z1 - 8, 4, 2), { tone: "lo", crease: "none" }));
  out.push(S(slab({ x: cx - 5, y: y + 2, w: 1.4, d: 1.6, r: 0.3 }, mid - 4, 1.6, 2), { tone: "mid", crease: "none" }));
  out.push(S(slab({ x: cx + 3.6, y: y + 2, w: 1.4, d: 1.6, r: 0.3 }, mid - 4, 1.6, 2), { tone: "mid", crease: "none" }));
  out.push(S(slab({ x: cx - 5.4, y: y + 3.6, w: 10.8, d: 1.4, r: 0.5 }, mid - 4.2, 2, 2), { tone: "mid" }));
  out.push(D([[x0 + 2, z0 + 2], [x1 - 2, z0 + 2], [x0 + 2, z1 - 2], [x1 - 2, z1 - 2]].map(([x, z]) => at([x, y + 2, z])), { size: 0.4, tone: "lo" }));
  return out.join("");
}
function trayDrawer(spot, sheetPart, lit) {
  const [x0, x1] = COLS[spot.col];
  const [z0] = ROWS[spot.row];
  const bx0 = x0 + 2, bx1 = x1 - 2, depth = 18, by0 = FRONT_Y - depth, fz = z0 + 1.4, wallH = 5.5, frontH = 8;
  const out = [];
  out.push(S(slab({ x: bx0, y: by0, w: bx1 - bx0, d: 1.2, r: 0.3 }, fz, wallH, 2), { tone: "lo", crease: "none" }));
  out.push(S(slab({ x: bx0, y: by0, w: 1.2, d: depth, r: 0.3 }, fz, wallH, 2), { tone: "lo", crease: "none" }));
  out.push(S(slab({ x: bx0, y: by0, w: bx1 - bx0, d: depth, r: 0.3 }, fz - 1, 1, 2), { tone: "lo", crease: "none" }));
  const sh = { x: bx0 + 3.5, y: by0 + 3, w: bx1 - bx0 - 7, d: depth - 5, r: 0.4 };
  out.push(`<g data-part="${sheetPart}" style="display:none">${S(slab(sh, fz, 0.6, 2), { tone: "hi", crease: "none" })}${[3, 6, 9].map((dy, i) => L(k.lineOnTop([sh.x + 2.5, sh.y + dy], [sh.x + (i === 1 ? 14 : 20), sh.y + dy], fz + 0.6, P), { tone: "mid", free: true })).join("")}</g>`);
  out.push(S(slab({ x: bx1 - 1.2, y: by0, w: 1.2, d: depth, r: 0.3 }, fz, wallH, 2), { tone: "lo", crease: "none" }));
  const cx = (x0 + x1) / 2;
  const pull = [
    S(slab({ x: cx - 5, y: FRONT_Y + 2, w: 1.4, d: 1.6, r: 0.3 }, z0 + 3, 1.6, 2), { tone: "mid", crease: "none" }),
    S(slab({ x: cx + 3.6, y: FRONT_Y + 2, w: 1.4, d: 1.6, r: 0.3 }, z0 + 3, 1.6, 2), { tone: "mid", crease: "none" }),
    S(slab({ x: cx - 5.4, y: FRONT_Y + 3.6, w: 10.8, d: 1.4, r: 0.5 }, z0 + 2.8, 2, 2), { tone: "mid" }),
  ].join("");
  out.push(`<g data-litgroup="${lit}">${S(slab({ x: x0, y: FRONT_Y, w: x1 - x0, d: 2, r: 0.6 }, z0, frontH, 2, 0.4), { tone: "mid" })}${pull}</g>`);
  out.push(D([[x0 + 2, z0 + 2], [x1 - 2, z0 + 2], [x0 + 2, z0 + frontH - 2], [x1 - 2, z0 + frontH - 2]].map(([x, z]) => at([x, FRONT_Y + 2, z])), { size: 0.4, tone: "lo" }));
  return out.join("");
}
function trayClip(spot) {
  const [x0, x1] = COLS[spot.col];
  const [z0, z1] = ROWS[spot.row];
  const pts = [];
  for (const y of [FRONT_Y + 0.05, FRONT_Y + DRAWER_OUT + 6]) for (const [x, z] of [[x0 + 1, z0 - 1.5], [x1 - 1, z0 - 1.5], [x1 - 1, z1 - 1], [x0 + 1, z1 - 1]]) pts.push(at([x, y, z]));
  return "M" + convexHull(pts).map((q) => q.map((v) => v.toFixed(2)).join(" ")).join("L") + "Z";
}
function clock() {
  const out = [];
  const [x, y] = CLOCK;
  out.push(S(k.cylinder(x, y, CLOCK_R + 2, CAP_TOP, 2, P, 64), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, CLOCK_R, CAP_TOP + 2, CLOCK_TOP - CAP_TOP - 2, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, CLOCK_R, CLOCK_TOP - 2.6, CLOCK_TOP, 80, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, CLOCK_R, CLOCK_TOP - 2.6, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, CLOCK_R - 2.2, CLOCK_TOP, P, 64), { tone: "lo" }));
  const t = k.radialTicks(x, y, CLOCK_R - 2.2, 60, 5, CLOCK_TOP, [1.1, 2.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  const mark = (m, r) => { const a = (m / 60) * Math.PI * 2; return at([x + Math.sin(a) * r, y - Math.cos(a) * r, CLOCK_TOP]); };
  out.push(D([mark(17, CLOCK_R - 6)], { size: 0.9, tone: "hi" }), D([mark(47, CLOCK_R - 6)], { size: 0.8, tone: "mid" }));
  out.push(L(k.ring(x, y, 1.4, CLOCK_TOP, P, 16), { tone: "mid" }));
  return out.join("");
}
const TRIP = (() => { const a = (17 / 60) * Math.PI * 2; return [CLOCK[0] + Math.sin(a) * (CLOCK_R + 5), CLOCK[1] - Math.cos(a) * (CLOCK_R + 5)]; })();
const tripCollar = () => S(k.cylinder(TRIP[0], TRIP[1], 2.6, CAP_TOP, 2.4, P, 20), { tone: "mid" });
const tripPin = () => S(k.cylinder(TRIP[0], TRIP[1], 1.3, CAP_TOP + 2.4, 2.4, P, 16), { tone: "hi", crease: "lo" }) + S(k.cylinder(TRIP[0], TRIP[1], 1.9, CAP_TOP + 4.8, 1, P, 16), { tone: "hi", crease: "lo" });
function tray() {
  const out = [S(slab(TRAY, CAP_TOP, 2.4, 3, 0.4), { tone: "mid" })];
  out.push(`<path class="iso-shade" data-shade="0" d="${k.slabOf(k.insetPlan(TRAY, 2), CAP_TOP + 2.4, 0.01, P, 3).fill}"/>`);
  out.push(L(k.planOutline(k.insetPlan(TRAY, 2), CAP_TOP + 2.4, P, 3), { tone: "lo" }));
  return out.join("");
}
function editCard() {
  const c = { x: TRAY.x + 4, y: TRAY.y + 5, w: TRAY.w - 8, d: TRAY.d - 10, r: 0.6 };
  const z = CAP_TOP + 1.6;
  return S(slab(c, z, 0.7, 2), { tone: "hi", crease: "none" }) + [3, 6, 9].map((dy, i) => L(k.lineOnTop([c.x + 2, c.y + dy], [c.x + (i === 2 ? 9 : 13), c.y + dy], z + 0.7, P), { tone: "mid", free: true })).join("");
}
function rack() {
  // the meta-ontology: object, link, action, interface, shared property, value type, as six type plates in a rack
  const out = [S(slab(RACK, CAP_TOP, 3, 3, 0.4), { tone: "mid" })];
  out.push(L(k.lineOnTop([RACK.x + 2, RACK.y + 7], [RACK.x + RACK.w - 2, RACK.y + 7], CAP_TOP + 3, P), { tone: "lo" }));
  const hs = [12, 10, 11, 8, 9, 7];
  hs.forEach((h, i) => {
    const plan = { x: RACK.x + 3 + i * 4.2, y: RACK.y + 3, w: 1.6, d: 8, r: 0.3 };
    out.push(S(slab(plan, CAP_TOP + 3, h, 2), { tone: "hi", crease: "lo" }));
  });
  out.push(D([at([RACK.x + 1.6, RACK.y + 7, CAP_TOP + 3]), at([RACK.x + RACK.w - 1.6, RACK.y + 7, CAP_TOP + 3])], { size: 0.4 }));
  return out.join("");
}

// ---------- reader rod ----------
function rodStand() {
  const x = (CAB.x + CAB.w + SRV.x) / 2 - 2;
  const out = [S(k.cylinder(x, ROD_Y, 5, 0, 2, P, 24), { tone: "lo" })];
  out.push(S(k.cylinder(x, ROD_Y, 2.2, 2, ROD_Z - 8, P, 16), { tone: "mid", crease: "none" }));
  out.push(L(k.sideArc(x, ROD_Y, 2.2, 14, P, 12), { tone: "faint" }));
  out.push(S(slab({ x: x - 4, y: ROD_Y - 4, w: 8, d: 8, r: 1.2 }, ROD_Z - 6, 4, 3, 0.4), { tone: "mid" }));
  out.push(D([at([x - 2.6, ROD_Y, ROD_Z - 2]), at([x + 2.6, ROD_Y, ROD_Z - 2])], { size: 0.35 }));
  return out.join("");
}
const rodSvg = () => S(slab({ x: ROD_TIP_OUT, y: ROD_Y - 2, w: ROD_LEN, d: 4, r: 1.8 }, ROD_Z - 2, 4, 4, 0), { tone: "hi", crease: "lo" });
function sleeve() {
  const plan = { x: SRV.x - 10, y: ROD_Y - 5, w: 10, d: 10, r: 1.6 };
  return S(slab(plan, ROD_Z - 5, 10, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, ROD_Z, P, 4), { tone: "faint" }) }) + D([at([SRV.x - 5, ROD_Y - 3, ROD_Z + 5]), at([SRV.x - 5, ROD_Y + 3, ROD_Z + 5])], { size: 0.4 });
}

// ---------- server ----------
function server() {
  const out = [`<path class="iso-halo" d="${k.haloOf(SRV, 0, 20, P)}"/>`];
  out.push(S(slab(k.insetPlan(SRV, -2), 0, SRV_Z, 4, 0.6), { tone: "lo" }));
  out.push(S(slab(SRV, SRV_Z, SRV_TOP - SRV_Z, 3, 0), { tone: "mid", inner: L(k.sideSeam(SRV, 50, P, 3), { tone: "faint" }) }));
  const cap = k.insetPlan(SRV, -2);
  out.push(S(slab(cap, SRV_TOP, SRV_CAP - SRV_TOP, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(cap, 4), SRV_CAP, P, 4), { tone: "lo" }));
  out.push(screwsOn(cap, SRV_CAP, 3));
  for (let i = 0; i < 5; i++) out.push(L(k.planOutline({ x: SRV.x + 64 + i * 4, y: -12, w: 1.6, d: 12, r: 0.8 }, SRV_CAP, P, 2), { tone: "lo" }));
  // ask panel plate on top
  const panel = { x: 132, y: -36, w: 46, d: 16, r: 1.4 };
  out.push(S(slab(panel, SRV_CAP, 1, 3, 0.3), { tone: "lo" }));
  // screen
  const y = SFRONT;
  const { x0, x1, z0, z1 } = SCREEN;
  out.push(S(slab({ x: x0 - 3, y, w: x1 - x0 + 6, d: 1.4, r: 1 }, z0 - 3, z1 - z0 + 6, 3, 0.4), { tone: "mid" }));
  const m = k.sideMatrix([0, y + 1.45], 0, P, "left");
  out.push(
    `<g transform="${m}"><rect class="scr-glass" x="${x0}" y="${-z1}" width="${x1 - x0}" height="${z1 - z0}" rx="1.4"/>` +
      `<text class="scr-text" data-part="scr-main" x="${x0 + 3.5}" y="${-z1 + 11}" font-size="6.4">/</text>` +
      `<text class="scr-text scr-sub" data-part="scr-sub" x="${x0 + 3.5}" y="${-z1 + 19.5}" font-size="3.4">site-data</text>` +
      `<rect class="scr-rule" x="${x0 + 3.5}" y="${-z0 - 4.5}" width="${x1 - x0 - 7}" height="0.6"/>` +
      `<rect class="scr-bar" data-part="scr-bar" x="${x0 + 3.5}" y="${-z0 - 4.5}" width="0" height="0.6"/>` +
      `<rect class="scr-frame" x="${x0}" y="${-z1}" width="${x1 - x0}" height="${z1 - z0}" rx="1.4"/></g>`,
  );
  // fallback trays: OneDrive, local copy, committed snapshot
  TIERS.forEach(([a, b], i) => {
    out.push(S(slab({ x: TIER_X, y, w: 20, d: 1.6, r: 0.5 }, a, b - a, 2, 0.3), { tone: "mid" }));
    out.push(S(slab({ x: TIER_X + 7, y: y + 1.6, w: 6, d: 1, r: 0.4 }, (a + b) / 2 - 0.8, 1.6, 2), { tone: "mid", crease: "none" }));
    out.push(`<g data-led="tier-${i}" class="led">${D([at([TIER_X + 2.6, y + 1.6, b - 2.4])], { size: 0.8, tone: "faint" })}</g>`);
  });
  // build-log window: a narrow slot with a counter that the press writes to
  out.push(S(slab({ x: 211, y, w: 14, d: 1.2, r: 0.5 }, 30, 14, 2, 0.3), { tone: "mid" }));
  out.push(`<path class="iso-shade" data-shade="0" d="${facePoly(y + 1.25, [[213, 33], [223, 33], [223, 41], [213, 41]])}"/>`);
  out.push(`<g transform="${k.sideMatrix([0, y + 1.3], 0, P, "left")}"><text class="scr-text scr-sub" data-part="build-n" x="218" y="-35.4" font-size="3.6" text-anchor="middle">0</text></g>`);
  // vents on the right face
  const rx = SRV.x + SRV.w;
  for (let i = 0; i < 7; i++) {
    const y0 = SRV.y + 8 + i * 5.2;
    out.push(L(xFacePoly(rx, [[y0, 14], [y0 + 2, 14], [y0 + 2, 40], [y0, 40]]), { tone: "lo" }));
  }
  out.push(D([130, 160, 196, 224].map((x) => at([x, SFRONT + 2, 3])), { size: 0.45, tone: "lo" }));
  return out.join("");
}
function ttlDial() {
  const out = [];
  const [x, y] = TTL;
  out.push(S(k.cylinder(x, y, TTL_R, SRV_CAP, TTL_TOP - SRV_CAP, P, 56, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, TTL_R, TTL_TOP - 2, TTL_TOP, 60, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, TTL_R, TTL_TOP - 2, P, 32), { tone: "faint" }));
  out.push(L(k.ring(x, y, TTL_R - 1.8, TTL_TOP, P, 48), { tone: "lo" }));
  const t = k.radialTicks(x, y, TTL_R - 1.8, 30, 6, TTL_TOP, [1, 2], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.1, TTL_TOP, P, 12), { tone: "mid" }));
  return out.join("");
}
const askCollar = ([x, y]) => S(k.cylinder(x, y, 5.2, SRV_CAP + 1, 1.4, P, 28), { tone: "lo" }) + L(k.ring(x, y, 4, SRV_CAP + 2.4, P, 24), { tone: "lo" });
const askButton = ([x, y]) => S(k.cylinder(x, y, 3.4, SRV_CAP + 2.4, 2.8, P, 24, 0.3), { tone: "mid" });

// ---------- visitors ----------
function kioskCables() {
  const z = 0.5;
  return KIOSKS.map(({ x }) => wire([[x, SFRONT + 2.05, 3], [x, SFRONT + 2.05, z], [x, KIOSK_Y - 6, z], [x, KIOSK_Y - 6, 1.6]], "from")).join("");
}
function kiosk({ label, x }, i) {
  const out = [];
  const y = KIOSK_Y;
  out.push(S(k.cylinder(x, y, 6, 0, 1.6, P, 28), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 1.8, 1.6, 8.4, P, 16), { tone: "mid", crease: "none" }));
  const head = { x: x - 8, y: y - 3, w: 16, d: 6, r: 1 };
  out.push(S(slab(head, 10, 11, 3, 0.4), { tone: "mid" }));
  const fy = head.y + head.d;
  const m = k.sideMatrix([0, fy + 0.02], 0, P, "left");
  out.push(`<g transform="${m}"><rect class="scr-glass" x="${x - 6.4}" y="-19.6" width="12.8" height="7.6" rx="0.8"/><text class="scr-text scr-k" x="${x}" y="-14.7" font-size="2.7" text-anchor="middle">${label}</text><rect class="scr-frame" x="${x - 6.4}" y="-19.6" width="12.8" height="7.6" rx="0.8"/></g>`);
  out.push(`<g data-led="kiosk-${i}" class="led">${D([at([x + 5, y, 21])], { size: 0.85, tone: "faint" })}</g>`);
  out.push(L(k.ring(x + 5, y, 1.4, 21, P, 12), { tone: "lo" }));
  return out.join("");
}

// ---------- Neon ----------
function neon() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(NEON, 2), 0, 2, P)}" style="filter:blur(5px)"/>`];
  out.push(S(slab(NEON, 0, 4, 4, 0.5), { tone: "lo" }));
  const body = k.insetPlan(NEON, 1.5);
  out.push(S(slab(body, 4, NEON_H - 4, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(body, 12, P, 4), { tone: "faint" }) }));
  const top = NEON_H;
  out.push(L(k.planOutline(k.insetPlan(NEON, 5), top, P, 3), { tone: "faint" }));
  for (let i = 0; i < 5; i++) out.push(L(k.planOutline({ x: NEON.x + 7 + i * 4.2, y: NEON.y + 7, w: 1.6, d: 11, r: 0.8 }, top, P, 2), { tone: "lo" }));
  // writers: articles mirror, build log, Ask messages
  ["neon-0", "neon-1", "neon-2"].forEach((n, i) => out.push(led(n, NEON.x + 32 + i * 5.5, NEON.y + 12, top)));
  out.push(screwsOn(body, top, 3));
  return out.join("");
}
function neonCable() {
  const z = 0.5;
  return wire([[SRV.x + SRV.w + 2, -37, 3], [SRV.x + SRV.w + 2.1, -37, z], [NEON.x + 20, -37, z], [NEON.x + 20, NEON.y + NEON.d, z], [NEON.x + 20, NEON.y + NEON.d, 3]], "both");
}

// ---------- needles ----------
const handAt = (minute) => {
  const a = (minute / 60) * Math.PI * 2;
  const [x, y] = CLOCK;
  return k.lineOnTop([x - Math.sin(a) * 3, y + Math.cos(a) * 3], [x + Math.sin(a) * (CLOCK_R - 3.4), y - Math.cos(a) * (CLOCK_R - 3.4)], CLOCK_TOP + 0.2, P);
};
const ttlAt = (share) => {
  const a = share * Math.PI * 2;
  const [x, y] = TTL;
  return k.lineOnTop([x - Math.sin(a) * 2, y + Math.cos(a) * 2], [x + Math.sin(a) * (TTL_R - 2.6), y - Math.cos(a) * (TTL_R - 2.6)], TTL_TOP + 0.2, P);
};

const LABEL =
  "hsol.info 구조를 작업대 위 기계들로 그린 그림. 왼쪽 앞 책상의 원천 기록이 컨베이어로 카드 서랍장(OneDrive vault)에 들어가고, 서랍장 위 시계가 매시 17분 바뀐 것을 찾는다. 셔틀이 작업 지시를 왼쪽 프레스(GitHub Actions 빌드)로 싣고 가 Claude 가 site-data 를 찍고, 조판기가 페르소나 페이지 넷의 구성을 찍은 뒤 검사 게이트를 지나 object-views 서랍에 되넣는다. 뒤쪽 원페이저 장치는 이력서 한 장을 한국어, 영어, PDF 로 만든다. 오른쪽 단말(Next.js 서버)은 막대로 서랍을 읽어 5분 캐시하고 앞의 키오스크 다섯 곳에 화면을 낸다. 단말 위 버튼 셋은 Ask Hansol 이고, 오른쪽 뒤 상자는 Neon Postgres, 왼쪽 뒤 상자는 AI Gateway 다.";

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [
    plate(),
    backCables(),
    onepager(),
    `<g data-part="op-sheet" data-litgroup="6" transform="${k.translateAlong(P, [0, 0, 0])}">${onepagerSheet()}</g>`,
    rails(),
    pedestals(),
    `<g data-part="posts-back"></g>`,
    gateBack(),
    composeColumn(),
    `<g data-part="shuttle" transform="${k.translateAlong(P, [SHUTTLE_DOCK, 0, 0])}">${shuttle()}</g>`,
    `<g data-part="platen" data-litgroup="4" transform="${k.translateAlong(P, [0, 0, PLATEN_REST])}">${platenSvg()}</g>`,
    `<g data-part="shaft"></g>`,
    `<g data-part="posts-near"></g>`,
    crown(),
    `<g data-part="c-rod"></g>`,
    `<g data-part="c-head" data-litgroup="5" transform="${k.translateAlong(P, [0, 0, COMPOSE.rest])}">${composeHead()}</g>`,
    composeArm(),
    gateFront(),
    dock(),
    rejectBin(),
    cabinet(),
    `<clipPath id="ds-clip"><path d="${trayClip(DS)}"/></clipPath><g clip-path="url(#ds-clip)"><g data-part="ds">${trayDrawer(DS, "ds-sheet", 0)}</g></g>`,
    `<clipPath id="ov-clip"><path d="${trayClip(OV)}"/></clipPath><g clip-path="url(#ov-clip)"><g data-part="ov">${trayDrawer(OV, "ov-sheet", 7)}</g></g>`,
    desk(),
    belt(),
    `<g data-part="belt-card" data-litgroup="0" style="display:none">${beltCard()}</g>`,
    clock(),
    `<path data-part="hand" class="iso-line" data-tone="hi" data-free="start" d="${handAt(5)}" style="stroke-width:1.1"/>`,
    tripCollar(),
    `<g data-part="trip" data-litgroup="2">${tripPin()}</g>`,
    tray(),
    `<g data-part="card" data-litgroup="1" transform="${k.translateAlong(P, [0, 0, DROP])}">${editCard()}</g>`,
    rack(),
    rodStand(),
    `<g data-part="rod" data-litgroup="8" transform="${k.translateAlong(P, [ROD_STROKE, 0, 0])}">${rodSvg()}</g>`,
    sleeve(),
    server(),
    ttlDial(),
    `<path data-part="ttl" class="iso-line" data-tone="hi" data-free="start" d="${ttlAt(0)}" style="stroke-width:0.9"/>`,
    ...ASKS.map((p, i) => askCollar(p) + `<g data-part="ask-${i}" data-litgroup="9">${askButton(p)}</g>`),
    neonCable(),
    neon(),
    gateway(),
    kioskCables(),
    ...KIOSKS.map(kiosk),
  ],
});

const STAGES = [
  "01 원천 / 블로그, Medium, LinkedIn, 책",
  "02 편집 / 사람과 Claude 가 vault 수정",
  "03 감시 / 매시 :17, 보조 :47",
  "04 디스패치 / 바뀐 경로를 싣고",
  "05 생성 / Claude 가 site-data 재작성",
  "06 컴포지션 / 페이지 구성 조판",
  "07 원페이저 / KO 작성, EN 번역, PDF",
  "08 게시 / 검증 통과분만 object-views 로",
  "09 서빙 / Graph 읽기, 5분 캐시",
  "10 Ask Hansol / 도구 루프 최대 4단계",
];
const PAGES = ["hire", "collab", "builder", "curious"];
// stage subtitles: [start share within the stage, sentence]
const SUBS = [
  [[0, "원본은 개인 OneDrive 의 vault 한 곳에만 있습니다."], [0.45, "블로그와 Medium, LinkedIn, 책은 원천 코퍼스로 보존됩니다."]],
  [[0, "사람과 Claude 가 vault 의 객체 노트를 고칩니다."]],
  [[0, "감시 워크플로가 매시 17분에 바뀐 경로를 찾습니다."], [0.5, "GitHub 스케줄이 빠지면 Vercel Cron 이 47분에 대신 깨웁니다."]],
  [[0, "바뀐 경로 목록을 실어 빌드를 디스패치합니다."]],
  [[0, "빌드는 vault 를 내려받아 Claude 로 site-data 를 다시 씁니다."]],
  [[0, "페르소나 페이지 넷의 구성은 한 장씩 따로 만듭니다."]],
  [[0, "원페이저는 한국어로 쓴 뒤 영어로 옮기고, 자기지칭 검사와 PDF 까지 마칩니다."]],
  [[0, "스키마 검증을 통과한 생성물만 object-views 로 되씁니다."]],
  [[0, "사이트는 새 배포를 기다리지 않고 Graph API 로 그 파일을 읽어 5분 동안 캐시합니다."], [0.5, "읽지 못하면 로컬 사본, 커밋된 스냅샷 순으로 내려갑니다."]],
  [[0, "Ask Hansol 은 대화창, JD 적합도, 드래그 질문 세 갈래로 들어옵니다."], [0.4, "같은 vault 를 직접 찾아 답하고, 대화와 빌드 기록, 기사 사본은 Neon 에 쌓입니다."]],
];
const ROUTES = ["/hire", "/collab", "/builder", "/curious", "news."];
const ASK_KINDS = ["ChatDock", "JD 적합도", "드래그 질문"];

const live = `
const P = ${JSON.stringify(P)};
const POSTS = ${JSON.stringify(POSTS)}, POST_R = ${POST_R}, NEAR = ${NEAR_POST}, NEAR_POST = ${NEAR_POST}, CROWN_Z = ${CROWN_Z}, PLATEN_H = ${PLATEN_H};
const WHEEL = ${JSON.stringify(WHEEL)}, COMPOSE = ${JSON.stringify(COMPOSE)};
const REST = ${PLATEN_REST}, DOWN = ${PLATEN_DOWN}, DOCK = ${SHUTTLE_DOCK}, PRESS = ${SHUTTLE_PRESS}, COMP = ${SHUTTLE_COMPOSE};
const DROP = ${DROP}, DRAWER_OUT = ${DRAWER_OUT}, STROKE = ${ROD_STROKE};
const BELT = ${JSON.stringify(BELT)};
const CLOCK = ${JSON.stringify(CLOCK)}, CLOCK_R = ${CLOCK_R}, CLOCK_TOP = ${CLOCK_TOP};
const TTL = ${JSON.stringify(TTL)}, TTL_R = ${TTL_R}, TTL_TOP = ${TTL_TOP};
const SUBS = ${JSON.stringify(SUBS)};
const STAGES = ${JSON.stringify(STAGES)}, PAGES = ${JSON.stringify(PAGES)}, ROUTES = ${JSON.stringify(ROUTES)}, ASK_KINDS = ${JSON.stringify(ASK_KINDS)};
const N = STAGES.length, DUR = 3.2, TOTAL = N * DUR;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (name) => svg.querySelector('[data-part="' + name + '"]');
const parts = Object.fromEntries(["shuttle","platen","shaft","posts-back","posts-near","ov","ds","hand","trip","card","rod","ttl","order","sheet","ov-sheet","ds-sheet","scr-main","scr-sub","scr-bar","belt-card","c-rod","c-head","op-sheet","ask-0","ask-1","ask-2","build-n"].map((n) => [n, $(n)]));
const marks = [...svg.querySelectorAll("[data-mark]")];
const litGroups = [...svg.querySelectorAll("[data-litgroup]")];
const leds = Object.fromEntries([...svg.querySelectorAll("[data-led]")].map((el) => [el.dataset.led, el]));
const readout = document.querySelector("[data-readout]");
const subEl = document.createElement("div");
subEl.className = "flow-sub";
subEl.setAttribute("aria-live", "polite");
document.querySelector(".iso-plate").appendChild(subEl);
let subNow = "", subTimer = 0;
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const bump = (c, p, w = 0.05) => ss(c - w, c, p) * (1 - ss(c + w * 0.6, c + w * 1.6, p));
const postSvg = ${postSvg.toString().replace(/k\./g, "").replace(/\bS\(/g, "solidSvg(")};
const shaftSvg = ${shaftSvg.toString().replace(/k\./g, "").replace(/\bS\(/g, "solidSvg(")};
const composeRodSvg = ${composeRodSvg.toString().replace(/k\./g, "").replace(/\bS\(/g, "solidSvg(")};
const handAt = ${handAt.toString().replace(/k\./g, "")};
const ttlAt = ${ttlAt.toString().replace(/k\./g, "")};

// the model: every part is a pure function of the clock t in [0, TOTAL)
function model(t) {
  const s = Math.min(N - 1, Math.floor(t / DUR)), p = (t - s * DUR) / DUR;
  const m = { s, p, text: STAGES[s] };
  m.sub = SUBS[s].filter(([at]) => p >= at).pop()[1];
  m.beltX = BELT.x0 + 10; m.beltOn = false; m.ds = 0; m.dsSheet = s > 0 || p > 0.66;
  if (s === 0) {
    m.beltOn = p > 0.06 && p < 0.66;
    m.beltX = BELT.x0 + 10 + (BELT.x1 - 12 - BELT.x0 - 10 - 7) * ss(0.08, 0.5, p);
    m.ds = DRAWER_OUT * ss(0.44, 0.58, p) * (1 - ss(0.74, 0.94, p));
  }
  m.card = s === 1 ? DROP * (1 - ss(0.1, 0.6, p)) : s === 0 ? DROP : 0;
  m.cardOn = s >= 1 && (s <= 2 || (s === 3 && p < 0.08));
  m.minute = s <= 1 ? 5 : s === 2 ? 5 + 12 * ss(0.05, 0.7, p) : 17;
  m.trip = s === 2 ? 3.2 * ss(0.66, 0.74, p) * (1 - ss(0.86, 0.98, p)) : 0;
  m.x = DOCK; m.platen = REST; m.order = false; m.sheet = false; m.marks = 0; m.head = COMPOSE.rest;
  m.op = 0; m.opOn = false; m.ov = 0; m.ovSheet = false;
  m.rod = 0; m.ttl = 0; m.ask = [0, 0, 0]; m.tier = -1; m.screen = -1; m.bar = 0; m.kiosk = -1;
  m.neon = -1; m.gateway = false; m.opLed = -1; m.build = s >= 6 || (s === 5 && p > 0.9) ? 1 : 0;
  if (s === 2 && p > 0.8) m.neon = 0;
  if (s === 3) { m.order = p > 0.08; m.x = DOCK + (PRESS - DOCK) * ss(0.15, 0.9, p); }
  if (s === 4) {
    m.x = PRESS;
    m.platen = REST + (DOWN - REST) * ss(0.12, 0.42, p) * (1 - ss(0.62, 0.9, p));
    m.order = p < 0.45; m.sheet = !m.order;
    m.gateway = p > 0.1 && p < 0.5;
  }
  if (s === 5) {
    m.x = PRESS + (COMP - PRESS) * ss(0.02, 0.24, p);
    m.sheet = true;
    const taps = [0.36, 0.5, 0.64, 0.78];
    let down = 0; taps.forEach((c) => { down = Math.max(down, bump(c, p, 0.04)); });
    m.head = COMPOSE.rest - (COMPOSE.rest - COMPOSE.tap) * down;
    m.marks = taps.filter((c) => p > c).length;
    m.text = "06 컴포지션 / " + (m.marks ? "/" + PAGES[m.marks - 1] + " 조판 " + m.marks + "/4" : "페이지 구성 조판");
    if (p > 0.9) m.neon = 1;
  }
  if (s === 6) {
    m.x = COMP; m.sheet = true; m.marks = 4;
    m.op = 16 * ss(0.08, 0.32, p) * (1 - ss(0.84, 0.98, p)); m.opOn = p > 0.06 && p < 0.98;
    m.opLed = p < 0.3 ? -1 : p < 0.5 ? 0 : p < 0.7 ? 1 : 2;
    m.gateway = p > 0.45 && p < 0.65;
  }
  if (s === 7) {
    m.x = COMP + (DOCK - COMP) * ss(0.02, 0.45, p);
    m.marks = 4;
    m.ov = DRAWER_OUT * ss(0.42, 0.58, p) * (1 - ss(0.8, 0.98, p));
    m.sheet = p < 0.64; m.ovSheet = !m.sheet;
  }
  if (s >= 8) m.ovSheet = true;
  if (s === 8) {
    m.rod = ss(0.06, 0.2, p) * (1 - ss(0.3, 0.42, p));
    m.tier = p > 0.16 && p < 0.36 ? 0 : -1;
    m.ttl = p < 0.2 ? 0 : ss(0.2, 1, p) * 0.3;
    m.bar = ss(0.06, 0.2, p);
    m.kiosk = p < 0.36 ? -1 : Math.min(4, Math.floor((p - 0.36) / 0.12));
    m.screen = m.kiosk;
    if (m.kiosk >= 0) m.text = "09 서빙 / 5분 캐시, " + ROUTES[m.kiosk] + (m.kiosk === 4 ? "hsol.info" : "");
  }
  if (s === 9) {
    m.ttl = 0.3 + 0.06 * p;
    const which = Math.min(2, Math.floor(p / 0.11));
    m.ask = [0, 1, 2].map((i) => 1.6 * bump(0.06 + i * 0.1, p, 0.03));
    let tap = 0; [0.44, 0.56, 0.68, 0.8].forEach((c) => { tap = Math.max(tap, bump(c, p, 0.035)); });
    m.rod = tap * 0.92;
    m.screen = -2; m.askKind = p < 0.34 ? which : -1;
    m.bar = clamp((p - 0.38) / 0.5, 0, 1);
    m.gateway = p > 0.36 && p < 0.86;
    if (p > 0.88) m.neon = 2;
    if (p < 0.34) m.text = "10 Ask Hansol / " + ASK_KINDS[which];
  }
  return m;
}

let t = 0, target = 0, touring = !still.matches, frame = 0, last = 0, visible = false, idle = 0, lastStage = -1;
const KEYS = ["card","minute","trip","x","platen","head","op","ov","ds","beltX","rod","ttl","ask0","ask1","ask2"];
const goalOf = (m, key) => key.startsWith("ask") ? m.ask[+key[3]] : m[key];
const shown = {};
function sync(m) { for (const key of KEYS) shown[key] = goalOf(m, key); }
function draw(m) {
  parts["belt-card"].style.display = m.beltOn ? "" : "none";
  parts["belt-card"].setAttribute("transform", translateAlong(P, [shown.beltX, 0, 0]));
  parts.ds.setAttribute("transform", translateAlong(P, [0, shown.ds, 0]));
  parts["ds-sheet"].style.display = m.dsSheet ? "" : "none";
  parts.card.setAttribute("transform", translateAlong(P, [0, 0, shown.card]));
  parts.card.style.display = m.cardOn ? "" : "none";
  parts.hand.setAttribute("d", handAt(shown.minute));
  parts.trip.setAttribute("transform", translateAlong(P, [0, 0, shown.trip]));
  parts.shuttle.setAttribute("transform", translateAlong(P, [shown.x, 0, 0]));
  parts.order.style.display = m.order ? "" : "none";
  parts.sheet.style.display = m.sheet ? "" : "none";
  marks.forEach((el, i) => { el.style.display = i < m.marks ? "" : "none"; });
  parts.platen.setAttribute("transform", translateAlong(P, [0, 0, shown.platen]));
  parts.shaft.innerHTML = shaftSvg(shown.platen);
  parts["posts-back"].innerHTML = [0, 1, 2].map((i) => postSvg(i, shown.platen)).join("");
  parts["posts-near"].innerHTML = postSvg(NEAR, shown.platen);
  parts["c-head"].setAttribute("transform", translateAlong(P, [0, 0, shown.head]));
  parts["c-rod"].innerHTML = composeRodSvg(shown.head);
  parts["op-sheet"].setAttribute("transform", translateAlong(P, [0, shown.op, 0]));
  parts["op-sheet"].style.display = m.opOn ? "" : "none";
  parts.ov.setAttribute("transform", translateAlong(P, [0, shown.ov, 0]));
  parts["ov-sheet"].style.display = m.ovSheet ? "" : "none";
  parts.rod.setAttribute("transform", translateAlong(P, [STROKE * (1 - shown.rod), 0, 0]));
  parts.ttl.setAttribute("d", ttlAt(shown.ttl));
  for (let i = 0; i < 3; i++) parts["ask-" + i].setAttribute("transform", translateAlong(P, [0, 0, -shown["ask" + i]]));
  let main = "/", sub = "site-data";
  if (m.screen >= 0) { main = ROUTES[m.screen]; sub = m.screen === 4 ? "hsol.info" : "SSR"; }
  if (m.screen === -2) { main = "ask"; sub = m.askKind >= 0 ? ASK_KINDS[m.askKind] : "vault_lookup"; }
  if (parts["scr-main"].textContent !== main) parts["scr-main"].textContent = main;
  if (parts["scr-sub"].textContent !== sub) parts["scr-sub"].textContent = sub;
  parts["scr-bar"].setAttribute("width", (m.bar * 45).toFixed(2));
  const n = String(m.build ? 1 : 0);
  if (parts["build-n"].textContent !== n) parts["build-n"].textContent = n;
  for (let i = 0; i < 3; i++) leds["tier-" + i].toggleAttribute("data-on", m.tier === i);
  for (let i = 0; i < 3; i++) leds["neon-" + i].toggleAttribute("data-on", m.neon === i);
  for (let i = 0; i < 5; i++) leds["kiosk-" + i].toggleAttribute("data-on", m.kiosk === i);
  leds["gateway"].toggleAttribute("data-on", m.gateway);
  ["op-ko", "op-en", "op-gate"].forEach((n, i) => leds[n].toggleAttribute("data-on", m.opLed >= i));
  if (m.s !== lastStage) {
    lastStage = m.s;
    for (const g of litGroups) {
      const on = Number(g.dataset.litgroup) === m.s;
      g.querySelectorAll(".iso-solid").forEach((el) => el.toggleAttribute("data-lit", on));
    }
    parts.hand.dataset.tone = m.s === 2 ? "lit" : "hi";
    stage.setAttribute("aria-valuenow", String(m.s + 1));
    stage.setAttribute("aria-valuetext", STAGES[m.s]);
  }
  if (readout.textContent !== m.text) readout.textContent = m.text;
  if (m.sub !== subNow) {
    subNow = m.sub;
    clearTimeout(subTimer);
    subEl.classList.add("is-out");
    subTimer = setTimeout(() => { subEl.textContent = subNow; subEl.classList.remove("is-out"); }, still.matches ? 0 : 160);
  }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { target = (target + dt) % TOTAL; t = target; }
  else { const kk = calm ? 1 : 1 - Math.exp(-dt / 0.35); t += (target - t) * kk; if (Math.abs(target - t) < 0.002) t = target; }
  const m = model(t);
  const f = calm ? 1 : 1 - Math.exp(-dt / 0.06);
  for (const key of KEYS) {
    const goal = goalOf(m, key);
    shown[key] += (goal - shown[key]) * f;
    if (Math.abs(goal - shown[key]) < 0.002) shown[key] = goal;
  }
  draw(m);
  const settled = !touring && t === target && KEYS.every((key) => shown[key] === goalOf(m, key));
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const SHOW = [0.6, 0.9, 0.9, 0.95, 0.5, 0.82, 0.62, 0.7, 0.62, 0.5];
const endOf = (s) => s * DUR + DUR * SHOW[s];
const steer = (s) => {
  touring = false;
  target = endOf(clamp(s, 0, N - 1));
  clearTimeout(idle);
  idle = setTimeout(() => { if (!still.matches) { touring = true; target = t; run(); } }, 3600);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const SCROLL = new URLSearchParams(location.search).has("scroll");
if (!SCROLL) {
  stage.addEventListener("pointermove", (event) => { const box = svg.getBoundingClientRect(); steer(Math.floor(clamp((event.clientX - box.left) / box.width, 0, 0.999) * N)); });
  stage.addEventListener("pointerdown", (event) => { const box = svg.getBoundingClientRect(); steer(Math.floor(clamp((event.clientX - box.left) / box.width, 0, 0.999) * N)); });
}
stage.addEventListener("keydown", (event) => {
  const here = Math.min(N - 1, Math.floor(target / DUR));
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = here + 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = here - 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = N - 1;
  if (to === null) return;
  event.preventDefault();
  steer(clamp(to, 0, N - 1));
});
if (still.matches) { touring = false; t = target = endOf(8); }
sync(model(t));
draw(model(t));
if (SCROLL) {
  touring = false;
  const hint = document.querySelector('[data-corner="hint"]');
  if (hint) hint.textContent = "스크롤하면 단계가 넘어갑니다";
  window.hsolFlow = {
    stages: N,
    progress(share) {
      clearTimeout(idle);
      target = clamp(share, 0, 1) * (TOTAL - 0.001);
      if (still.matches) t = target;
      run();
    },
  };
  window.dispatchEvent(new Event("hsolflow:ready"));
}
`;

const THEME_CSS = `
.iso{--anatomy-page:#0a2131;--anatomy-card:#0e2a3d;--anatomy-text:#a9c6d6;--anatomy-strong:#f2f7fa;--anatomy-muted:#5e93b1;
--anatomy-paper:#0e2a3d;--anatomy-face:#14384f;--anatomy-top:#173e56;
--anatomy-shade-0:#0f2c40;--anatomy-shade-1:#113044;--anatomy-shade-2:#133449;--anatomy-shade-3:#15384e;
--anatomy-lit-top:#2a4c55;--anatomy-lit-shade:#1d4352;
--anatomy-hi:#d6e3ec;--anatomy-mid:#5e93b1;--anatomy-lo:#2e6889;--anatomy-faint:#1d4866;--anatomy-lit:#f4c977;
--anatomy-halo:#04121c;--anatomy-halo-opacity:.85;--anatomy-dot:#d6e3ec}
.iso[data-theme="light"]{--anatomy-lit:#b07a12}
.iso-stage{outline:none;touch-action:pan-y;cursor:ew-resize}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.scr-glass{fill:var(--anatomy-shade-0);stroke:none}
.scr-frame{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.scr-text{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);letter-spacing:.02em}
.scr-sub{fill:var(--anatomy-mid)}
.scr-k{fill:var(--anatomy-mid)}
.scr-rule{fill:var(--anatomy-faint)}
.scr-bar{fill:var(--anatomy-lit)}
.iso-plate{overflow:hidden}
.flow-sub{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);width:max-content;max-width:min(82%,640px);padding:7px 14px;border-radius:4px;background:rgba(8,28,42,.78);box-shadow:0 0 0 1px var(--anatomy-faint);color:var(--anatomy-strong);font:500 clamp(12px,1.55vw,15px)/1.55 "Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;text-align:center;word-break:keep-all;text-wrap:balance;pointer-events:none;transition:opacity .16s ease,transform .16s ease}
.flow-sub.is-out{opacity:0;transform:translate(-50%,3px)}
.flow-sub:empty{display:none}
.iso[data-theme="light"] .flow-sub{background:rgba(255,255,255,.86)}
@media (max-width:560px){.flow-sub{bottom:62px;max-width:92%;padding:6px 10px}}
@media (prefers-reduced-motion:reduce){.flow-sub{transition:none}}
.led circle{transition:opacity .25s}
.led[data-on] circle{fill:var(--anatomy-lit);opacity:1}
@media (max-width:560px){.iso-stage .iso-svg{width:122%;margin-left:-11%}}
`;

const KEYS_LEGEND = [
  { mark: "lit", label: "지금 일하는 부품" },
  { mark: "raised", label: "왼쪽 앞 책상: 블로그 1008편, Medium 49편, LinkedIn 댓글 174건+, 단행본 1권" },
  { mark: "raised", label: "카드 서랍장: OneDrive vault. 왼쪽부터 원천 코퍼스, 객체, ObjectView 칸. 위 선반은 메타 온톨로지" },
  { mark: "raised", label: "프레스, 조판기, 게이트: GitHub Actions 빌드와 LLM ETL" },
  { mark: "raised", label: "단말과 키오스크: Vercel 위 Next.js 서버, 방문자 다섯 갈래" },
  { mark: "flat", label: "뒤쪽 상자: 왼쪽 AI Gateway, 오른쪽 Neon Postgres" },
];
const CAPTION =
  "원본은 개인 OneDrive 의 vault 한 곳에만 있습니다. 블로그와 Medium, LinkedIn, 책은 원천 코퍼스로 보존되고, 사람과 Claude 가 객체 노트를 고칩니다. 감시 워크플로가 매시 17분에 바뀐 경로를 찾아 빌드를 디스패치하고, GitHub 스케줄이 빠지면 Vercel Cron 이 47분에 대신 깨웁니다. 빌드는 Claude 로 site-data 를 다시 쓰고, 페르소나 페이지 넷의 구성을 한 장씩 따로 만들고, 원페이저를 한국어로 쓴 뒤 영어로 옮겨 자기지칭 검사와 PDF 까지 마칩니다. 스키마 검증을 통과한 생성물만 object-views 로 되씁니다. 사이트는 새 배포를 기다리지 않고 Graph API 로 그 파일을 읽어 5분 동안 캐시하며, 읽지 못하면 로컬 사본, 커밋된 스냅샷 순으로 내려갑니다. Ask Hansol 은 대화창, JD 적합도, 드래그 질문 세 갈래로 들어와 vault 를 직접 찾아 답하고, 대화와 빌드 기록, 기사 사본은 Neon 에 쌓입니다.";

const stageDiv = `<div class="iso-stage" tabindex="0" role="slider" aria-label="hsol.info 구조: 좌우 화살표 키로 열 단계를 오간다" aria-valuemin="1" aria-valuemax="10" aria-valuenow="1">${svg}</div>`;
const body = k.plateHtml({ fig: "Fig 2", title: "hsol.info 구조", hint: "가로로 훑거나 화살표 키", readout: STAGES[0], keys: KEYS_LEGEND, caption: CAPTION, body: stageDiv });
const name = theme === "light" ? "hsol-arch-light.html" : "hsol-arch.html";
const page = k.pageHtml({ title: "hsol.info 구조", theme, body, script: kitScript() + live, width: 1000 }).replace("</style>", THEME_CSS + "</style>");
writeFileSync(join(HERE, name), page);
console.log("wrote", name, (page.length / 1024).toFixed(0) + "KB");

if (EMBED_OUT) {
  const plate = k.plateHtml({ fig: "Fig 2", title: "hsol.info 구조", hint: "가로로 훑거나 화살표 키", readout: STAGES[0], keys: [], body: stageDiv });
  const EMBED_CSS = `html,body{background:transparent!important}.iso-page{width:100%;margin:0;padding:1px}.iso-figure{margin:0}`;
  const embed = k.pageHtml({ title: "hsol.info 구조", theme, body: plate, script: kitScript() + live, width: 2000 }).replace("</style>", THEME_CSS + EMBED_CSS + "</style>").replace('<html lang="en">', '<html lang="ko">');
  writeFileSync(EMBED_OUT, embed);
  console.log("wrote embed", EMBED_OUT);
}
export { CAPTION, KEYS_LEGEND, STAGES };
