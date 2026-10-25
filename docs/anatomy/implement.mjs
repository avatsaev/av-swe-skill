// Fig 4 · av-swe implement: a rotary index table that takes one sprint's tasks, one at a time,
// through claim, understand, implement and test, and only lets a tile into done when every gate is green.
//   node docs/anatomy/implement.mjs   -> docs/anatomy/implement.html, implement-light.html
import { ENGINE, loadKit, writePages } from "./common.mjs";

const { k, kitScript } = await loadKit();

const WIDTH = 760;
const HEIGHT = 440;

// ---- world --------------------------------------------------------------------------------
// The table turns about the origin. Stations sit on the world axes, in the order a task meets them:
// claim at -x (180°), understand at -y (270°), implement at +x (360°), test at +y (450°).
const PLATE = { x: -146, y: -96, w: 242, d: 190, r: 10 };
const PLATE_H = 12;
const FOOT_H = 5;
const HOUSING_R = 46;
const TABLE_R = 58;
const TT = 13; // table top
const HUB_R = 14;
const NEST_R = 38;
const TILE = { w: 14, d: 12, h: 1.6 }; // w is tangential, d radial
const TILE_TOP = TT + TILE.h;
const TOWER_R = 8;
const TOWER_TOP = 70;
const ARM_Z = [50, 56];
const CAP_REST = 74; // cap bottom with the spring free
const TRAVEL = 12;
const TIP_REST = TILE_TOP + 0.2 + TRAVEL;
const PROBES = [-4.8, -1.6, 1.6, 4.8]; // x offsets of the four gate probes at the test station
const DONE_R = 72;
const SLOT = 18;
const QUEUE = [64, 90, 116]; // queue tile centres along -x
const CHUTE = { x: -132, y: -8, w: 73.5, d: 16, r: 1.5 };
const STACK = [54, -54]; // stack light

const SPRINT = "sprint-001";
const TASKS = [
  { id: 1, name: "scaffold build + test harness", deps: [], spec: 0 },
  { id: 2, name: "config & base types", deps: [1], spec: 0, fail: true },
  { id: 3, name: "datastore setup", deps: [1], spec: 1 },
];

// ---- the timeline ---------------------------------------------------------------------------
const tableKeys = [[0, 0]]; // [t, degrees]
const pusherKeys = [[0, 0]]; // [t, advance]
const ramKeys = [[0, 24]]; // [t, tip radius]
const shuttleKeys = [[0, 0]]; // [t, shift]
const presses = []; // { key, t, d }
const lamps = []; // { seg, on, off }
const phases = []; // { t0, label, aria }
const tiles = TASKS.map(() => ({ claim: 0, attach: 0, eject: 0, landed: 0, stamp: 0, ink: [], label: 0 }));
let clock = 0;
let angle = 0;
let pusher = 0;
let shift = 0;
const to = (keysList, value, dur) => { keysList.push([+(clock).toFixed(3), keysList[keysList.length - 1][1]]); keysList.push([+(clock + dur).toFixed(3), value]); };
const index = (by, dur = 0.9) => { to(tableKeys, angle + by, dur); angle += by; clock += dur; };
const press = (key, d) => { presses.push({ key, t: +clock.toFixed(3), d }); };
const say = (label, aria) => phases.push({ t0: +clock.toFixed(3), label, aria: aria ?? label });

clock = 0.6;
TASKS.forEach((task, n) => {
  const tile = tiles[n];
  const id = "task-" + String(task.id).padStart(3, "0");
  const deps = task.deps.length ? "needs " + task.deps.map((d) => String(d).padStart(3, "0")).join(", ") + " in done \u2713" : "no deps";
  // claim
  say(id + " \u00b7 claim \u00b7 " + deps, id + ", " + task.name + ": claimed from backlog, dependencies checked");
  tile.claim = clock;
  to(pusherKeys, pusher + 26, 1.0);
  pusher += 26;
  clock += 1.0;
  tile.attach = clock;
  tile.angle0 = angle;
  press("claim", 0.8);
  tile.stamp = clock + 0.45;
  clock += 0.9;
  say(id + " \u00b7 backlog \u2192 in_progress", id + " moves to in_progress");
  clock += 0.3;
  // understand
  index(90);
  say(id + " \u00b7 understand \u00b7 task, spec, sources", "Reading the task, its spec sections and the source it touches");
  tile.read = [clock, clock + 1.6];
  press("read", 1.6);
  clock += 1.8;
  // implement
  index(90);
  say(id + " \u00b7 implement \u00b7 scoped to this task", "Changing the real source, scoped to this task only");
  tile.ink.push([clock, clock + 2.2]);
  press("tool", 2.2);
  clock += 2.4;
  // test
  index(90);
  const gate = (upto, label) => {
    say(id + " \u00b7 " + label, label);
    const reset = clock;
    for (let g = 0; g < 4; g++) {
      press("probe" + g, 0.55);
      const pass = g < upto;
      if (pass) lamps.push({ seg: g, on: clock + 0.4, off: Infinity, reset });
      clock += 0.62;
      if (!pass) return false;
    }
    return true;
  };
  if (task.fail) {
    gate(2, "definition of done \u00b7 build, lint, tests, acceptance");
    lamps.push({ seg: 2, fail: true, on: clock - 0.2, off: clock + 1.6 });
    say(id + " \u00b7 tests \u2717 \u00b7 stays in_progress", "Tests fail: the task stays in in_progress and goes back to implement");
    clock += 0.8;
    lamps.filter((l) => !l.fail && l.off === Infinity).forEach((l) => { l.off = clock; });
    index(-90);
    say(id + " \u00b7 fix \u00b7 rerun the real commands", "Fixing the code, then rerunning every gate");
    tile.ink.push([clock, clock + 1.6]);
    press("tool", 1.6);
    clock += 1.8;
    index(90);
  }
  gate(4, "definition of done \u00b7 build, lint, tests, acceptance");
  say(id + " \u00b7 all green \u00b7 in_progress \u2192 done", id + " passes every gate and moves to done");
  // eject into the done shuttle, then label it with its summary
  tile.eject = clock;
  to(ramKeys, DONE_R - TILE.d / 2 - 0.2, 0.9);
  clock += 0.9;
  tile.landed = clock;
  to(ramKeys, 24, 0.6);
  press("label", 0.9);
  tile.label = clock + 0.5;
  say(id + " \u00b7 summary written to done/", "The summary is written next to the task in done");
  clock += 1.0;
  lamps.filter((l) => !l.fail && l.off === Infinity).forEach((l) => { l.off = clock + 0.4; });
  if (n < TASKS.length - 1) {
    to(shuttleKeys, shift + SLOT, 0.8);
    shift += SLOT;
    index(90, 0.9);
    clock += 0.3;
  } else {
    index(90, 0.9);
  }
});
const SUITE = clock + 0.3;
clock = SUITE;
say("end of sprint \u00b7 full build + test suite once more", "The backlog is empty: the full build and test suite runs once more");
for (let g = 0; g < 4; g++) lamps.push({ seg: g, on: clock + 0.4 + g * 0.55, off: Infinity, suite: true });
const BEACON = clock + 0.4 + 4 * 0.55;
clock = BEACON + 0.6;
say(SPRINT + " green \u00b7 3/3 done \u00b7 next: sprint-002", "Sprint 001 is green with three tasks done; sprint 002 is next");
const DONE = clock;
clock += 3.6;
const TOTAL = clock;
const endKey = (list) => list.push([+TOTAL.toFixed(3), list[list.length - 1][1]]);
[tableKeys, pusherKeys, ramKeys, shuttleKeys].forEach(endKey);
for (const l of lamps) if (l.off === Infinity) l.off = TOTAL + 1;

// ---- camera and helpers ------------------------------------------------------------------------
const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, 0, TOWER_TOP + 6], [0, 78, CAP_REST + 8], [STACK[0], STACK[1], 64], [-NEST_R, 0, CAP_REST + 8]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 68 },
);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const polar = (r, deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];

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
  const label = { x: 26, y: 74, w: 62, d: 11, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 6, label.y + 7], 0.8, P, "x"), "implement", { size: 4.2, tone: "mid" }));
  out.push(D([at([label.x + label.w - 4, label.y + 3, 0.8]), at([label.x + label.w - 4, label.y + label.d - 3, 0.8])], { size: 0.45 }));
  return out.join("");
}

// the backlog chute at the claim station, and the pusher that feeds it
function chute() {
  const out = [];
  for (const x of [-124, -84]) out.push(S(k.slabOf({ x: x - 4, y: -6, w: 8, d: 12, r: 1 }, 0, TT - 3, P, 3, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(CHUTE, TT - 3, 3, P, 4, 0.5), { tone: "mid" }));
  for (const y of [CHUTE.y, CHUTE.y + CHUTE.d - 1.6]) out.push(S(k.slabOf({ x: CHUTE.x + 8, y, w: CHUTE.w - 8, d: 1.6, r: 0.4 }, TT, 1.4, P, 2), { tone: "mid", crease: "none" }));
  const ticks = k.topTicks(-124, -60, 6.5, 4, CHUTE.y + CHUTE.d, TT, [1.6, 3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(S(k.slabOf({ x: CHUTE.x - 6, y: -7, w: 8, d: 14, r: 1.2 }, 0, TT + 6, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([CHUTE.x - 2, -3.5, TT + 6]), at([CHUTE.x - 2, 3.5, TT + 6])], { size: 0.45 }));
  return out.join("");
}

// the spec rack at the understand station
function rack() {
  const out = [];
  const plan = { x: -24, y: -90, w: 48, d: 16, r: 2 };
  out.push(S(k.slabOf(plan, 0, 4, P, 4, 0.5), { tone: "lo" }));
  out.push(D(k.corners(plan, 2.4).map(([x, y]) => at([x, y, 4])), { size: 0.45 }));
  [-14, 0, 14].forEach((x, i) => {
    const card = { x: x - 5.5, y: -84 + i * 0.01, w: 11, d: 1.4, r: 0.3 };
    out.push(L(k.planOutline({ x: x - 6.5, y: -85, w: 13, d: 3.4, r: 0.6 }, 4, P, 2), { tone: "lo" }));
    out.push(S(k.slabOf(card, 4, 18, P, 2), { tone: i === 0 ? "hi" : "mid", crease: "none" }));
    const face = card.y + card.d;
    const rules = [[19, 8], [16, 6], [13, 7], [10, 4]].map(([z, len]) => k.segment([card.x + 2, face, z], [card.x + 2 + len, face, z], P)).join("");
    out.push(L(rules, { tone: "lo", free: true }));
    out.push(`<g data-p="spec" data-s="${i}" opacity="0">${S(k.slabOf(card, 4, 18, P, 2), { tone: "hi", lit: true, crease: "none" })}${L(rules, { tone: "mid", free: true })}</g>`);
  });
  return out.join("");
}

// sprint-002's backlog, parked until this sprint is green
function nextSprint() {
  const plan = { x: -128, y: 26, w: 56, d: 22, r: 2 };
  const out = [S(k.slabOf(plan, 0, 4, P, 4, 0.5), { tone: "lo" })];
  out.push(D(k.corners(plan, 2.2).map(([x, y]) => at([x, y, 4])), { size: 0.4 }));
  [-118, -100, -82].forEach((x, i) => {
    const tile = { x: x - 7, y: 31, w: 14, d: 12, r: 1 };
    out.push(L(k.planOutline(k.insetPlan(tile, -1.2), 4, P, 3), { tone: "faint" }));
    out.push(S(k.slabOf(tile, 4, TILE.h, P, 3, 0.3), { tone: "mid", crease: "lo" }));
    out.push(D(Array.from({ length: 4 + i }, (_, j) => at([tile.x + 2.6 + (j % 3) * 2.2, tile.y + 2.6 + Math.floor(j / 3) * 2.2, 4 + TILE.h])), { size: 0.45, tone: "lo" }));
  });
  out.push(D([at([plan.x + 4, plan.y + plan.d - 3, 4]), at([plan.x + 7, plan.y + plan.d - 3, 4])], { size: 0.6, tone: "mid" }));
  return out.join("");
}

// the configured gates: one toggle per command
function gatesPanel() {
  const box = { x: -112, y: -74, w: 46, d: 22, r: 2.5 };
  const out = [S(k.slabOf(box, 0, 10, P, 4, 0.8), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(box, 2.4), 10, P, 4), { tone: "faint" }));
  out.push(D(k.corners(box, 2.2).map(([x, y]) => at([x, y, 10])), { size: 0.45 }));
  [-102, -94, -86, -78].forEach((x) => {
    out.push(L(k.ring(x, -63, 2, 10, P, 16), { tone: "lo" }));
    out.push(S(k.cylinder(x, -63, 1.2, 10, 1, P, 14), { tone: "mid" }));
    out.push(S(k.cylinder(x, -61.5, 0.5, 11, 4, P, 10), { tone: "hi", crease: "none" }));
  });
  return out.join("");
}

// the stack light: one segment per gate and a beacon for the sprint
const SEG_Z = [8, 15, 22, 29];
function stackLight() {
  const [x, y] = STACK;
  const out = [S(k.cylinder(x, y, 6, 0, 2, P, 28, 0.4), { tone: "lo" })];
  out.push(D([0, 90, 180, 270].map((a) => at([x + 4.6 * Math.cos((a * Math.PI) / 180), y + 4.6 * Math.sin((a * Math.PI) / 180), 2])), { size: 0.4 }));
  out.push(S(k.cylinder(x, y, 1.6, 2, 6, P, 16), { tone: "mid", crease: "none" }));
  SEG_Z.forEach((z, g) => {
    out.push(S(k.cylinder(x, y, 3.4, z, 6.4, P, 24, 0.3), { tone: "mid" }));
    out.push(`<g data-p="seg" data-g="${g}" opacity="0">${S(k.cylinder(x, y, 3.4, z, 6.4, P, 24, 0.3), { tone: "hi", lit: true })}</g>`);
    out.push(`<g data-p="segx" data-g="${g}" opacity="0">${L(k.sideArc(x, y, 3.4, z + 3.2, P, 16), { tone: "hi" })}</g>`);
  });
  out.push(S(k.cylinder(x, y, 3.4, 36, 1, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 2.4, 37, 4, P, 20, 0.4), { tone: "mid" }));
  out.push(`<g data-p="beacon" opacity="0">${S(k.cylinder(x, y, 2.4, 37, 4, P, 20, 0.4), { tone: "hi", lit: true })}</g>`);
  return out.join("");
}

function table() {
  const out = [S(k.cylinder(0, 0, HOUSING_R, 0, TT - 5, P, 64, 0.6), { tone: "lo" })];
  out.push(L(k.sideArc(0, 0, HOUSING_R, 3, P, 40), { tone: "faint" }));
  out.push(S(k.cylinder(0, 0, TABLE_R, TT - 5, 5, P, 72, 1), { tone: "mid" }));
  out.push(L(k.sideArc(0, 0, TABLE_R, TT - 3, P, 48), { tone: "faint" }));
  out.push(L(k.ring(0, 0, TABLE_R - 1.4, TT, P, 120), { tone: "lo" })); // the scale circle the index ticks hang from
  out.push(`<g data-p="top"></g>`);
  return out.join("");
}

function hub() {
  const out = [S(k.cylinder(0, 0, HUB_R, TT, 2, P, 40, 0.4), { tone: "mid" })];
  out.push(D(Array.from({ length: 6 }, (_, i) => at([...polar(HUB_R - 3, i * 60 + 15), TT + 2])), { size: 0.45 }));
  return out.join("");
}

// the fixed centre tower: arms reach out to every station
function armPlan(deg, r0, r1, w) {
  const [cx, cy] = polar(1, deg).map(Math.round);
  if (cx !== 0) return { x: cx > 0 ? r0 : -r1, y: -w / 2, w: r1 - r0, d: w, r: 1.4 };
  return { x: -w / 2, y: cy > 0 ? r0 : -r1, w, d: r1 - r0, r: 1.4 };
}
function arm(deg, r1 = 46, w = 10) {
  const plan = armPlan(deg, 4, r1, w);
  return S(k.slabOf(plan, ARM_Z[0], ARM_Z[1] - ARM_Z[0], P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, ARM_Z[0] + 2, P, 3), { tone: "faint" }) });
}
function bushing(x, y, r = 3.4) {
  return S(k.cylinder(x, y, r, ARM_Z[0] - 3, 3, P, 20, 0.3), { tone: "mid" }) + S(k.cylinder(x, y, r, ARM_Z[1], 3, P, 20, 0.3), { tone: "mid" }) + L(k.ring(x, y, r - 1, ARM_Z[1] + 3, P, 16), { tone: "lo" });
}
function tower() {
  const out = [S(k.cylinder(0, 0, TOWER_R + 2, TT + 2, 4, P, 32, 0.4), { tone: "mid" })];
  out.push(S(k.cylinder(0, 0, TOWER_R, TT + 6, TOWER_TOP - TT - 6, P, 40), { tone: "mid", inner: L(k.sideArc(0, 0, TOWER_R, 30, P, 24), { tone: "faint" }) }));
  out.push(S(k.cylinder(0, 0, TOWER_R + 2, TOWER_TOP, 3, P, 32, 0.6), { tone: "mid" }));
  out.push(D(Array.from({ length: 6 }, (_, i) => at([...polar(TOWER_R, i * 60), TOWER_TOP + 3])), { size: 0.45 }));
  return out.join("");
}

// the ram that ejects a finished tile into done
function ramHousing() {
  const plan = { x: -4.5, y: HUB_R - 2, w: 9, d: 10, r: 1 };
  return S(k.slabOf(plan, TT + 2, 5, P, 3, 0.4), { tone: "mid" }) + D([at([-2.4, HUB_R + 6, TT + 7]), at([2.4, HUB_R + 6, TT + 7])], { size: 0.4 });
}

// the done shuttle: one slot per task, it steps sideways after each one
function shuttleRail() {
  const rail = { x: -56, y: 64, w: 112, d: 16, r: 2 };
  const out = [S(k.slabOf(rail, 0, TT - 4, P, 4, 0.5), { tone: "lo" })];
  out.push(D([at([rail.x + 3, rail.y + 8, TT - 4]), at([rail.x + rail.w - 3, rail.y + 8, TT - 4])], { size: 0.45 }));
  for (const x of [-56, 52]) out.push(S(k.slabOf({ x, y: 66, w: 4, d: 12, r: 0.8 }, TT - 4, 3, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}
function shuttle() {
  const plan = { x: -48, y: 62, w: 60, d: 20, r: 2 };
  const out = [S(k.slabOf(plan, TT - 4, 4, P, 4, 0.5), { tone: "mid" })];
  for (let s = 0; s < 3; s++) out.push(L(k.planOutline({ x: -s * SLOT - 8, y: DONE_R - 7, w: 16, d: 14, r: 1 }, TT, P, 3), { tone: "lo" }));
  out.push(D(k.corners(plan, 2).map(([x, y]) => at([x, y, TT])), { size: 0.4 }));
  return out.join("");
}

function motor() {
  const out = [S(k.slabOf({ x: HOUSING_R - 1, y: -3, w: 22, d: 6, r: 1.5 }, 2, 4, P, 3, 0.3), { tone: "mid" })];
  const box = { x: 66, y: -12, w: 22, d: 24, r: 2.5 };
  out.push(S(k.slabOf(box, 0, 18, P, 4, 0.8), { tone: "mid" }));
  for (const y of [-8, -4, 0, 4, 8]) out.push(L(k.lineOnTop([box.x, y], [box.x + box.w, y], 18, P), { tone: "lo" }));
  out.push(D(k.corners(box, 2.6).map(([x, y]) => at([x, y, 18])), { size: 0.45 }));
  // detent: a roller that locks each index
  out.push(S(k.slabOf({ x: -48, y: 40, w: 8, d: 8, r: 1.2 }, 0, TT - 2, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(...polar(TABLE_R + 1.6, 135), 1.6, TT - 4, 3, P, 14), { tone: "hi", crease: "none" }));
  return out.join("");
}

// plungers: lower rod (under the arm), then spring, upper rod and cap
const plungerLower = (id) => `<g data-p="lo-${id}"></g>`;
function plungerUpper(id, x, y, capR = 3) {
  return [
    `<path class="iso-line" data-p="sb-${id}" data-tone="lo" d=""/>`,
    `<g data-p="up-${id}"></g>`,
    `<path class="iso-line" data-p="sf-${id}" data-tone="mid" d=""/>`,
    `<g data-p="cap-${id}">${S(k.cylinder(x, y, capR, CAP_REST, 3.6, P, 22, 0.4), { tone: "mid" })}${L(k.knurl(x, y, capR, CAP_REST, CAP_REST + 3.6, 24, P), { tone: "lo" })}</g>`,
  ].join("");
}
const HEADS = [
  { id: "claim", x: -NEST_R, y: 0 },
  { id: "read", x: 0, y: -NEST_R },
  { id: "tool", x: NEST_R, y: 0, capR: 3.6 },
  ...PROBES.map((dx, g) => ({ id: "probe" + g, x: dx, y: NEST_R, capR: 1.4, r: 0.6 })),
  { id: "label", x: 0, y: DONE_R },
];
const headById = Object.fromEntries(HEADS.map((h) => [h.id, h]));
function station(ids, armDeg, armR, armW) {
  const heads = ids.map((id) => headById[id]);
  const out = [];
  out.push(heads.map((h) => plungerLower(h.id)).join(""));
  out.push(arm(armDeg, armR, armW));
  if (ids[0] === "probe0") {
    const block = { x: -8, y: NEST_R - 4, w: 16, d: 8, r: 1.2 };
    out.push(S(k.slabOf(block, ARM_Z[0] - 3, 3, P, 3, 0.3), { tone: "mid" }));
    out.push(S(k.slabOf(block, ARM_Z[1], 2, P, 3, 0.3), { tone: "mid" }));
    out.push(L(PROBES.map((dx) => k.ring(dx, NEST_R, 0.9, ARM_Z[1] + 2, P, 10)).join(""), { tone: "lo" }));
  }
  for (const h of heads) {
    if (!h.id.startsWith("probe")) out.push(bushing(h.x, h.y, h.id === "tool" ? 4.2 : 3.4));
    out.push(plungerUpper(h.id, h.x, h.y, h.capR ?? 3));
  }
  if (ids.includes("label")) {
    // the label roll on top of the arm
    out.push(S(k.cylinder(0, 56, 1.4, ARM_Z[1], 1.2, P, 14), { tone: "mid", crease: "none" }));
    out.push(S(k.cylinder(0, 56, 4.2, ARM_Z[1] + 1.2, 3.6, P, 28, 0.4), { tone: "hi" }));
    out.push(L(k.ring(0, 56, 1.8, ARM_Z[1] + 4.8, P, 16), { tone: "lo" }));
    out.push(D([at([0, 56, ARM_Z[1] + 4.8])], { size: 0.5 }));
  }
  return out.join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A rotary index table with a fixed centre tower. A pusher feeds the next task tile from the backlog chute onto the table, where a stamp marks it in progress. The table turns a quarter at a time: a reading head lights the spec it reads, a spindle works the tile, and four probes test it while a stack light shows build, lint, tests and acceptance. When the tests fail the table turns back to the spindle; only when all four lamps are lit does a ram push the tile into the done shuttle, where a labeller adds its summary. After the last task the full suite runs again and a beacon lights.",
  body: [
    `<g data-scene>`,
    base(),
    gatesPanel(),
    chute(),
    `<g data-p="pusher"></g>`,
    nextSprint(),
    rack(),
    stackLight(),
    table(),
    hub(),
    `<g data-p="far"></g>`,
    station(["claim"], 180),
    station(["read"], 270),
    tower(),
    ramHousing(),
    `<g data-p="ram"></g>`,
    motor(),
    shuttleRail(),
    `<g data-p="shuttle">${shuttle()}</g>`,
    `<g data-p="near"></g>`,
    station(["tool"], 0),
    station(["probe0", "probe1", "probe2", "probe3", "label"], 90, DONE_R + 5, 10),
    `</g>`,
  ],
});

// ---- live ----------------------------------------------------------------------------------------
const live = `
const P = ${JSON.stringify(P)};
const TT = ${TT}, TILE = ${JSON.stringify(TILE)}, TILE_TOP = ${TILE_TOP}, NEST_R = ${NEST_R}, TABLE_R = ${TABLE_R}, HUB_R = ${HUB_R};
const ARM_Z = ${JSON.stringify(ARM_Z)}, CAP_REST = ${CAP_REST}, TRAVEL = ${TRAVEL}, TIP_REST = ${TIP_REST};
const DONE_R = ${DONE_R}, SLOT = ${SLOT}, QUEUE = ${JSON.stringify(QUEUE)}, CHUTE = ${JSON.stringify(CHUTE)};
const HEADS = ${JSON.stringify(HEADS)};
const TASKS = ${JSON.stringify(TASKS)};
const TILES = ${JSON.stringify(tiles)};
const KEYS = { table: ${JSON.stringify(tableKeys)}, pusher: ${JSON.stringify(pusherKeys)}, ram: ${JSON.stringify(ramKeys)}, shuttle: ${JSON.stringify(shuttleKeys)} };
const PRESSES = ${JSON.stringify(presses)};
const LAMPS = ${JSON.stringify(lamps)};
const PHASES = ${JSON.stringify(phases)};
const BEACON = ${BEACON}, DONE = ${DONE}, TOTAL = ${TOTAL};
const RAD = Math.PI / 180;
const centreDepth = depthOf([0, 0, 0], P);

const keyAt = (list, u) => {
  let i = 0;
  while (i < list.length - 2 && list[i + 1][0] <= u) i++;
  const a = list[i], b = list[i + 1] ?? a;
  const f = b[0] > a[0] ? sm(clamp01((u - a[0]) / (b[0] - a[0]))) : 1;
  return lerp(a[1], b[1], f);
};
const pressAt = (key, u) => {
  let v = 0;
  for (const p of PRESSES) if (p.key === key) v = Math.max(v, ss(u, p.t, p.t + 0.3) - ss(u, p.t + p.d - 0.3, p.t + p.d));
  return v;
};
// a rectangle in a frame turned to angle deg (u tangential, v radial), centred at c
const inFrame = (c, deg) => { const r = [Math.cos(deg * RAD), Math.sin(deg * RAD)], t = [-r[1], r[0]]; return (u, v) => [c[0] + u * t[0] + v * r[0], c[1] + u * t[1] + v * r[1]]; };
const rectIn = (f, w, d, rr = 1) => roundedPlan({ x: -w / 2, y: -d / 2, w, d, r: rr }, 3).map(([u, v]) => f(u, v));

// ---- one tile, wherever it is
function tileAt(n, u) {
  const t = TILES[n];
  const pushed = keyAt(KEYS.pusher, u);
  if (u < t.attach) {
    const r = QUEUE[n] - pushed;
    return { c: [-r, 0], deg: 180, live: u >= t.claim };
  }
  if (u < t.eject) {
    const deg = 180 + keyAt(KEYS.table, u) - t.angle0;
    return { c: [NEST_R * Math.cos(deg * RAD), NEST_R * Math.sin(deg * RAD)], deg, live: true };
  }
  if (u < t.landed) {
    const tip = keyAt(KEYS.ram, u);
    return { c: [0, Math.max(NEST_R, tip + TILE.d / 2 + 0.2)], deg: 90, live: true };
  }
  return { c: [keyAt(KEYS.shuttle, u) - SLOT * n, DONE_R], deg: 90, live: false };
}
function tileSvg(n, u) {
  const t = TILES[n];
  const { c, deg, live } = tileAt(n, u);
  const f = inFrame(c, deg);
  const lit = live && u < t.landed;
  let out = solidSvg(extrude(rectIn(f, TILE.w, TILE.d), TT, TILE.h, P, { bevel: 0.3 }), { tone: "hi", crease: "lo", lit });
  // id dots
  const dots = [];
  for (let i = 0; i < TASKS[n].id; i++) dots.push(at([...f(-5 + i * 2.2, 3.6), TILE_TOP]));
  out += dotsSvg(dots, { size: 0.5, tone: "hi" });
  // in-progress stamp: a ring, set by the claim head, gone once done
  const stamp = ss(u, t.stamp, t.stamp + 0.15) * (1 - ss(u, t.landed, t.landed + 0.3));
  if (stamp > 0.01) out += '<g opacity="' + stamp.toFixed(3) + '">' + lineSvg(ring(...f(4.2, 3.4), 1.4, TILE_TOP, P, 14), { tone: "hi" }) + "</g>";
  // code: three rules, written by the spindle
  let grown = 0;
  t.ink.forEach(([a, b], i) => { grown = Math.max(grown, i === 0 ? seg(u, a + 0.3, b - 0.3) : 1); });
  if (grown > 0) {
    const lines = [9, 6, 8].map((len, i) => { const v = 0.4 - i * 2.2; const l = len * clamp01(grown * 3 - i); return l > 0.2 ? "M" + at([...f(-5.4, v), TILE_TOP]).map((q) => q.toFixed(1)).join(" ") + "L" + at([...f(-5.4 + l, v), TILE_TOP]).map((q) => q.toFixed(1)).join(" ") : ""; }).join("");
    out += lineSvg(lines, { tone: "mid", free: true });
  }
  // the summary label, pressed on in done
  const lab = ss(u, t.label, t.label + 0.15);
  if (lab > 0.01) out += '<g opacity="' + lab.toFixed(3) + '">' + solidSvg(extrude(rectIn(inFrame(f(0, -2.2), deg), 10, 5, 0.6), TILE_TOP, 0.3, P), { tone: "hi", lit: true, crease: "none" }) + "</g>";
  return { key: depthOf([c[0], c[1], 0], P), svg: out };
}

// ---- plungers
const setPlunger = (h, press, extra) => {
  const tip = TIP_REST - TRAVEL * press;
  const capBottom = CAP_REST - TRAVEL * press;
  const r = h.r ?? 1.3;
  let lower = solidSvg(cylinder(h.x, h.y, r, tip, ARM_Z[0] - 3 - tip, P, 12), { tone: "hi", crease: "none" });
  lower += extra ? extra(tip) : "";
  $("lo-" + h.id).innerHTML = lower;
  $("up-" + h.id).innerHTML = solidSvg(cylinder(h.x, h.y, r, ARM_Z[1] + 3, Math.max(0.1, capBottom - ARM_Z[1] - 3), P, 12), { tone: "hi", crease: "none" });
  move($("cap-" + h.id), [0, 0, capBottom - CAP_REST]);
  spring($("sb-" + h.id), $("sf-" + h.id), h.x, h.y, ARM_Z[1] + (h.id.startsWith("probe") ? 2 : 3), Math.max(capBottom, ARM_Z[1] + 4.5), (h.capR ?? 3) - 0.6, h.id.startsWith("probe") ? 4 : 5);
};
const flutes = (x, y, r, z0, z1, phase) => {
  const v = towardViewer(P), face = Math.atan2(v[1], v[0]);
  const out = [];
  for (let i = 0; i < 12; i++) {
    const a = phase + (i * Math.PI) / 6;
    const off = Math.atan2(Math.sin(a - face), Math.cos(a - face));
    if (Math.abs(off) > 1.25) continue;
    out.push("M" + at([x + r * Math.cos(a), y + r * Math.sin(a), z0]).map((q) => q.toFixed(1)).join(" ") + "L" + at([x + r * Math.cos(a), y + r * Math.sin(a), z1]).map((q) => q.toFixed(1)).join(" "));
  }
  return out.join("");
};

const FIGURE = {
  total: TOTAL,
  rest: DONE + 1,
  steps: PHASES.map((p) => p.t0).concat([TOTAL - 0.01]),
  render(u) {
    const tableDeg = keyAt(KEYS.table, u);
    // the table's top: rim ticks, bolts and the four nests, all turning
    const ticks = radialTicks(0, 0, TABLE_R - 1.4, 72, 18, TT, [1.8, TABLE_R - 1.4 - (NEST_R + (TILE.d + 2.4) / 2)], P, tableDeg * RAD + Math.PI);
    const nests = [0, 1, 2, 3].map((i) => { const deg = 180 + tableDeg + i * 90; const c = [NEST_R * Math.cos(deg * RAD), NEST_R * Math.sin(deg * RAD)]; return pathOf(rectIn(inFrame(c, deg), TILE.w + 2.4, TILE.d + 2.4, 1.4).map((p) => at([...p, TT])), true); }).join("");
    const pins = [];
    for (let i = 0; i < 4; i++) { const f = inFrame([0, 0], 180 + tableDeg + i * 90); pins.push(at([...f(-10, NEST_R), TT]), at([...f(10, NEST_R), TT]), at([...f(0, 22), TT])); }
    $("top").innerHTML = lineSvg(ticks.minor, { tone: "lo" }) + lineSvg(ticks.major, { tone: "mid" }) + lineSvg(nests, { tone: "lo" }) + dotsSvg(pins, { size: 0.45 });

    // pusher and its rod
    const pushed = keyAt(KEYS.pusher, u);
    const px = -(QUEUE[2] + TILE.d / 2) + pushed;
    $("pusher").innerHTML = solidSvg(slabOf({ x: CHUTE.x - 0.5, y: -1.2, w: px - 6 - CHUTE.x + 0.5, d: 2.4, r: 0.6 }, TT + 2, 2.4, P, 2), { tone: "mid", crease: "none" }) +
      solidSvg(slabOf({ x: px - 6, y: -6.4, w: 6, d: 12.8, r: 1 }, TT, 6, P, 3, 0.4), { tone: "mid" });

    // tiles, split around the tower by depth
    const far = [], near = [];
    TILES.forEach((t, n) => { const d = tileSvg(n, u); (d.key < centreDepth ? far : near).push(d); });
    far.sort((a, b) => a.key - b.key); near.sort((a, b) => a.key - b.key);
    $("far").innerHTML = far.map((d) => d.svg).join("");
    $("near").innerHTML = near.map((d) => d.svg).join("");

    // ram: two stages out of the hub
    const tip = keyAt(KEYS.ram, u);
    const s1 = Math.min(tip, 46);
    let ram = solidSvg(slabOf({ x: -2.6, y: HUB_R + 8, w: 5.2, d: Math.max(0.4, s1 - HUB_R - 8), r: 0.6 }, TT + 0.4, 2.6, P, 2), { tone: "hi", crease: "none" });
    if (tip > 46) ram += solidSvg(slabOf({ x: -1.6, y: 45.5, w: 3.2, d: tip - 45.5, r: 0.5 }, TT + 0.8, 1.8, P, 2), { tone: "hi", crease: "none" });
    $("ram").innerHTML = ram;
    move($("shuttle"), [keyAt(KEYS.shuttle, u), 0, 0]);

    // heads
    for (const h of HEADS) {
      const p = pressAt(h.id, u);
      if (h.id === "claim") setPlunger(h, p, (z) => solidSvg(cylinder(h.x, h.y, 2.6, z, 2, P, 18, 0.3), { tone: "mid" }));
      else if (h.id === "read") {
        let reading = 0;
        TILES.forEach((t) => { reading = Math.max(reading, ss(u, t.read[0] + 0.3, t.read[0] + 0.5) - ss(u, t.read[1] - 0.4, t.read[1] - 0.2)); });
        setPlunger(h, p, (z) => solidSvg(cylinder(h.x, h.y, 3.2, z, 3, P, 22, 0.4), { tone: "mid" }) + (reading > 0.01 ? '<g opacity="' + reading.toFixed(3) + '">' + lineSvg(ring(h.x, h.y, 2, z, P, 18), { tone: "lit" }) + "</g>" : ""));
        $$("spec").forEach((el) => { let on = 0; TILES.forEach((t, n) => { if (TASKS[n].spec === +el.dataset.s) on = Math.max(on, ss(u, t.read[0] + 0.3, t.read[0] + 0.5) - ss(u, t.read[1] - 0.4, t.read[1] - 0.2)); }); show(el, on); });
      } else if (h.id === "tool") {
        setPlunger(h, p, (z) => solidSvg(cylinder(h.x, h.y, 0.9, z, 3, P, 12), { tone: "hi", crease: "none" }) + solidSvg(cylinder(h.x, h.y, 3.6, z + 3, 6, P, 24, 0.4), { tone: "mid" }) + lineSvg(flutes(h.x, h.y, 3.6, z + 3, z + 9, u * 9 * p), { tone: "lo" }));
      } else if (h.id === "label") setPlunger(h, p, (z) => solidSvg(slabOf({ x: -5.5, y: DONE_R - 4.4, w: 11, d: 6, r: 0.8 }, z, 2, P, 2, 0.3), { tone: "mid" }));
      else setPlunger(h, p);
    }

    // stack light
    $$("seg").forEach((el) => { const g = +el.dataset.g; let on = 0; for (const l of LAMPS) if (l.seg === g && !l.fail) on = Math.max(on, ss(u, l.on, l.on + 0.25) * (1 - ss(u, l.off, l.off + 0.3))); show(el, on); });
    $$("segx").forEach((el) => { const g = +el.dataset.g; let on = 0; for (const l of LAMPS) if (l.seg === g && l.fail) on = Math.max(on, ss(u, l.on, l.on + 0.2) * (1 - ss(u, l.off, l.off + 0.3))); show(el, on); });
    show($("beacon"), ss(u, BEACON, BEACON + 0.4));
  },
  say(u) {
    let cur = { label: "${SPRINT} \\u00b7 3 tasks in backlog", aria: "Sprint 001 starts with three tasks in backlog" };
    for (const p of PHASES) if (u >= p.t0) cur = p;
    return { readout: cur.label, phase: cur.label, aria: cur.aria };
  },
};
${ENGINE}
`;

writePages(k, kitScript, {
  name: "implement",
  title: "av-swe implement",
  figure: svg,
  live,
  plate: {
    fig: "Fig 4",
    title: "av-swe implement",
    hint: "Hover to scrub the sprint",
    readout: SPRINT + " \u00b7 3 tasks in backlog",
    aria: "av-swe implement: hover or use the arrow keys to step through the sprint",
    total: Math.round(TOTAL),
    keys: [
      { mark: "lit", label: "The tile in progress: one task at a time" },
      { mark: "raised", label: "Stations: claim, understand, implement, test" },
      { mark: "dim", label: "Stack light: build, lint, tests, acceptance" },
    ],
    caption:
      "implement runs one sprint, one task at a time, lowest number first. A task is claimed only when its dependencies are already done, then the agent reads the task, its spec and the code, and changes only what the task asks. It is done only when the real build, lint, test and acceptance checks all pass; a failing test sends it back to implement and it stays in_progress. Each finished task leaves a summary in done/. When the backlog is empty, the full suite runs once more before the next sprint.",
  },
});
