// Fig 3 · av-swe plan: a pick-and-place gantry that cuts the specs into task tiles and loads
// them, in dependency order, into sprint trays, writing PLAN.md as it goes.
//   node docs/anatomy/plan.mjs   -> docs/anatomy/plan.html, plan-light.html
import { ENGINE, loadKit, writePages } from "./common.mjs";

const { k, kitScript } = await loadKit();

const WIDTH = 760;
const HEIGHT = 420;

// ---- world --------------------------------------------------------------------------------
const PLATE = { x: -14, y: -84, w: 318, d: 166, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const WALL = { x: -6, y: -82, w: 302, d: 8, r: 1.5 }; // rail wall at the back
const WALL_H = 44;
const RAIL = { x: -4, y: -80, w: 298, d: 4, r: 1 };
const ARM_Z = [52, 58];
const CAR = { w: 22, y0: -84, y1: -68 }; // x-carriage riding the rail
const ARM_Y = [-74, 58];
const PICK = { w: 12, d: 12 };
const QUILL_R = 1.4;
const UP = 34; // tile bottom while travelling

const TILE = { w: 14, d: 12, h: 1.6 };
const SPECS = [
  { id: "overview", y: -50 },
  { id: "persistence", y: -26 },
  { id: "transport", y: -2 },
  { id: "jobs", y: 22 },
  { id: "export-csv", y: 46 },
];
const SPEC_X = 4;
const SPEC = { w: 40, d: 18 };
const MAG = { x: 64, y: 40, w: TILE.w, d: TILE.d }; // the stack of blank task tiles
const TRAY_X = [100, 166, 232];
const TRAY = { y: -60, w: 58, d: 88 };
const TRAY_H = 2.4;
const BACKLOG = { y: -56, d: 32 };
const STATES = [
  { id: "backlog", y: -56, d: 32 },
  { id: "in_progress", y: -20, d: 12 },
  { id: "blocked", y: -5, d: 12 },
  { id: "done", y: 10, d: 12 },
];
const SLOT_X = (sprint, j) => TRAY_X[sprint] + 6 + j * 16.5 + TILE.w / 2;
const SLOT_Y = BACKLOG.y + BACKLOG.d / 2;
const LEDGER = { x: 100, y: 40, w: 190, d: 30, r: 1.5 };
const LEDGER_H = 1.2;
const SPRINTS = ["sprint-001 foundation", "sprint-002 architecture", "sprint-003 features & hardening"];

// The plan this figure loads. Order is bottom-up; every dependency is an earlier task.
const TASKS = [
  { id: 1, name: "scaffold build + test harness", spec: 0, sprint: 0, deps: [] },
  { id: 2, name: "config & base types", spec: 0, sprint: 0, deps: [1] },
  { id: 3, name: "datastore setup", spec: 1, sprint: 0, deps: [1] },
  { id: 4, name: "persistence repository", spec: 1, sprint: 1, deps: [2, 3] },
  { id: 5, name: "transport API", spec: 2, sprint: 1, deps: [2] },
  { id: 6, name: "jobs runner", spec: 3, sprint: 1, deps: [3] },
  { id: 7, name: "export endpoint", spec: 4, sprint: 2, deps: [4, 5] },
  { id: 8, name: "export job", spec: 4, sprint: 2, deps: [6, 7] },
  { id: 9, name: "edge cases & observability", spec: 4, sprint: 2, deps: [8] },
];
TASKS.forEach((task) => { task.slot = TASKS.filter((t) => t.sprint === task.sprint && t.id < task.id).length; });
for (const task of TASKS) for (const dep of task.deps) if (dep >= task.id) throw new Error(`task ${task.id} depends on a later task ${dep}`);

// ---- the motion, as keyframes ------------------------------------------------------------------
const keys = []; // [t, x, y, z]
const events = [];
let clock = 0;
let pos = [150, 0, UP];
const key = (t, p) => keys.push([+t.toFixed(3), ...p.map((v) => +v.toFixed(2))]);
key(0, pos);
const go = (p, dur) => { clock += dur; pos = p; key(clock, pos); };
const hold = (dur) => { clock += dur; key(clock, pos); };
const specX = SPEC_X + SPEC.w / 2;
hold(0.8);
const READ_END = (() => {
  // read the inputs: sweep the picker down the spec tray
  go([specX, SPECS[0].y, UP - 8], 0.9);
  go([specX, SPECS[4].y, UP - 8], 1.6);
  return clock;
})();
TASKS.forEach((task, index) => {
  const stack = (TASKS.length - index) * TILE.h; // top of the stack before this pick
  const magC = [MAG.x + MAG.w / 2, MAG.y + MAG.d / 2];
  const t0 = clock;
  go([magC[0], magC[1], UP], 0.6);
  go([magC[0], magC[1], 1.2 + stack - TILE.h], 0.3);
  const grab = clock;
  hold(0.1);
  go([magC[0], magC[1], UP], 0.3);
  const spec = SPECS[task.spec];
  go([specX, spec.y + SPEC.d / 2, UP], 0.55);
  go([specX, spec.y + SPEC.d / 2, 2.6], 0.25);
  const stamp = clock;
  hold(0.1);
  go([specX, spec.y + SPEC.d / 2, UP], 0.25);
  const slot = [SLOT_X(task.sprint, task.slot), SLOT_Y];
  const approach = clock;
  go([slot[0], slot[1], UP], 0.7);
  go([slot[0], slot[1], TRAY_H], 0.3);
  const place = clock;
  hold(0.1);
  go([slot[0], slot[1], UP], 0.3);
  events.push({ task: index, t0, grab, stamp, approach, place });
});
const CHECK = clock + 0.2;
go([84, -40, UP], 0.9);
const PEGS = CHECK + 0.6; // .gitkeep in every state folder, then coverage, then the ledger version
const COVER = PEGS + 2.2;
const VERSION = COVER + 1.2;
hold(VERSION + 0.6 - clock);
const DONE = clock;
hold(3.4);
const TOTAL = clock;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, -80, ARM_Z[1] + 4], [290, -80, ARM_Z[1] + 4], [290, ARM_Y[1], ARM_Z[1]]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 50 },
);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---- static art --------------------------------------------------------------------------------
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
  // label plate
  const label = { x: 6, y: 66, w: 52, d: 11, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 6, label.y + 7], 0.8, P, "x"), "plan", { size: 4.4, tone: "mid" }));
  out.push(D([at([label.x + label.w - 4, label.y + 3, 0.8]), at([label.x + label.w - 4, label.y + label.d - 3, 0.8])], { size: 0.45 }));
  return out.join("");
}

function wall() {
  const out = [S(k.slabOf(WALL, 0, WALL_H, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(WALL, 8, P, 3), { tone: "faint" }) })];
  // stiffeners on the wall face, bottom to top
  for (const x of [40, 98, 156, 214, 272]) out.push(L(k.segment([x, WALL.y + WALL.d, 0], [x, WALL.y + WALL.d, WALL_H], P), { tone: "faint" }));
  out.push(S(k.slabOf(RAIL, WALL_H, 3, P, 2, 0.4), { tone: "mid" }));
  const ticks = k.topTicks(RAIL.x + 4, RAIL.x + RAIL.w - 4, 6, 5, RAIL.y + 0.2, WALL_H + 3, [1.4, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // motor and end stop
  const motor = { x: -12, y: -84, w: 14, d: 14, r: 2 };
  out.push(S(k.slabOf(motor, WALL_H - 4, 14, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(motor, 2.4), WALL_H + 10, P, 4), { tone: "faint" }));
  out.push(D(k.corners(motor, 2).map(([x, y]) => at([x, y, WALL_H + 10])), { size: 0.45 }));
  out.push(S(k.slabOf({ x: 288, y: -82, w: 6, d: 8, r: 1 }, WALL_H + 3, 5, P, 2, 0.4), { tone: "mid" }));
  return out.join("");
}

function specs() {
  const tray = { x: SPEC_X - 4, y: -56, w: SPEC.w + 8, d: 128, r: 2.5 };
  const out = [S(k.slabOf(tray, 0, 2, P, 4, 0.5), { tone: "lo" })];
  out.push(D(k.corners(tray, 2.4).map(([x, y]) => at([x, y, 2])), { size: 0.45 }));
  SPECS.forEach((spec, i) => {
    const card = { x: SPEC_X, y: spec.y, w: SPEC.w, d: SPEC.d, r: 1 };
    out.push(S(k.slabOf(card, 2, 0.6, P, 3), { tone: i === 0 ? "hi" : "mid", crease: "none" }));
    out.push(L(k.planOutline(k.insetPlan(card, 2.4), 2.6, P, 2), { tone: "faint" }));
    const rules = i === 0 ? [30, 26, 22, 26] : [24, 30, 18];
    rules.forEach((len, r) => out.push(L(k.lineOnTop([card.x + 5, card.y + 5 + r * 3], [card.x + 5 + len, card.y + 5 + r * 3], 2.6, P), { tone: "lo", free: true })));
    // read lamp: lights while the picker stamps a task from this spec
    out.push(`<g data-p="lamp" data-s="${i}" opacity="0">${L(k.planOutline(k.insetPlan(card, 0.6), 2.6, P, 3), { tone: "lit" })}</g>`);
    // coverage flag on every feature/architecture spec (the overview is the index, not covered)
    if (i > 0) {
      const fx = card.x + card.w - 4, fy = card.y + card.d - 4;
      out.push(L(k.ring(fx, fy, 1.4, 2.6, P, 12), { tone: "lo" }));
      out.push(`<g data-p="cover" data-s="${i}" opacity="0">${S(k.cylinder(fx, fy, 0.6, 2.6, 7, P, 10), { tone: "hi", crease: "none" })}${S(k.extrude([[fx - 0.3, fy], [fx + 0.3, fy], [fx + 0.3, fy - 5], [fx - 0.3, fy - 5]], 6.6, 3, P), { tone: "hi", lit: true })}</g>`);
    }
  });
  return out.join("");
}

function magazine() {
  const out = [];
  const base = { x: MAG.x - 4, y: MAG.y - 4, w: MAG.w + 8, d: MAG.d + 8, r: 2 };
  out.push(S(k.slabOf(base, 0, 1.2, P, 3, 0.4), { tone: "lo" }));
  out.push(D(k.corners(base, 1.6).map(([x, y]) => at([x, y, 1.2])), { size: 0.4 }));
  // two guide posts on the far sides; the stack shows its tiles as seams
  out.push(S(k.cylinder(MAG.x - 1.6, MAG.y + MAG.d / 2, 1.4, 1.2, 18, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(MAG.x + MAG.w / 2, MAG.y - 1.6, 1.4, 1.2, 18, P, 14), { tone: "mid", crease: "none" }));
  out.push(`<g data-p="stack"></g>`);
  return out.join("");
}

const trayPlan = (sprint) => ({ x: TRAY_X[sprint], y: TRAY.y, w: TRAY.w, d: TRAY.d, r: 2.5 });
function trays() {
  const out = [];
  TRAY_X.forEach((x, sprint) => {
    const plan = trayPlan(sprint);
    out.push(S(k.slabOf(plan, 0, TRAY_H, P, 4, 0.6), { tone: "mid" }));
    out.push(D(k.corners(plan, 2).map(([px, py]) => at([px, py, TRAY_H])), { size: 0.4 }));
    STATES.forEach((state, s) => {
      const bin = { x: x + 3, y: state.y, w: TRAY.w - 6, d: state.d, r: 1.2 };
      out.push(L(k.planOutline(bin, TRAY_H, P, 3), { tone: s === 0 ? "mid" : "lo" }));
      // .gitkeep: a small peg in every state folder, set when the plan is verified
      const gx = bin.x + bin.w - 3, gy = bin.y + 3;
      out.push(`<g data-p="peg" data-k="${sprint * 4 + s}" opacity="0">${S(k.cylinder(gx, gy, 1, TRAY_H, 2.4, P, 12), { tone: "hi" })}</g>`);
    });
    // a number plate on the front edge, three dots per sprint number
    out.push(D(Array.from({ length: sprint + 1 }, (_, i) => at([x + 6 + i * 3, TRAY.y + TRAY.d - 3, TRAY_H])), { size: 0.6, tone: "mid" }));
  });
  // task tiles at their slots, hidden until placed
  TASKS.forEach((task) => out.push(`<g data-p="placed" data-t="${task.id}" opacity="0">${tileSvg(SLOT_X(task.sprint, task.slot), SLOT_Y, TRAY_H, task, false)}</g>`));
  return out.join("");
}

function tileSvg(cx, cy, z, task, carried) {
  const plan = { x: cx - TILE.w / 2, y: cy - TILE.d / 2, w: TILE.w, d: TILE.d, r: 1 };
  const out = [S(k.slabOf(plan, z, TILE.h, P, 3, 0.3), { tone: "hi", crease: "lo", lit: carried })];
  const top = z + TILE.h;
  // id dots (one per task number, in rows of 3) and the depends-on notch
  const marks = [];
  if (task) {
    for (let i = 0; i < task.id; i++) marks.push(at([plan.x + 3 + (i % 3) * 2.4, plan.y + 3 + Math.floor(i / 3) * 2.4, top]));
  }
  const ink = task ? D(marks, { size: 0.5, tone: "hi" }) + L(k.lineOnTop([plan.x + 10, plan.y + 2.5], [plan.x + 10, plan.y + plan.d - 2.5], top, P), { tone: "lo", free: true }) : "";
  out.push(carried ? `<g data-p="ink" opacity="0">${ink}</g>` : ink);
  if (!carried) out.push(`<g data-p="dep" data-t="${task.id}" opacity="0">${L(k.planOutline(k.insetPlan(plan, -0.9), z, P, 3), { tone: "lit" })}</g>`);
  return out.join("");
}

function ledger() {
  const out = [S(k.slabOf(LEDGER, 0, LEDGER_H, P, 3, 0.4), { tone: "hi", crease: "lo" })];
  out.push(L(k.planOutline(k.insetPlan(LEDGER, 2), LEDGER_H, P, 2), { tone: "faint" }));
  // header rule and the version stamp area
  out.push(L(k.lineOnTop([LEDGER.x + 2, LEDGER.y + 6], [LEDGER.x + LEDGER.w - 2, LEDGER.y + 6], LEDGER_H, P), { tone: "lo" }));
  out.push(`<g data-p="version" opacity="0">${L(k.ring(LEDGER.x + LEDGER.w - 10, LEDGER.y + 3.6, 2.2, LEDGER_H, P, 16), { tone: "lit" })}${D([at([LEDGER.x + LEDGER.w - 10, LEDGER.y + 3.6, LEDGER_H])], { size: 0.8, tone: "hi" })}</g>`);
  // one column under each tray; one row per task as it is placed
  TASKS.forEach((task) => {
    const x0 = TRAY_X[task.sprint] + 4;
    const y = LEDGER.y + 10 + task.slot * 5;
    const len = 22 + ((task.id * 7) % 4) * 6;
    out.push(`<g data-p="row" data-t="${task.id}" opacity="0">${L(k.lineOnTop([x0, y], [x0 + len, y], LEDGER_H, P), { tone: "mid", free: true })}${D([at([x0 - 1.6, y, LEDGER_H])], { size: 0.5, tone: "hi" })}</g>`);
  });
  for (const x of [TRAY_X[1] - 4, TRAY_X[2] - 4]) out.push(L(k.lineOnTop([x, LEDGER.y + 6], [x, LEDGER.y + LEDGER.d - 2], LEDGER_H, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([LEDGER.x + 2, LEDGER.y + LEDGER.d - 2], [LEDGER.x + LEDGER.w - 2, LEDGER.y + LEDGER.d - 2], LEDGER_H, P), { tone: "faint" }));
  return out.join("");
}

// moving parts, built at x = 0 / y = 0 and translated
function carriage() {
  const plan = { x: -CAR.w / 2, y: CAR.y0, w: CAR.w, d: CAR.y1 - CAR.y0, r: 2 };
  const out = [S(k.slabOf(plan, WALL_H + 3, ARM_Z[0] - WALL_H - 3, P, 4, 0.6), { tone: "mid" })];
  out.push(D([at([-7, CAR.y0 + 2, ARM_Z[0]]), at([7, CAR.y0 + 2, ARM_Z[0]])], { size: 0.45 }));
  return out.join("");
}
function arm() {
  const plan = { x: -5, y: ARM_Y[0], w: 10, d: ARM_Y[1] - ARM_Y[0], r: 1.5 };
  const out = [S(k.slabOf(plan, ARM_Z[0], ARM_Z[1] - ARM_Z[0], P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, ARM_Z[0] + 2, P, 3), { tone: "faint" }) })];
  out.push(L(k.planOutline({ x: -1.2, y: ARM_Y[0] + 14, w: 2.4, d: ARM_Y[1] - ARM_Y[0] - 18, r: 1.2 }, ARM_Z[1], P, 3), { tone: "faint" }));
  out.push(S(k.slabOf({ x: -6, y: ARM_Y[1] - 2, w: 12, d: 3, r: 0.8 }, ARM_Z[0] - 1, 8, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}
function picker() {
  const plan = { x: -PICK.w / 2, y: -PICK.d / 2, w: PICK.w, d: PICK.d, r: 2 };
  const out = [S(k.slabOf(plan, ARM_Z[0] - 6, ARM_Z[1] + 4 - (ARM_Z[0] - 6), P, 4, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 2), ARM_Z[1] + 4, P, 3), { tone: "faint" }));
  out.push(D(k.corners(plan, 2).map(([x, y]) => at([x, y, ARM_Z[1] + 4])), { size: 0.4 }));
  out.push(S(k.cylinder(0, 0, 3, ARM_Z[0] - 9, 3, P, 20, 0.3), { tone: "mid" }));
  return out.join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A pick-and-place gantry on a bench. On the left, five spec cards from Fig 2 lie in a tray, beside a stack of blank task tiles. A picker on a cantilever arm takes one tile at a time, touches it to the spec it comes from, and sets it in the backlog of one of three sprint trays, in dependency order. Each tray has four state compartments. As each tile lands, a row is written on the PLAN.md ledger. At the end every compartment gets a .gitkeep peg and every spec shows a coverage flag.",
  body: [
    `<g data-scene>`,
    base(),
    wall(),
    `<g data-p="car">${carriage()}</g>`,
    specs(),
    magazine(),
    trays(),
    ledger(),
    `<g data-p="carried" opacity="0">${tileSvg(0, 0, 0, TASKS[0], true)}</g>`,
    `<g data-p="quill"></g>`,
    `<g data-p="foot">${S(k.cylinder(0, 0, 2.4, 0, 1.2, P, 16), { tone: "mid" })}</g>`,
    `<g data-p="armg">${arm()}<g data-p="pick">${picker()}</g></g>`,
    `</g>`,
  ],
});

// ---- live --------------------------------------------------------------------------------------
const live = `
const P = ${JSON.stringify(P)};
const KEYS = ${JSON.stringify(keys)};
const EVENTS = ${JSON.stringify(events)};
const TASKS = ${JSON.stringify(TASKS)};
const SPRINTS = ${JSON.stringify(SPRINTS)};
const SPECS = ${JSON.stringify(SPECS.map((s) => s.id))};
const MAG = ${JSON.stringify(MAG)}, TILE = ${JSON.stringify(TILE)};
const ARM_Z = ${JSON.stringify(ARM_Z)}, QUILL_R = ${QUILL_R};
const READ_END = ${READ_END}, CHECK = ${CHECK}, PEGS = ${PEGS}, COVER = ${COVER}, VERSION = ${VERSION}, DONE = ${DONE}, TOTAL = ${TOTAL};

const poseAt = (u) => {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= u) i++;
  const a = KEYS[i], b = KEYS[i + 1] ?? a;
  const f = b[0] > a[0] ? sm(clamp01((u - a[0]) / (b[0] - a[0]))) : 1;
  return [lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f)];
};
const stackSvg = (n) => {
  if (n <= 0) return "";
  const plan = { x: MAG.x, y: MAG.y, w: MAG.w, d: MAG.d, r: 1 };
  const seams = Array.from({ length: n - 1 }, (_, i) => sideSeam(plan, 1.2 + TILE.h * (i + 1), P, 3)).join("");
  return solidSvg(slabOf(plan, 1.2, TILE.h * n, P, 3, 0.3), { tone: "hi", crease: "lo", inner: lineSvg(seams, { tone: "faint" }) });
};
let lastStack = -1;

const FIGURE = {
  total: TOTAL,
  rest: DONE + 0.5,
  steps: [0, READ_END, ...EVENTS.map((e) => e.place + 0.05), PEGS, COVER, VERSION + 0.6, TOTAL - 0.01],
  render(u) {
    const [x, y, z] = poseAt(u);
    move($("car"), [x, 0, 0]);
    move($("armg"), [x, 0, 0]);
    move($("pick"), [0, y, 0]);

    // which tile is on the quill
    let carry = -1, picked = 0;
    EVENTS.forEach((e, i) => { if (u >= e.grab) picked = i + 1; if (u >= e.grab && u < e.place) carry = i; });
    const n = TASKS.length - picked;
    if (n !== lastStack) { lastStack = n; $("stack").innerHTML = stackSvg(n); }
    const carried = $("carried");
    show(carried, carry >= 0 ? 1 : 0);
    if (carry >= 0) {
      move(carried, [x, y, z]);
      show(carried.querySelector('[data-p="ink"]'), ss(u, EVENTS[carry].stamp, EVENTS[carry].stamp + 0.12));
    }
    const tipZ = carry >= 0 ? z + TILE.h : z;
    // the rod is drawn once at the origin for its height and carried to (x, y) by a translation; the foot is a fixed disc carried to
    // (x, y, tipZ). The rod's length is rounded up to a whole unit, which keeps its lower end inside the foot, so only a few lengths ever exist
    const rodZ = Math.ceil(tipZ);
    move($("quill"), [x, y, 0]);
    $("quill").innerHTML = solidSvg(cylinder(0, 0, QUILL_R, rodZ, ARM_Z[0] - 9 - rodZ, P, 14), { tone: "hi", crease: "none" });
    move($("foot"), [x, y, tipZ]);

    // spec lamps, dependency flashes, placed tiles, ledger rows, coverage
    $$("lamp").forEach((el) => {
      const s = +el.dataset.s;
      let on = 0;
      EVENTS.forEach((e, i) => { if (TASKS[i].spec === s) on = Math.max(on, ss(u, e.stamp - 0.25, e.stamp) * (1 - ss(u, e.stamp + 0.3, e.stamp + 0.6))); });
      if (u < READ_END + 0.3) { const tRead = 0.8 + 0.9 + 1.6 * (s / 4); on = Math.max(on, ss(u, tRead - 0.3, tRead) * (1 - ss(u, tRead + 0.1, tRead + 0.5))); }
      show(el, on);
    });
    $$("placed").forEach((el) => { const i = +el.dataset.t - 1; show(el, u >= EVENTS[i].place ? 1 : 0); });
    $$("dep").forEach((el) => {
      const id = +el.dataset.t;
      let on = 0;
      EVENTS.forEach((e, i) => { if (TASKS[i].deps.includes(id)) on = Math.max(on, ss(u, e.approach, e.approach + 0.2) * (1 - ss(u, e.place, e.place + 0.3))); });
      show(el, on);
    });
    $$("row").forEach((el) => { const i = +el.dataset.t - 1; show(el, ss(u, EVENTS[i].place, EVENTS[i].place + 0.25)); });
    $$("peg").forEach((el) => { const n = +el.dataset.k; show(el, ss(u, PEGS + n * 0.15, PEGS + n * 0.15 + 0.2)); });
    $$("cover").forEach((el) => { const s = +el.dataset.s; show(el, ss(u, COVER + (s - 1) * 0.2, COVER + (s - 1) * 0.2 + 0.25)); });
    show($("version"), ss(u, VERSION, VERSION + 0.3));
  },
  say(u) {
    if (u < READ_END) return { readout: "reading specs \\u00b7 deps + acceptance criteria", phase: "read", aria: "Reading every spec, noting dependencies and acceptance criteria" };
    let cur = -1;
    EVENTS.forEach((e, i) => { if (u >= e.t0) cur = i; });
    if (u < CHECK && cur >= 0) {
      const t = TASKS[cur], e = EVENTS[cur];
      const id = "task-" + String(t.id).padStart(3, "0");
      const deps = t.deps.length ? " \\u00b7 needs " + t.deps.map((d) => String(d).padStart(3, "0")).join(", ") + " \\u2713" : " \\u00b7 no deps";
      const where = u < e.stamp ? " \\u00b7 from " + SPECS[t.spec] + ".md" : " \\u2192 " + SPRINTS[t.sprint].split(" ")[0] + "/backlog" + deps;
      return { readout: id + " " + t.name + where, phase: "task" + cur, aria: id + ", " + t.name + ", goes to " + SPRINTS[t.sprint] + (t.deps.length ? ", after tasks " + t.deps.join(" and ") : "") };
    }
    if (u < COVER) return { readout: "verify \\u00b7 .gitkeep in all 12 state folders", phase: "pegs", aria: "Every sprint gets backlog, in_progress, blocked and done folders, each with a .gitkeep" };
    if (u < VERSION) return { readout: "verify \\u00b7 every spec covered by a task", phase: "cover", aria: "Every feature and architecture spec is covered by at least one task" };
    return { readout: "PLAN.md v1 \\u00b7 3 sprints \\u00b7 9 tasks \\u00b7 0 forward deps", phase: "done", aria: "PLAN.md written: three sprints, nine tasks, no task depends on a later one" };
  },
};
${ENGINE}
`;

writePages(k, kitScript, {
  name: "plan",
  title: "av-swe plan",
  figure: svg,
  live,
  plate: {
    fig: "Fig 3",
    title: "av-swe plan",
    hint: "Hover to scrub the loading",
    readout: "reading specs \u00b7 deps + acceptance criteria",
    aria: "av-swe plan: hover or use the arrow keys to step through the tasks being planned",
    total: Math.round(TOTAL),
    keys: [
      { mark: "lit", label: "The tile on the quill: one small, testable task" },
      { mark: "raised", label: "Sprint trays: backlog, in_progress, blocked, done" },
      { mark: "flat", label: "PLAN.md ledger: one row per task" },
    ],
    caption:
      "plan turns specs into an ordered plan and never writes code. Each task is cut from the spec it covers and loaded bottom-up: foundation first, then architecture, then features and hardening, so the tasks a tile depends on (lit as it arrives) are always already in a tray. Sprints stay small (three to eight tasks) and each gets all four state folders. The plan is only done when every spec has a task, no task points forward, and PLAN.md lists them all.",
  },
});
