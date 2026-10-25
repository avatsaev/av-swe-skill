// Fig 1 · av-swe grill: a card-punch press that turns a rough idea into a decided brief.
//   node docs/anatomy/grill.mjs   -> docs/anatomy/grill.html, grill-light.html
import { ENGINE, loadKit, writePages } from "./common.mjs";

const { k, kitScript } = await loadKit();

const WIDTH = 760;
const HEIGHT = 390;

// ---- world --------------------------------------------------------------------------------
const PLATE = { x: -42, y: -82, w: 360, d: 138, r: 8 }; // x -42..318, y -82..56
const PLATE_H = 12;
const FOOT_H = 5;

const PITCH = 8; // one row of the card
const X0 = 24; // card left edge at the start
const CARD = { x: X0, y: -28, w: 100, d: 56, r: 2 };
const SLED = { x: 20, y: -31, w: 108, d: 62, r: 3 };
const SLED_Z = 4;
const SLED_TOP = 8;
const CARD_TOP = 8.8;
const XP = 104; // punch station: row 0 is under it at the start
const XG = 172; // gauge station: the card's test pads stop under it after the last row
const COLS = [-18, -9, 0, 9, 18];
const PADS = [-18, -6, 6, 18];
const ROW_U = (row) => 80 - PITCH * row; // row centre, measured from the card's left edge
const XB = 190; // interlock barrier
const XD = 252; // dock backstop
const BAR_Z = 34; // crossbar bottom
const BAR_TOP = 42;
const TIP_REST = 19;
const TIP_DOWN = 9.1;
const CAP_REST = 52; // cap bottom with the spring free
const ROD_R = 1.3;
const SCREW = { x: 2, y: -2, w: 260, d: 4, r: 2 };
const SCREW_TOP = 3.6;
const THREAD = 6;
const HEAD_Y = [-77, -55];
const RECON_HEAD = [30, 74];
const Q = [4, 4, 3, 5, 4, 5, 3, 4]; // questions per round, 3-5 as the op says
const THEMES = ["problem & outcome", "scope boundary", "happy path", "data & state", "integration points", "edge cases & failures", "non-functional constraints", "acceptance"];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [XP, -50, 64], [XG, -50, 52], [XB, 0, 56], [XD + 6, 0, 18], [20, -77, 20]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 56 },
);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const rodPaths = (x, y, z0, z1, r = ROD_R) => k.cylinder(x, y, r, z0, Math.max(0.1, z1 - z0), P, 12);

// ---- base ---------------------------------------------------------------------------------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler along the sled's front: one tick per card row
  const strip = { x: 2, y: 33, w: 252, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, PITCH, 4, strip.y + 0.6, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 1, strip.y + 3, 0.6]), at([strip.x + strip.w - 1, strip.y + 3, 0.6])], { size: 0.4 }));
  // label plate with the one engraved word
  const label = { x: 200, y: 42, w: 70, d: 11, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 6, label.y + 7], 0.8, P, "x"), "grill", { size: 4.4, tone: "mid" }));
  out.push(D([at([label.x + label.w - 4, label.y + 3, 0.8]), at([label.x + label.w - 4, label.y + label.d - 3, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ---- feed: motor, lead screw, rails ------------------------------------------------------------
function feed() {
  const out = [];
  // stepper motor on the left, coupled to the lead screw
  const motor = { x: -34, y: -11, w: 32, d: 22, r: 3 };
  out.push(S(k.slabOf(motor, 0, 18, P, 5, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(motor, 3), 18, P, 4), { tone: "faint" }));
  for (const x of [motor.x + 8, motor.x + 14, motor.x + 20]) out.push(L(k.lineOnTop([x, motor.y + 4], [x, motor.y + motor.d - 4], 18, P), { tone: "lo", free: true }));
  out.push(D(k.corners(motor, 3.4).map(([x, y]) => at([x, y, 18])), { size: 0.45 }));
  out.push(S(k.slabOf({ x: -2, y: -4, w: 8, d: 8, r: 2 }, 0, 6, P, 3, 0.4), { tone: "mid" })); // coupler
  out.push(L(k.rise([2, -4], 0, 6, P), { tone: "faint" }));
  // rails
  for (const y of [-28.5, 23.5]) {
    out.push(S(k.slabOf({ x: 10, y, w: 252, d: 5, r: 1 }, 0, 4, P, 3, 0.4), { tone: "mid" }));
    out.push(D([20, 252].map((x) => at([x, y + 2.5, 4])), { size: 0.4 }));
  }
  // lead screw, under the sled
  out.push(S(k.slabOf(SCREW, 0, SCREW_TOP, P, 3, 0.2), { tone: "mid", crease: "none" }));
  // the thread: marks every THREAD units, wide enough to cover every shift, then cut by the exact outline of the screw's top face.
  // Every visible end therefore lies on that outline (the marks' own ends past it are clipped away), so the marks are `free` for the line check.
  const reach = (Q.length - 1) * PITCH + 64;
  const marks = [];
  for (let i = -Math.ceil(reach / THREAD) - 1; SCREW.x + i * THREAD < SCREW.x + SCREW.w; i++) {
    const x0 = SCREW.x + i * THREAD;
    marks.push(k.segment([x0, SCREW.y, SCREW_TOP], [x0 + THREAD * 0.5, SCREW.y + SCREW.d, SCREW_TOP], P));
  }
  out.push(`<clipPath id="thread-clip"><path d="${k.planOutline(SCREW, SCREW_TOP, P)}"/></clipPath>`);
  out.push(`<g clip-path="url(#thread-clip)"><g data-p="thread" transform="${k.translateAlong(P, [0, 0, 0])}">${L(marks.join(""), { tone: "lo", free: true })}</g></g>`);
  for (const x of [4, 258]) {
    const block = { x: x - 4, y: -9, w: 8, d: 18, r: 1.5 };
    out.push(S(k.slabOf(block, 0, 9, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x, -5.5, 9]), at([x, 5.5, 9])], { size: 0.4 }));
  }
  // end stops on the rails
  for (const y of [-28.5, 23.5]) for (const x of [6, 262]) out.push(S(k.slabOf({ x: x - 2, y, w: 4, d: 5, r: 0.8 }, 4, 4, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}

// ---- recon: the reader that scans the codebase before round 1 ---------------------------------------
function recon() {
  const out = [];
  const tile = { x: 22, y: -72, w: 60, d: 14, r: 2 };
  out.push(S(k.slabOf({ x: 16, y: -78, w: 72, d: 4, r: 1 }, 0, 3, P, 3, 0.3), { tone: "mid" })); // rail
  out.push(D([at([22, -76, 3]), at([82, -76, 3])], { size: 0.4 }));
  out.push(S(k.slabOf(tile, 0, 6, P, 4, 0.6), { tone: "mid" })); // the codebase, as a tile of files
  for (const [i, y] of [-69, -65, -61].entries()) {
    out.push(L(k.lineOnTop([tile.x + 4, y], [tile.x + tile.w - 4 - i * 9, y], 6, P), { tone: i === 1 ? "mid" : "lo", free: true }));
  }
  out.push(D(k.corners(tile, 2).map(([x, y]) => at([x, y, 6])), { size: 0.4 }));
  return out.join("");
}
function reader() {
  const out = [`<g data-p="head" transform="${k.translateAlong(P, [0, 0, 0])}">`];
  const hx = RECON_HEAD[0];
  out.push(S(k.slabOf({ x: hx - 4, y: -77, w: 8, d: 5, r: 1 }, 3, 6, P, 2, 0.3), { tone: "mid" })); // leg on the rail
  out.push(S(k.slabOf({ x: hx - 4, y: HEAD_Y[0], w: 8, d: HEAD_Y[1] - HEAD_Y[0], r: 1.5 }, 9, 7, P, 3, 0.5), { tone: "hi", lit: false }));
  out.push(L(k.planOutline(k.insetPlan({ x: hx - 4, y: HEAD_Y[0], w: 8, d: HEAD_Y[1] - HEAD_Y[0], r: 1.5 }, 1.6), 16, P, 3), { tone: "faint" }));
  out.push(S(k.cylinder(hx, -64, 2.2, 16, 3, P, 16), { tone: "mid" }));
  out.push(L(k.ring(hx, -64, 1, 19, P, 12), { tone: "hi" }));
  out.push("</g>");
  return out.join("");
}

// ---- the sled carries the card ---------------------------------------------------------------------
const HOLES = [];
Q.forEach((count, row) => { for (let col = 0; col < count; col++) HOLES.push({ row, col }); });
const holeAt = (row, col) => [X0 + ROW_U(row), COLS[col]];

function sled() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(SLED, 3), SLED_Z, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(SLED, SLED_Z, SLED_TOP - SLED_Z, P, 5, 0.6), { tone: "mid" }));
  out.push(D(k.corners(SLED, 2.6).map(([x, y]) => at([x, y, SLED_TOP])), { size: 0.45, tone: "lo" }));
  out.push(L(k.sideSeam(SLED, 6, P, 5), { tone: "faint" }));
  out.push(L(k.segment([X0 + 2, SLED.y + SLED.d, SLED_Z], [X0 + 2, SLED.y + SLED.d, SLED_TOP], P), { tone: "hi" })); // vernier mark against the ruler
  // the card: the one lit part
  out.push(S(k.slabOf(CARD, SLED_TOP, CARD_TOP - SLED_TOP, P, 3), { tone: "hi", lit: true, crease: "lo" }));
  const rows = [];
  for (let row = 0; row <= 8; row++) {
    const x = X0 + 16 + PITCH * row;
    rows.push(k.lineOnTop([x, CARD.y], [x, CARD.y + CARD.d], CARD_TOP, P));
  }
  out.push(L(rows.join(""), { tone: "faint" }));
  // raw-idea label: outline plus printed text lines
  const label = { x: X0 + 3, y: -22, w: 10, d: 44, r: 1 };
  out.push(L(k.planOutline(label, CARD_TOP, P, 3), { tone: "lo" }));
  for (const [i, x] of [X0 + 5.5, X0 + 8, X0 + 10.5].entries()) out.push(L(k.lineOnTop([x, -17], [x, 17 - i * 6], CARD_TOP, P), { tone: "lo", free: true }));
  // test pads
  const padX = X0 + 92;
  out.push(L(PADS.map((y) => k.ring(padX, y, 2.6, CARD_TOP, P, 14)).join(""), { tone: "mid" }));
  out.push(D(PADS.map((y) => at([padX, y, CARD_TOP])), { size: 0.45, tone: "mid" }));
  // status flag: flat while grilling, raised once grilled
  const flag = { x: X0 + 93, y: 22, w: 5, d: 5, r: 0.8 };
  out.push(`<g data-p="flagDown">${S(k.slabOf(flag, CARD_TOP, 0.8, P, 2), { tone: "mid", crease: "none" })}</g>`);
  out.push(`<g data-p="flagUp" opacity="0">${S(k.slabOf(flag, CARD_TOP, 6, P, 2, 0.3), { tone: "hi", lit: true })}</g>`);
  // holes (decisions) and the scored slit for the unresolved question
  for (const { row, col } of HOLES) {
    const [x, y] = holeAt(row, col);
    out.push(`<g data-p="hole" data-r="${row}" data-c="${col}" opacity="0">${L(k.ring(x, y, 1.7, CARD_TOP, P, 12), { tone: "hi" })}${D([at([x, y, CARD_TOP])], { size: 1.1, tone: "hi" })}</g>`);
  }
  const [sx, sy] = holeAt(3, 2);
  out.push(`<g data-p="slit" opacity="0">${L(k.lineOnTop([sx - 0.8, sy - 2.2], [sx + 0.8, sy + 2.2], CARD_TOP, P), { tone: "hi" })}</g>`);
  return out.join("");
}

// ---- portals ----------------------------------------------------------------------------------------
// a C-frame column at the back; the arm is cantilevered over the sled so nothing hides the card
const column = (x) => {
  const plan = { x: x - 6, y: -54, w: 12, d: 14, r: 2 };
  const out = [S(k.slabOf({ x: x - 9, y: -57, w: 18, d: 20, r: 2.5 }, 0, 3, P, 4, 0.6), { tone: "lo" })];
  out.push(D(k.corners({ x: x - 9, y: -57, w: 18, d: 20 }, 2.4).map(([px, py]) => at([px, py, 3])), { size: 0.45 }));
  out.push(S(k.slabOf(plan, 3, BAR_TOP + 6 - 3, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, 16, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(plan, 2.4), BAR_TOP + 6, P, 4), { tone: "faint" }));
  return out.join("");
};
function crossbar(x) {
  const out = [];
  const plan = { x: x - 5, y: -40, w: 10, d: 66, r: 1.2 };
  out.push(S(k.slabOf(plan, BAR_Z, BAR_TOP - BAR_Z, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, BAR_Z + 3, P, 3), { tone: "faint" }) }));
  out.push(D([at([x, -36, BAR_TOP]), at([x, 22, BAR_TOP])], { size: 0.45 }));
  return out.join("");
}

// a plunger: lower rod (before the crossbar), then spring/upper rod/cap (after it)
function plungerLower(id, x, y) {
  return `<g data-p="lo${id}">${S(rodPaths(x, y, TIP_REST, BAR_TOP - 0.5), { tone: "hi", crease: "none" })}</g>`;
}
function plungerUpper(id, x, y, { capR = 3, flag = false } = {}) {
  const out = [L(k.ring(x, y, 2.6, BAR_TOP, P, 20), { tone: "lo" })];
  out.push(`<path class="iso-line" data-p="sb${id}" data-tone="lo" d=""/>`);
  out.push(`<g data-p="up${id}">${S(rodPaths(x, y, BAR_TOP, CAP_REST, ROD_R), { tone: "hi", crease: "none" })}</g>`);
  out.push(`<path class="iso-line" data-p="sf${id}" data-tone="mid" d=""/>`);
  out.push(`<g data-p="cap${id}">${S(k.cylinder(x, y, capR, CAP_REST, 4, P, 22, 0.4), { tone: "mid" })}${L(k.knurl(x, y, capR, CAP_REST, CAP_REST + 4, 24, P), { tone: "lo" })}</g>`);
  if (flag) out.push(`<g data-p="flag${id}"></g>`);
  return out.join("");
}

function punchStation() {
  return {
    back: column(XP),
    bar: crossbar(XP),
    lower: COLS.map((y, i) => plungerLower("P" + i, XP, y)).join(""),
    upper: COLS.map((y, i) => plungerUpper("P" + i, XP, y)).join(""),
  };
}
function gaugeStation() {
  return {
    back: column(XG),
    bar: crossbar(XG),
    lower: PADS.map((y, i) => plungerLower("G" + i, XG, y)).join(""),
    upper: PADS.map((y, i) => plungerUpper("G" + i, XG, y, { capR: i === 3 ? 4.4 : 3, flag: i < 3 })).join(""),
  };
}

// ---- interlock barrier and dock ------------------------------------------------------------------
function barrierBack() {
  return S(k.slabOf({ x: XB - 4, y: -46, w: 8, d: 6, r: 1 }, 0, 40, P, 2, 0.4), { tone: "mid" });
}
function barrierFront() {
  return S(k.slabOf({ x: XB - 4, y: 40, w: 8, d: 6, r: 1 }, 0, 40, P, 2, 0.4), { tone: "mid" });
}
function barrierSlab() {
  const plan = { x: XB - 2, y: -40, w: 4, d: 80, r: 0.8 };
  return `<g data-p="barrier">${S(k.slabOf(plan, 4, 10, P, 2, 0.4), { tone: "hi" })}${L(k.sideSeam(plan, 9, P, 2), { tone: "faint" })}${D([at([XB, -36, 14]), at([XB, 36, 14])], { size: 0.45 })}</g>`;
}
function dock() {
  const plan = { x: XD, y: -34, w: 6, d: 68, r: 1.5 };
  const out = [S(k.slabOf(plan, 4, 14, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.sideSeam(plan, 12, P, 3), { tone: "faint" }));
  out.push(D([at([XD + 3, -28, 18]), at([XD + 3, 28, 18])], { size: 0.45 }));
  return out.join("");
}

const wire = () => `<path class="iso-line" data-p="wire" data-tone="mid" d=""/><path class="iso-line" data-p="wireFlow" data-tone="hi" data-flow opacity="0" d=""/><circle class="iso-wire-end" data-p="wireA" r="1.2"/><circle class="iso-wire-end" data-p="wireB" r="1.2"/>`;

const punch = punchStation();
const gauge = gaugeStation();
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A card-punch press. A reader scans a codebase tile, then a sled slides a card through a punch station one row per round. Five punches fire, three to five questions per round, and each answer becomes a hole. Four gauge pins test the finished card: required sections, edge-case areas, blocking questions and the engineer's own button. When all four agree, a barrier lifts and the card goes to the dock, marked as grilled.",
  body: [
    `<g data-scene>`,
    base(),
    feed(),
    recon(),
    reader(),
    punch.back,
    gauge.back,
    barrierBack(),
    `<g data-p="sled" transform="${k.translateAlong(P, [0, 0, 0])}">${sled()}</g>`,
    punch.lower,
    gauge.lower,
    punch.bar,
    gauge.bar,
    punch.upper,
    gauge.upper,
    barrierSlab(),
    barrierFront(),
    dock(),
    wire(),
    `</g>`,
  ],
});

// ---- the timeline: recon, nine events (eight rounds and one challenge), then the exit gate
function timeline() {
  const RECON = [0.5, 3.2];
  let clock = 3.6;
  const events = [];
  let round = 0;
  const add = (row, cols, kinds, resolve) => {
    const start = clock, go = 0.7, gap = 0.2;
    const hit = start + go;
    const end = hit + cols.length * gap + 0.65;
    if (!resolve) round++;
    events.push({ row, cols, kinds, start, hit, gap, resolve: !!resolve, round: resolve ? 0 : round });
    clock = end;
  };
  const full = (n) => Array.from({ length: n }, (_, i) => i);
  const kindsOf = (n, open) => full(n).map((i) => (i === open ? "o" : "d"));
  for (let row = 0; row < 5; row++) add(row, full(Q[row]), kindsOf(Q[row], row === 3 ? 2 : -1));
  add(3, [2], ["d"], true);
  for (let row = 5; row < 8; row++) add(row, full(Q[row]), kindsOf(Q[row], -1));
  const C0 = clock + 0.3;
  return { RECON, events, C0, GATE: [C0, C0 + 1.1, C0 + 2.2], BUTTON: C0 + 3.3, LIFT: C0 + 4.4, RUN: [C0 + 4.8, C0 + 6.8], TOTAL: C0 + 8.6 };
}
const TL = timeline();

// ---- the live model ------------------------------------------------------------------------------------
const live = `
const P = ${JSON.stringify(P)};
const XP = ${XP}, XG = ${XG}, PITCH = ${PITCH}, X0 = ${X0}, XB = ${XB};
const COLS = ${JSON.stringify(COLS)}, PADS = ${JSON.stringify(PADS)};
const BAR_Z = ${BAR_Z}, BAR_TOP = ${BAR_TOP}, TIP_REST = ${TIP_REST}, TIP_DOWN = ${TIP_DOWN}, CAP_REST = ${CAP_REST}, ROD_R = ${ROD_R};
const CARD_TOP = ${CARD_TOP}, THREAD = ${THREAD}, SCREW = ${JSON.stringify(SCREW)}, SCREW_TOP = ${SCREW_TOP};
const HEAD = ${JSON.stringify(RECON_HEAD)}, HEAD_Y = ${JSON.stringify(HEAD_Y)};
const Q = ${JSON.stringify(Q)};
const THEMES = ${JSON.stringify(THEMES)};
const ROW_X = (row) => X0 + 80 - PITCH * row;
const rod = (x, y, z0, z1) => cylinder(x, y, ROD_R, z0, Math.max(0.1, z1 - z0), P, 12);

const { RECON, events, C0, GATE, BUTTON, LIFT, RUN, TOTAL } = ${JSON.stringify(TL)};
const CHECKS = ["required sections filled", "every edge-case area covered", "no blocking question open", "engineer confirms"];

const shiftAt = (u) => {
  let value = 0;
  for (const e of events) {
    const to = e.row * PITCH;
    if (u >= e.start) value = u < e.hit ? lerp(value, to, ss(u, e.start, e.hit)) : to;
    else break;
  }
  return value + 64 * ss(u, RUN[0], RUN[1]);
};
const pressOf = (u, a, amp) => amp * (ss(u, a, a + 0.1) - ss(u, a + 0.2, a + 0.3));
const punchState = (u, col) => {
  let press = 0, hole = null;
  for (const e of events) {
    const i = e.cols.indexOf(col);
    if (i < 0) continue;
    const a = e.hit + i * e.gap;
    press = Math.max(press, pressOf(u, a, e.kinds[i] === "o" ? 0.72 : 1));
  }
  return press;
};
const holeOn = (u, row, col) => {
  let on = 0;
  for (const e of events) {
    const i = e.cols.indexOf(col);
    if (e.row !== row || i < 0 || e.kinds[i] !== "d") continue;
    on = Math.max(on, ss(u, e.hit + i * e.gap + 0.1, e.hit + i * e.gap + 0.15));
  }
  return on;
};
const slitOn = (u) => {
  const e = events[3], r = events[5];
  return ss(u, e.hit + 2 * e.gap + 0.1, e.hit + 2 * e.gap + 0.15) * (1 - ss(u, r.hit + 0.1, r.hit + 0.15));
};

const setPlunger = (id, x, y, press, capR, stemH) => {
  const tip = TIP_REST - (TIP_REST - TIP_DOWN) * press;
  const capBottom = CAP_REST - (CAP_REST - BAR_TOP) * press;
  solid($("lo" + id), rod(x, y, tip, BAR_TOP - 0.5), { tone: "hi", crease: "none" });
  solid($("up" + id), rod(x, y, BAR_TOP, capBottom), { tone: "hi", crease: "none" });
  move($("cap" + id), [0, 0, capBottom - CAP_REST]);
  spring($("sb" + id), $("sf" + id), x, y, BAR_TOP, Math.max(capBottom, BAR_TOP + 1.4), 2.6, 5);
  const flag = $("flag" + id);
  if (flag) flag.innerHTML = stemH > 0.05 ? solidSvg(cylinder(x, y, 1.1, capBottom + 4, stemH, P, 12), { tone: "hi", crease: "none" }) : "";
};

const FIGURE = {
  total: TOTAL,
  rest: TOTAL - 1.0,
  steps: [0, RECON[1], ...events.map((e) => e.start), C0, GATE[1], GATE[2], BUTTON, LIFT, RUN[1], TOTAL - 0.01],
  render(u) {
    // recon: the reader sweeps the codebase tile and the wire carries what it read to the punches
    const sweep = u < 1.9 ? ss(u, RECON[0], 1.9) : 1 - ss(u, 1.9, RECON[1]);
    const hx = lerp(HEAD[0], HEAD[1], sweep);
    move($("head"), [hx - HEAD[0], 0, 0]);
    const a = [hx, -64, 19.5], c = [XP, -36, 43], b = [(hx + XP) / 2, -50, 62];
    const pts = bezier(a, b, c).map(at);
    const d = pathOf(pts);
    $("wire").setAttribute("d", d); $("wireFlow").setAttribute("d", d);
    show($("wireFlow"), ss(u, RECON[0] - 0.2, RECON[0] + 0.2) * (1 - ss(u, RECON[1], RECON[1] + 0.4)));
    [["wireA", pts[0]], ["wireB", pts[pts.length - 1]]].forEach(([id, p]) => { $(id).setAttribute("cx", p[0].toFixed(1)); $(id).setAttribute("cy", p[1].toFixed(1)); });

    // sled, lead screw
    const shift = shiftAt(u);
    move($("sled"), [shift, 0, 0]);
    move($("thread"), [shift, 0, 0]); // the thread is a fixed periodic pattern under a clip: moving it by the sled's shift is the screw turning

    // punches
    let decisions = 0;
    COLS.forEach((y, i) => setPlunger("P" + i, XP, y, punchState(u, i), 3, 0));
    $$("hole").forEach((el) => { const on = holeOn(u, +el.dataset.r, +el.dataset.c); show(el, on); if (on > 0.5) decisions++; });
    const slit = slitOn(u);
    show($("slit"), slit);

    // exit gate: three pins test, the fourth is the engineer's button
    const pins = PADS.map((y, i) => {
      if (i < 3) {
        const s = GATE[i];
        return { press: ss(u, s, s + 0.4) - ss(u, s + 0.7, s + 1.0), stem: 7 * ss(u, s + 0.45, s + 0.6) };
      }
      return { press: ss(u, BUTTON, BUTTON + 0.7), stem: 0 };
    });
    PADS.forEach((y, i) => setPlunger("G" + i, XG, y, pins[i].press, i === 3 ? 4.4 : 3, pins[i].stem));
    const lift = ss(u, LIFT, LIFT + 0.6);
    move($("barrier"), [0, 0, 20 * lift]);
    show($("flagUp"), ss(u, LIFT, LIFT + 0.5));
    show($("flagDown"), 1 - ss(u, LIFT, LIFT + 0.5));
    FIGURE.decisions = decisions;
    FIGURE.open = slit > 0.5 ? 1 : 0;
  },
  say(u) {
    if (u < RECON[1] + 0.3) return { readout: "recon \\u00b7 reading the code first", phase: "recon", aria: "Recon: the reader scans the codebase before the first round" };
    let cur = null;
    for (const e of events) if (u >= e.start) cur = e;
    const open = FIGURE.open ? " \\u00b7 1 open" : "";
    if (u < C0 && cur) {
      if (cur.resolve) return { readout: "challenge \\u00b7 blocker resolved \\u00b7 0 open", phase: "challenge", aria: "A contradiction is challenged and the blocking question is resolved" };
      const r = cur.row;
      return { readout: "round " + cur.round + "/8 \\u00b7 " + THEMES[r] + " \\u00b7 " + Q[r] + " questions" + open, phase: "round" + cur.round, aria: "Round " + cur.round + " of 8, " + THEMES[r] };
    }
    if (u < LIFT) {
      const n = u < GATE[1] ? 0 : u < GATE[2] ? 1 : u < BUTTON ? 2 : 3;
      return { readout: "exit gate " + (n + 1) + "/4 \\u00b7 " + CHECKS[n], phase: "gate" + n, aria: "Exit gate " + (n + 1) + " of 4: " + CHECKS[n] };
    }
    if (u < RUN[1] + 0.2) return { readout: "Status: grilled \\u00b7 handed to scope", phase: "handoff", aria: "All four checks agree; the brief is marked grilled and handed to scope" };
    return { readout: "grilled \\u00b7 8 rounds \\u00b7 " + (FIGURE.decisions || 0) + " decisions \\u00b7 0 open", phase: "done", aria: "The brief is grilled and ready for scope" };
  },
};
${ENGINE}
`;

writePages(k, kitScript, {
  name: "grill",
  title: "av-swe grill",
  figure: svg,
  live,
  plate: {
    fig: "Fig 1",
    title: "av-swe grill",
    hint: "Hover to scrub the interrogation",
    readout: "recon \u00b7 reading the code first",
    aria: "av-swe grill: hover or use the arrow keys to move through the rounds",
    total: Math.round(TL.TOTAL),
    keys: [
      { mark: "lit", label: "The brief: one card, one row punched per round" },
      { mark: "raised", label: "Five punches: 3\u20135 questions per round" },
      { mark: "dim", label: "Four gauge pins: sections, edge cases, blockers, engineer" },
    ],
    caption:
      "grill turns a rough idea into a decided brief. The agent reads the code first, then asks one theme per round (eight in all), three to five questions each, and records every answer the same round. A blocking question stays scored, not punched, until it is resolved. The brief is only marked grilled when all four exit checks hold, and the last one is the engineer's own button. grill writes the brief and nothing else.",
  },
});
