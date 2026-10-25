// Shared pieces for the three av-swe anatomy figures (grill, scope, plan).
// The isometric kit comes from the `anatomy` agent skill. Point ANATOMY_DIR at it
// if it is not in the default place.
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const SKILL = process.env.ANATOMY_DIR ?? join(homedir(), ".agents", "skills", "anatomy");

export async function loadKit() {
  const k = await import(join(SKILL, "kit", "iso-kit.mjs"));
  const { kitScript } = await import(join(SKILL, "scripts", "inline-kit.mjs"));
  return { k, kitScript };
}

// A vertical coil spring between z0 (bottom) and z1 (top), split into the half that
// is behind the rod and the half in front, so it can be painted around it.
// Pure: takes `iso` ([x,y,z] -> [sx,sy]) and `view` (the floor direction to the viewer).
export function helixOf(iso, view, cx, cy, z0, z1, r, turns, perTurn = 14) {
  const count = Math.max(2, Math.round(turns * perTurn));
  const back = [];
  const front = [];
  let run = [];
  let near = null;
  const text = (points) => points.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join("");
  for (let i = 0; i <= count; i++) {
    const share = i / count;
    const angle = share * turns * Math.PI * 2;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const facing = nx * view[0] + ny * view[1] > 0;
    const flat = iso([cx + r * nx, cy + r * ny, z0 + (z1 - z0) * share]);
    if (near === null) near = facing;
    if (facing !== near) {
      run.push(flat);
      (near ? front : back).push(text(run));
      run = [flat];
      near = facing;
      continue;
    }
    run.push(flat);
  }
  if (run.length > 1) (near ? front : back).push(text(run));
  return { back: back.join(""), front: front.join("") };
}

// The live loop every figure shares. A figure supplies `FIGURE = { total, rest, steps, render(t), say(t) }`
// and the engine drives it: an idle tour that loops, pointer scrubbing, keys, reduced motion.
export const HELPERS = `
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const scene = svg.querySelector("[data-scene]");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const sm = (x) => x * x * (3 - 2 * x);
const ss = (t, a, b) => sm(seg(t, a, b));
const lerp = (a, b, x) => a + (b - a) * x;
const cache = new Map();
const $ = (name) => { if (!cache.has(name)) cache.set(name, svg.querySelector('[data-p="' + name + '"]')); return cache.get(name); };
const $$ = (name) => { const key = "*" + name; if (!cache.has(key)) cache.set(key, [...svg.querySelectorAll('[data-p="' + name + '"]')]); return cache.get(key); };
const move = (el, by) => el.setAttribute("transform", translateAlong(P, by));
const show = (el, alpha) => { const v = alpha <= 0.004 ? "0" : alpha >= 0.996 ? "1" : alpha.toFixed(3); if (el.getAttribute("opacity") !== v) el.setAttribute("opacity", v); };
const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
const view = () => towardViewer(P);
const at = (p) => iso(p, P);
const solid = (el, paths, style) => { el.innerHTML = solidSvg(paths, style); };
const spring = (back, front, cx, cy, z0, z1, r, turns) => {
  const h = helixOf(at, view(), cx, cy, z0, z1, r, turns);
  back.setAttribute("d", h.back); front.setAttribute("d", h.front);
};
const bezier = (a, b, c, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const s = i / n, u = 1 - s; return [0, 1, 2].map((j) => u * u * a[j] + 2 * u * s * b[j] + s * s * c[j]); });
`;

export const ENGINE = `
const FIG = FIGURE;
const total = FIG.total;
let t = still.matches ? FIG.rest : 0, target = t, mode = still.matches ? "scrub" : "tour";
let frame = 0, last = 0, visible = false, idleTimer = 0, dirty = true, phaseKey = "";
const fadeAt = (u) => 0.25 + 0.75 * Math.min(ss(u, 0, 0.7), 1 - ss(u, total - 0.7, total));

function draw() {
  FIG.render(t);
  scene.style.opacity = still.matches ? "1" : fadeAt(t).toFixed(3);
  const say = FIG.say(t);
  text(readout, say.readout);
  if (say.phase !== phaseKey) { phaseKey = say.phase; stage.setAttribute("aria-valuetext", say.aria); }
  stage.setAttribute("aria-valuenow", String(Math.round(t)));
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (mode === "tour") {
    target += dt;
    if (target >= total) target = 0;
    t = target;
  } else {
    t = still.matches ? target : t + (target - t) * (1 - Math.exp(-dt / 0.14));
    if (Math.abs(target - t) < 0.002) t = target;
  }
  draw();
  dirty = false;
  const settled = mode !== "tour" && t === target;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const hold = () => { mode = "scrub"; clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (!still.matches) { mode = "tour"; target = t; run(); } }, 3600); };
const aim = (value) => { hold(); target = Math.min(total - 0.01, Math.max(0, value)); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  aim(clamp01(((event.clientX - box.left) / box.width - 0.1) / 0.8) * total);
});
stage.addEventListener("pointerleave", () => { hold(); });
stage.addEventListener("keydown", (event) => {
  const steps = FIG.steps;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = steps.find((s) => s > target + 0.05) ?? steps[steps.length - 1];
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = [...steps].reverse().find((s) => s < target - 0.05) ?? 0;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = steps[steps.length - 1];
  if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (mode === "tour") { hold(); clearTimeout(idleTimer); target = t; } else { mode = "tour"; clearTimeout(idleTimer); run(); } return; }
  if (to === null) return;
  event.preventDefault();
  aim(to);
});
// Used by export-svg.mjs: step the figure to any time and read what the card would show.
window.__anatomy = { total, rest: FIG.rest, fade: fadeAt, frame(u) { t = target = u; draw(); } };
draw();
if (mode === "tour") run();
`;

// Build one page per theme. `figure` is the kit's figure svg string; `live` the figure's own script.
export function writePages(k, kitScript, { name, title, plate, figure, live, helpers = "", width = 820 }) {
  for (const theme of ["dark", "light"]) {
    const body = k.plateHtml({
      ...plate,
      body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="${plate.aria}" aria-valuemin="0" aria-valuemax="${plate.total}" aria-valuenow="0">${figure}</div>`,
    });
    const script = kitScript() + "\n" + `const helixOf = ${helixOf.toString()};\n` + HELPERS + "\n" + helpers + "\n" + live;
    const file = join(HERE, theme === "light" ? `${name}-light.html` : `${name}.html`);
    writeFileSync(file, k.pageHtml({ title, theme, body, script, width }));
    console.log("wrote", file);
  }
}
