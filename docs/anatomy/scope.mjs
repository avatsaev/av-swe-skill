// Fig 2 · av-swe scope: a copying pantograph. A stylus follows the walls of the real code
// (and the grilled brief) and a pen draws their outline, at half scale, onto spec cards.
//   node docs/anatomy/scope.mjs   -> docs/anatomy/scope.html, scope-light.html
import { ENGINE, loadKit, writePages } from "./common.mjs";

const { k, kitScript } = await loadKit();

const WIDTH = 760;
const HEIGHT = 430;

// ---- world --------------------------------------------------------------------------------
const O = [0, 50]; // fixed pivot
const RATIO = 0.5; // pen = O + RATIO (stylus - O)
const ARM = 170; // both long arms
const PLATE = { x: -30, y: -112, w: 362, d: 190, r: 9 };
const PLATE_H = 12;
const FOOT_H = 5;
const BED = { x: 178, y: -60, w: 138, d: 130, r: 4 };
const BED_H = 3;
const SR = 1.6; // stylus radius: the path runs this far off each wall
const TABLE = { x: 84, y: -10, w: 76, d: 76, r: 3 };
const TABLE_H = 1.4;
const CARD_Z = TABLE_H;
const CARD_T = 0.6;
const L1 = [18, 21]; // lower arm layer (z from, to)
const L2 = [22, 25]; // upper arm layer
const BAR_W = 5;

const BLOCKS = [
  { id: "persistence", plan: { x: 192, y: -50, w: 44, d: 34, r: 3 }, h: 14, spec: "architecture/persistence.md" },
  { id: "transport", plan: { x: 252, y: -50, w: 50, d: 30, r: 3 }, h: 10, spec: "architecture/transport.md" },
  { id: "jobs", plan: { x: 252, y: -6, w: 50, d: 40, r: 3 }, h: 12, spec: "architecture/jobs.md", gap: [12, 18] },
  { id: "brief", plan: { x: 192, y: 0, w: 44, d: 34, r: 3 }, h: 6, spec: "features/export-csv.md" },
];
const INDEX = { x: 192, y: 42, w: 110, d: 24, r: 2 };
const GROOVE_Y = [46, 50, 54, 58, 62];
const GROOVE_LEN = [62, 56, 50, 70, 30]; // one line per sub-spec, then the TODO(verify) line
const GROOVE_X = INDEX.x + 6;
const PARK = [GROOVE_X + 86, 40];

const penOf = ([x, y]) => [O[0] + RATIO * (x - O[0]), O[1] + RATIO * (y - O[1])];
const cardOf = (plan, margin = 3) => {
  const [x0, y0] = penOf([plan.x, plan.y]);
  return { x: x0 - margin, y: y0 - margin, w: plan.w * RATIO + margin * 2, d: plan.d * RATIO + margin * 2, r: 1 };
};

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [O[0], O[1], 34], [120, -100, 30], [250, -30, 30]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 52 },
);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const depth2 = ([x, y]) => k.depthOf([x, y, 0], P);

// ---- the stylus path, sampled in time ----------------------------------------------------------
const outlineOf = (plan) => {
  const ring = k.roundedPlan(k.insetPlan(plan, -SR), 6);
  return [...ring, ring[0]];
};
const lengthOf = (pts) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const DT = 1 / 60;
const samples = []; // [t, x, y, pen(0/1), trace index or -1]
const traces = []; // { kind, card, from, to } sample index ranges that leave ink
const marks = []; // { at: time, card } TODO flags
const phases = []; // { t0, t1, label, aria }
let clock = 0;
let here = PARK;
const push = (x, y, pen, trace) => samples.push([+clock.toFixed(3), +x.toFixed(2), +y.toFixed(2), pen, trace]);
function wait(seconds) {
  const end = clock + seconds;
  while (clock < end) { push(here[0], here[1], 0, -1); clock += DT; }
}
function travel(to, speed = 140) {
  const from = here;
  const dur = Math.max(0.5, Math.hypot(to[0] - from[0], to[1] - from[1]) / speed);
  for (let s = 0; s < dur; s += DT) {
    const e = s / dur, u = e * e * (3 - 2 * e);
    push(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, 0, -1);
    clock += DT;
  }
  here = to;
}
function trace(pts, card, speed, { gap, onGap } = {}) {
  const total = lengthOf(pts);
  let trIndex = -1;
  let done = 0;
  let segment = 1;
  let paused = false;
  const open = () => { traces.push({ card, from: samples.length, to: samples.length }); trIndex = traces.length - 1; };
  const close = () => { trIndex = -1; };
  for (let s = 0; s <= total + 1e-6; s += speed * DT) {
    while (segment < pts.length - 1 && done + Math.hypot(pts[segment][0] - pts[segment - 1][0], pts[segment][1] - pts[segment - 1][1]) < s) {
      done += Math.hypot(pts[segment][0] - pts[segment - 1][0], pts[segment][1] - pts[segment - 1][1]);
      segment++;
    }
    const a = pts[segment - 1], b = pts[segment];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const f = Math.min(1, (s - done) / len);
    const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
    const inGap = gap && y > gap.lo && y < gap.hi && (x < gap.x0 || x > gap.x1);
    if (inGap && !paused) { paused = true; close(); here = [x, y]; onGap?.(); }
    if (!inGap && trIndex < 0) open();
    push(x, y, inGap ? 0 : 1, inGap ? -1 : trIndex);
    if (trIndex >= 0) traces[trIndex].to = samples.length;
    clock += DT;
  }
  here = pts[pts.length - 1];
}
function phase(label, aria, body) {
  const t0 = clock;
  body();
  phases.push({ t0, t1: clock, label, aria });
}

wait(0.8);
let written = 0;
BLOCKS.forEach((block, index) => {
  const ring = outlineOf(block.plan);
  const card = index;
  phase(block.id === "brief" ? "reading the grilled brief" : "recon \u00b7 " + block.id, "", () => travel(ring[0]));
  if (block.gap) {
    const plan = block.plan;
    const gap = { lo: plan.y + block.gap[0], hi: plan.y + block.gap[1], x0: plan.x + 2, x1: plan.x + plan.w - 2 };
    let firstGap = true;
    phase(block.spec + " \u00b7 tracing the contract", "Tracing the " + block.id + " module", () =>
      trace(ring, card, 58, {
        gap,
        onGap: () => {
          if (!firstGap) return;
          firstGap = false;
          const t0 = clock;
          push(here[0], here[1], 0, -1);
          marks.push({ at: clock, card, point: here });
          const end = clock + 1.6;
          while (clock < end) { push(here[0], here[1], 0, -1); clock += DT; }
          phases.push({ t0, t1: clock, label: "unclear edge \u00b7 TODO(verify), not a guess", aria: "The jobs module has an edge the stylus cannot read: a TODO(verify) flag goes up instead of a guessed line" });
        },
      }),
    );
  } else {
    phase(block.spec + " \u00b7 tracing the contract", "Tracing the " + block.id + (block.id === "brief" ? " card: its decisions become the feature spec" : " module into its spec"), () => trace(ring, card, 58));
  }
  written++;
  const gy = GROOVE_Y[index];
  phase("overview.md \u00b7 index " + written + "/4", "Writing line " + written + " of the overview index", () => {
    travel([GROOVE_X, gy]);
    trace([[GROOVE_X, gy], [GROOVE_X + GROOVE_LEN[index], gy]], 4, 40);
  });
});
phase("overview.md \u00b7 listing open TODO(verify)", "The overview lists the open TODO(verify) items", () => {
  travel([GROOVE_X, GROOVE_Y[4]]);
  trace([[GROOVE_X, GROOVE_Y[4]], [GROOVE_X + GROOVE_LEN[4], GROOVE_Y[4]]], 4, 40);
  marks.push({ at: clock, card: 4, point: [GROOVE_X + GROOVE_LEN[4] + 4, GROOVE_Y[4]] });
});
phase("cross-linked \u00b7 parking", "", () => travel(PARK, 120));
const DONE = clock;
phase("5 specs \u00b7 1 TODO(verify) \u00b7 0 lines of source copied", "Scope is done: an overview and four sub-specs, one open TODO(verify), no source copied", () => wait(3.2));
const TOTAL = clock;
phases.sort((a, b) => a.t0 - b.t0);

// ---- static art --------------------------------------------------------------------------------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ratio scale along the front: one tick per 5 units of stylus travel
  const strip = { x: 24, y: PLATE.y + PLATE.d - 13, w: 290, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 5, 5, strip.y + 0.6, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 1.5, strip.y + 3, 0.6]), at([strip.x + strip.w - 1.5, strip.y + 3, 0.6])], { size: 0.4 }));
  // label plate
  const label = { x: -18, y: -100, w: 64, d: 12, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 6, label.y + 8], 0.8, P, "x"), "scope 2:1", { size: 4.2, tone: "mid" }));
  out.push(D([at([label.x + label.w - 4, label.y + 3, 0.8]), at([label.x + label.w - 4, label.y + label.d - 3, 0.8])], { size: 0.45 }));
  return out.join("");
}

function bed() {
  const out = [S(k.slabOf(BED, 0, BED_H, P, 6, 0.6), { tone: "lo" })];
  out.push(D(k.corners(BED, 4).map(([x, y]) => at([x, y, BED_H])), { size: 0.45 }));
  // index plate with its grooves: the template the overview is written from
  out.push(S(k.slabOf(INDEX, BED_H, 2, P, 3, 0.4), { tone: "mid" }));
  GROOVE_Y.forEach((y, i) => {
    const groove = { x: GROOVE_X - 1, y: y - 0.9, w: GROOVE_LEN[i] + 2, d: 1.8, r: 0.9 };
    out.push(L(k.planOutline(groove, BED_H + 2, P, 3), { tone: i === 4 ? "mid" : "lo" }));
  });
  out.push(D([at([INDEX.x + 2.5, INDEX.y + 2.5, BED_H + 2]), at([INDEX.x + INDEX.w - 2.5, INDEX.y + INDEX.d - 2.5, BED_H + 2])], { size: 0.4 }));
  return out.join("");
}

// the templates: real modules of the codebase, plus the grilled brief on its plinth
function block(b) {
  const z = BED_H;
  const top = z + b.h;
  const out = [];
  if (b.gap) {
    const lower = { ...b.plan, d: b.gap[0], r: b.plan.r };
    const upper = { ...b.plan, y: b.plan.y + b.gap[1], d: b.plan.d - b.gap[1] };
    out.push(S(k.slabOf(lower, z, b.h, P, 4, 0.6), { tone: "mid" }));
    out.push(S(k.slabOf(upper, z, b.h, P, 4, 0.6), { tone: "mid" }));
    for (const plan of [lower, upper]) out.push(D(k.dotGrid(plan.x + 5, plan.y + 4, 9, Math.max(1, Math.floor((plan.d - 6) / 4)), 5, top, P), { size: 0.4, tone: "lo" }));
    return out.join("");
  }
  out.push(S(k.slabOf(b.plan, z, b.h, P, 4, 0.6), { tone: "mid", inner: b.id === "persistence" ? L(k.sideSeam(b.plan, z + 7, P, 4), { tone: "faint" }) : "" }));
  if (b.id === "brief") {
    // the punched card from Fig 1, Status: grilled
    const card = k.insetPlan(b.plan, 4);
    out.push(S(k.slabOf(card, top, 0.8, P, 3), { tone: "hi", crease: "lo" }));
    const holes = [];
    for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) holes.push([card.x + 4 + row * 4.2, card.y + 5 + col * 5.2]);
    out.push(D(holes.map(([x, y]) => at([x, y, top + 0.8])), { size: 0.7, tone: "mid" }));
    out.push(S(k.slabOf({ x: card.x + card.w - 5, y: card.y + card.d - 6, w: 3.4, d: 3.4, r: 0.6 }, top + 0.8, 4, P, 2, 0.3), { tone: "hi" }));
    return out.join("");
  }
  // source: dense rows the stylus never copies
  out.push(D(k.dotGrid(b.plan.x + 5, b.plan.y + 4, Math.floor((b.plan.w - 6) / 5), Math.floor((b.plan.d - 4) / 4), b.id === "transport" ? 5 : 4.6, top, P), { size: 0.4, tone: "lo" }));
  return out.join("");
}

// the card table: one card under the scaled image of each template
const CARDS = [...BLOCKS.map((b) => cardOf(b.plan)), cardOf(INDEX, 2.4)];
function table() {
  const out = [S(k.slabOf(TABLE, 0, TABLE_H, P, 4, 0.4), { tone: "lo" })];
  out.push(D(k.corners(TABLE, 2.6).map(([x, y]) => at([x, y, TABLE_H])), { size: 0.45 }));
  CARDS.forEach((card, i) => {
    out.push(S(k.slabOf(card, CARD_Z, CARD_T, P, 3), { tone: i === 4 ? "hi" : "mid", crease: "none" }));
    // a clip on each card's far edge and a title rule standing for its file name
    out.push(S(k.slabOf({ x: card.x + card.w / 2 - 3, y: card.y - 0.6, w: 6, d: 2.4, r: 0.6 }, CARD_Z + CARD_T, 0.8, P, 2), { tone: "mid", crease: "none" }));
    out.push(L(k.lineOnTop([card.x + 2, card.y + 2.6], [card.x + Math.min(14, card.w - 4), card.y + 2.6], CARD_Z + CARD_T, P), { tone: "lo", free: true }));
  });
  return out.join("");
}

const pivot = () => {
  const out = [S(k.cylinder(O[0], O[1], 9, 0, 3, P, 40, 0.6), { tone: "lo" })];
  out.push(D(Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return at([O[0] + 7 * Math.cos(a), O[1] + 7 * Math.sin(a), 3]); }), { size: 0.45 }));
  out.push(S(k.cylinder(O[0], O[1], 4.6, 3, L1[0] - 3, P, 28), { tone: "mid", crease: "none" }));
  out.push(L(k.sideArc(O[0], O[1], 4.6, 9, P, 16), { tone: "faint" }));
  return out.join("");
};

const pinAt = ([x, y]) => S(k.cylinder(x, y, 2.2, L2[1], 1.6, P, 18, 0.3), { tone: "mid" }) + D([at([x, y, L2[1] + 1.6])], { size: 0.5, tone: "hi" });

const CARD_TOP = CARD_Z + CARD_T;
const sortedBlocks = [...BLOCKS].sort((a, b) => depth2([a.plan.x + a.plan.w / 2, a.plan.y + a.plan.d / 2]) - depth2([b.plan.x + b.plan.w / 2, b.plan.y + b.plan.d / 2]));
const tplDepth = sortedBlocks.map((b) => +depth2([b.plan.x + b.plan.w / 2, b.plan.y + b.plan.d / 2]).toFixed(3));

// The ink is the pen's path laid in short chunks, one per export frame, each shown once the pen has passed it.
const straight = (pts) => pts.filter((p, i) => {
  if (i === 0 || i === pts.length - 1) return true;
  const [a, b] = [pts[i - 1], pts[i + 1]];
  return Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) > 0.05 * Math.hypot(b[0] - a[0], b[1] - a[1]);
});
const CHUNK = 3;
const ink = [];
traces.forEach((tr) => {
  const tone = tr.card === 4 ? "hi" : "lit";
  for (let a = tr.from, b; a < tr.to - 1; a = b) {
    b = Math.min(a + CHUNK, tr.to - 1);
    const pts = [];
    for (let q = a; q <= b; q++) pts.push(at([...penOf([samples[q][1], samples[q][2]]), CARD_TOP]));
    // ink on paper: its ends are where the pen lifted, so the chunks are free lines
    ink.push(`<path class="iso-line" data-tone="${tone}" data-free="" data-p="ink" data-q="${b}" opacity="0" d="${k.pathOf(straight(pts))}"/>`);
  }
});

const flagsSvg = marks.map((m) => {
  const p = penOf(m.point);
  return `<g data-p="flag" opacity="0">${S(k.cylinder(p[0], p[1], 0.5, CARD_TOP, 7, P, 10), { tone: "hi", crease: "none" })}${S(k.extrude([[p[0], p[1] - 0.3], [p[0], p[1] + 0.3], [p[0] + 5, p[1] + 0.3], [p[0] + 5, p[1] - 0.3]], CARD_TOP + 4, 3, P), { tone: "hi", lit: true })}</g>`;
}).join("");

// the stylus is one rigid rod, drawn at the origin and carried to its place; there is one copy per layer between the templates
const stylusCopy = () => {
  const tip = BED_H + 1.4;
  return `<g data-p="stylus" opacity="0" transform="${k.translateAlong(P, [0, 0, 0])}">${S(k.cylinder(0, 0, SR, tip, L2[0] - tip, P, 16), { tone: "hi", crease: "none" })}${S(k.cylinder(0, 0, 2.8, 16, 4, P, 20, 0.3), { tone: "mid" })}${L(k.knurl(0, 0, 2.8, 16, 20, 20, P), { tone: "lo" })}</g>`;
};
const templatesSvg = sortedBlocks.map((b) => `${stylusCopy()}<g>${block(b)}</g>`).join("") + stylusCopy();

// the pen lifts 2.4 off the card when the stylus is not on a wall: two fixed drawings, one shown at a time
const penParts = (lift) => S(k.cylinder(0, 0, 0.7, CARD_TOP + lift, 3, P, 12), { tone: "hi", lit: true, crease: "none" }) +
  S(k.cylinder(0, 0, 1.5, CARD_TOP + lift + 3, L1[0] - CARD_TOP - lift - 3, P, 16), { tone: "hi", lit: true, crease: "none" });

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A copying pantograph on a bench. On the right, four templates stand on a bed: three modules of the real codebase and the grilled brief on its plinth. A stylus runs round each template's walls and the linkage moves a pen, at half scale, round the same outline on the card beneath it. After each card the stylus runs one groove of an index plate and the pen writes that line on the overview card. Where one module has an edge the stylus cannot follow, the pen lifts and a flag goes up instead of a line.",
  body: [
    `<g data-scene>`,
    base(),
    bed(),
    table(),
    `<g>${ink.join("")}</g>`,
    `<g>${flagsSvg}</g>`,
    pivot(),
    `<g>${templatesSvg}</g>`,
    `<g data-p="pen" transform="${k.translateAlong(P, [0, 0, 0])}"><g data-p="penDown">${penParts(0)}</g><g data-p="penUp" opacity="0">${penParts(2.4)}</g></g>`,
    `<g data-p="bar1" transform="${k.translateAlong(P, [0, 0, 0])}"></g>`,
    `<g data-p="bar2" transform="${k.translateAlong(P, [0, 0, 0])}"></g>`,
    `<g data-p="bar3" transform="${k.translateAlong(P, [0, 0, 0])}"></g>`,
    `<g data-p="bar4" transform="${k.translateAlong(P, [0, 0, 0])}"></g>`,
    pinAt(O),
    [0, 1, 2, 3, 4].map((i) => `<g data-p="pin${i}" transform="${k.translateAlong(P, [0, 0, 0])}">${pinAt([0, 0])}</g>`).join(""),
    `</g>`,
  ],
});

// ---- live --------------------------------------------------------------------------------------
const live = `
const P = ${JSON.stringify(P)};
const O = ${JSON.stringify(O)}, RATIO = ${RATIO}, ARM = ${ARM}, BAR_W = ${BAR_W};
const L1 = ${JSON.stringify(L1)}, L2 = ${JSON.stringify(L2)};

const SAMPLES = ${JSON.stringify(samples)};

const MARKS = ${JSON.stringify(marks)};
const PHASES = ${JSON.stringify(phases)};
const TOTAL = ${TOTAL}, DONE = ${DONE};
const penOf = ([x, y]) => [O[0] + RATIO * (x - O[0]), O[1] + RATIO * (y - O[1])];
const depth2 = ([x, y]) => depthOf([x, y, 0], P);

const sampleAt = (u) => {
  let lo = 0, hi = SAMPLES.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (SAMPLES[mid][0] <= u) lo = mid; else hi = mid - 1; }
  return lo;
};
const stadium = (a, b, r, steps = 8) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx);
  const out = [];
  for (let i = 0; i <= steps; i++) { const t = ang - Math.PI / 2 + (i / steps) * Math.PI; out.push([b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)]); }
  for (let i = 0; i <= steps; i++) { const t = ang + Math.PI / 2 + (i / steps) * Math.PI; out.push([a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)]); }
  return out;
};
// A bar of fixed length is one drawing per angle, at the origin; it is carried to the joint it starts from.
// The angle is rounded to half a degree (under a pixel at the far end).
const barCache = new Map();
const barDrawn = (len, layer, deg) => {
  const key = len + "|" + layer[0] + "|" + deg;
  if (!barCache.has(key)) {
    const r = (deg * Math.PI) / 180, end = [len * Math.cos(r), len * Math.sin(r)];
    barCache.set(key, solidSvg(extrude(stadium([0, 0], end, BAR_W / 2, 4), layer[0], layer[1] - layer[0], P), { tone: "mid", inner: "" }) +
      lineSvg([[0, 0], end].map(([x, y]) => ring(x, y, 1.1, layer[1], P, 12)).join(""), { tone: "faint" }));
  }
  return barCache.get(key);
};
const setBar = (el, a, b, len, layer) => {
  const deg = Math.round(((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI) * 2) / 2;
  const drawn = barDrawn(len, layer, deg);
  if (el.dataset.deg !== String(deg)) { el.dataset.deg = String(deg); el.innerHTML = drawn; }
  move(el, [a[0], a[1], 0]);
};

const linkage = (s) => {
  const dx = s[0] - O[0], dy = s[1] - O[1];
  const d = Math.min(Math.hypot(dx, dy), ARM * 2 - 0.01);
  const h = Math.sqrt(Math.max(0, ARM * ARM - (d / 2) * (d / 2)));
  const ux = dx / d, uy = dy / d;
  const mx = O[0] + dx / 2, my = O[1] + dy / 2;
  let A = [mx - uy * h, my + ux * h];
  const B = [mx + uy * h, my - ux * h];
  if (B[1] < A[1]) A = B;
  const M = [O[0] + RATIO * (A[0] - O[0]), O[1] + RATIO * (A[1] - O[1])];
  const N = [A[0] + RATIO * (s[0] - A[0]), A[1] + RATIO * (s[1] - A[1])];
  return { A, M, N, Pn: penOf(s) };
};

const TPL_D = ${JSON.stringify(tplDepth)};
const STYLUS = $$("stylus");
const FLAGS = $$("flag");
const INK = $$("ink").map((el) => [el, +el.dataset.q]);

const FIGURE = {
  total: TOTAL,
  rest: DONE + 1,
  steps: PHASES.map((p) => p.t0).concat([TOTAL - 0.01]),
  render(u) {
    const i = sampleAt(u);
    const [, sx, sy, pen] = SAMPLES[i];
    const s = [sx, sy];
    const { A, M, N, Pn } = linkage(s);

    // ink: each chunk of the pen's path appears once the pen has passed it; flags rise at their marks
    INK.forEach(([el, q]) => show(el, i >= q ? 1 : 0));
    FLAGS.forEach((el, j) => show(el, ss(u, MARKS[j].at, MARKS[j].at + 0.45)));

    // stylus: one rigid rod, shown in the layer slot it is in among the templates and carried to its place
    const d = depth2(s);
    let slot = TPL_D.findIndex((x) => x > d);
    if (slot < 0) slot = TPL_D.length;
    STYLUS.forEach((el, n) => { show(el, n === slot ? 1 : 0); move(el, [sx, sy, 0]); });

    // pen: carried to its place; it sits 2.4 higher when the stylus is not on a wall
    move($("pen"), [Pn[0], Pn[1], 0]);
    show($("penDown"), pen ? 1 : 0);
    show($("penUp"), pen ? 0 : 1);

    // arms: four rigid bars (a drawing per half-degree, carried to the joint it hangs from) and five pins carried to their joints
    setBar($("bar1"), O, A, 170, L1);
    setBar($("bar2"), Pn, N, 85, L1);
    setBar($("bar3"), A, s, 170, L2);
    setBar($("bar4"), M, Pn, 85, L2);
    [A, M, N, Pn, s].forEach((p, i) => move($("pin" + i), [p[0], p[1], 0]));
  },
  say(u) {
    let cur = PHASES[0];
    for (const p of PHASES) if (u >= p.t0 && (u < p.t1 || u >= cur.t1) && p.t0 >= cur.t0) cur = p;
    if (u < PHASES[0].t0) cur = { label: "recon \\u00b7 reading the code", aria: "" };
    return { readout: cur.label, phase: cur.label, aria: cur.aria || cur.label };
  },
};
${ENGINE}
`;

writePages(k, kitScript, {
  name: "scope",
  title: "av-swe scope",
  figure: svg,
  live,
  plate: {
    fig: "Fig 2",
    title: "av-swe scope",
    hint: "Hover to scrub the tracing",
    readout: "recon \u00b7 reading the code",
    aria: "av-swe scope: hover or use the arrow keys to step through the specs being written",
    total: Math.round(TOTAL),
    keys: [
      { mark: "lit", label: "Pen and ink: the spec, drawn at half scale" },
      { mark: "raised", label: "Templates: three code modules and the grilled brief" },
      { mark: "flat", label: "Cards: four sub-specs and the overview index" },
    ],
    caption:
      "scope writes down what exists and what to build before anyone plans it. The stylus follows the real code's walls, never its insides, so each spec captures the contract (shape, edges, interfaces) and none of the source. The grilled brief is traced like any module and becomes the feature spec. After every sub-spec the overview gets one index line. Where an edge cannot be read, the pen lifts and a TODO(verify) flag goes up; scope never guesses, and the overview lists every open flag.",
  },
});
