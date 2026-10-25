// Turn the live figures into animated SVGs that play inside a GitHub README <img> (no script, no GIF).
//   node docs/anatomy/export-svg.mjs [grill scope plan implement] [--fps 20]
//   -> docs/anatomy/svg/<name>-<dark|light>.svg and <name>-<dark|light>-still.svg
//
// A headless Chrome steps each page's own timeline and records what changes in every element the figure
// writes to (`data-p`). Every changing attribute becomes a native SVG animation (SMIL) on that element;
// an element whose children are rebuilt each frame keeps one copy of each shape it takes, and only the
// numbers inside it are animated. The geometry therefore comes from the same code as the interactive page.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HERE, loadKit } from "./common.mjs";
import { launch } from "./cdp.mjs";
import * as X from "./xml.mjs";

const args = process.argv.slice(2);
const FPS = Number(args[args.indexOf("--fps") + 1]) || 20;
const names = args.filter((arg) => /^[a-z]+$/.test(arg));
if (!names.length) names.push("grill", "scope", "plan", "implement");

const OUT = join(HERE, "svg");
mkdirSync(OUT, { recursive: true });

// ---- 1. capture ---------------------------------------------------------------------------------
const SETUP = `(() => {
  const A = window.__anatomy;
  const svg = document.querySelector(".iso-stage svg");
  const nodes = [svg.querySelector("[data-scene]"), ...svg.querySelectorAll("[data-p]")];
  nodes.forEach((el, i) => el.setAttribute("data-x", String(i)));
  const leaf = nodes.map((el) => !el.querySelector("[data-p]"));
  const prev = nodes.map(() => [null, null]);
  const readout = document.querySelector("[data-readout]");
  window.__snap = (u) => {
    A.frame(u);
    const changed = [];
    nodes.forEach((el, i) => {
      const attrs = JSON.stringify(Array.from(el.attributes, (a) => [a.name, a.value]).filter(([n]) => n !== "data-x"));
      const html = leaf[i] ? el.innerHTML : null;
      const row = [i, attrs === prev[i][0] ? null : attrs, html === prev[i][1] ? null : html];
      if (row[1] !== null || row[2] !== null) { prev[i] = [attrs, html]; changed.push(row); }
    });
    return { r: readout.textContent, f: A.fade(u), c: changed };
  };
  return { total: A.total, rest: A.rest, count: nodes.length };
})()`;
const META = `(() => {
  const svg = document.querySelector(".iso-stage svg");
  const corner = (name) => document.querySelector('[data-corner="' + name + '"]')?.textContent ?? "";
  return { viewBox: svg.getAttribute("viewBox"), label: svg.getAttribute("aria-label"), fig: corner("fig"), title: corner("title") };
})()`;

async function capture(chrome, name) {
  const page = await chrome.open(join(HERE, `${name}.html`), { reduced: true });
  await page.sleep(600);
  const info = await page.evaluate(SETUP);
  const frameCount = Math.ceil(info.total * FPS);
  const frames = [];
  const time = (f) => Math.min(f / FPS, info.total - 0.001);
  frames.push(await page.evaluate(`window.__snap(${time(0)})`));
  const base = await page.evaluate(`document.querySelector(".iso-stage svg").outerHTML`);
  for (let from = 1; from <= frameCount; from += 40) {
    const to = Math.min(frameCount, from + 39);
    const chunk = await page.evaluate(`(() => { const out = []; for (let f = ${from}; f <= ${to}; f++) out.push(window.__snap(Math.min(f / ${FPS}, ${info.total - 0.001}))); return out; })()`);
    frames.push(...chunk);
  }
  const meta = await page.evaluate(META);
  if (page.problems.length) console.warn(`  page problems: ${page.problems.join(" | ")}`);
  page.close();
  return { name, ...info, frameCount, frames, base, meta, times: frames.map((_, f) => Math.min(f / FPS, info.total) / info.total) };
}

// ---- 2. series -> animation ---------------------------------------------------------------------------
const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const skeleton = (d) => d.replace(NUM, "#");
const EPS = 3e-5;
const TOL = { opacity: 0.006, transform: 0.06, d: 0.12 };
const JUMP = 120; // a bigger step between two frames is a cut, not a motion

function vectorsOf(name, values) {
  if (values.some((v) => v === null || v === undefined)) return null;
  if (name === "transform") {
    const parts = values.map((v) => /^translate\(\s*(\S+)[\s,]+(\S+)\s*\)$/.exec(v));
    return parts.every(Boolean) ? parts.map((m) => [+m[1], +m[2]]) : null;
  }
  if (name === "d") {
    const shape = skeleton(values[0]);
    return values.every((v) => skeleton(v) === shape) ? values.map((v) => (v.match(NUM) ?? []).map(Number)) : null;
  }
  const numbers = values.map(Number);
  return numbers.every(Number.isFinite) && values.every((v) => v.trim() !== "") ? numbers.map((v) => [v]) : null;
}
const distance = (a, b) => a.reduce((worst, v, i) => Math.max(worst, Math.abs(v - b[i])), 0);

// Keep only the samples a straight line between neighbours cannot reproduce.
function simplify(samples, tol) {
  const keep = new Set([0, samples.length - 1]);
  const stack = [[0, samples.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const s = (samples[i].t - samples[a].t) / (samples[b].t - samples[a].t);
      const deviation = distance(samples[i].v, samples[a].v.map((v, k) => v + (samples[b].v[k] - v) * s));
      if (deviation > worst) { worst = deviation; at = i; }
    }
    if (worst > tol) {
      keep.add(at);
      stack.push([a, at], [at, b]);
    }
  }
  return samples.filter((_, i) => keep.has(i));
}

function trackOf(name, values, times, { discrete = false } = {}) {
  if (values.every((v) => v === values[0])) return null;
  const vec = discrete ? null : vectorsOf(name, values);
  if (vec) {
    const samples = [];
    values.forEach((s, f) => {
      if (f && name !== "opacity" && distance(vec[f], vec[f - 1]) > JUMP) samples.push({ t: times[f] - EPS, v: vec[f - 1], s: values[f - 1] });
      samples.push({ t: times[f], v: vec[f], s });
    });
    const kept = simplify(samples, TOL[name] ?? 0.06);
    return { calc: "linear", t: kept.map((k) => k.t), s: kept.map((k) => k.s) };
  }
  if (name === "transform") throw new Error(`transform not a translate: ${values.find((v) => !/^translate/.test(v ?? ""))}`);
  const t = [];
  const s = [];
  values.forEach((v, f) => {
    if (f === 0 || v !== values[f - 1]) { t.push(times[f]); s.push(v ?? ""); }
  });
  return { calc: "discrete", t, s };
}

const stamp = (t) => String(+t.toFixed(5));
function animation(name, track, dur) {
  const t = [];
  const s = [];
  track.t.forEach((time, i) => {
    if (t.length && +stamp(time) <= +t.at(-1)) return;
    t.push(stamp(time));
    s.push(track.s[i]);
  });
  const timing = [["dur", dur], ["repeatCount", "indefinite"], ["calcMode", track.calc], ["keyTimes", t.join(";")]];
  if (name === "transform") {
    const values = s.map((v) => /^translate\(\s*(\S+)[\s,]+(\S+)\s*\)$/.exec(v).slice(1, 3).join(" "));
    return { t: "animateTransform", a: [["attributeName", "transform"], ["type", "translate"], ["values", values.join(";")], ...timing], c: [] };
  }
  return { t: "animate", a: [["attributeName", name], ["values", s.join(";")], ...timing], c: [] };
}

// ---- 3. one figure -> a tree -------------------------------------------------------------------------------
const MASK = new Set(["d", "points", "cx", "cy", "r", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "rx", "ry", "transform", "opacity"]);
const KEEP_DATA = new Set(["data-tone", "data-shade", "data-lit", "data-seamless", "data-free", "data-dotted", "data-dashed", "data-flow", "data-pulse"]);
const shape = (nodes) => nodes.map((n) => (n.x !== undefined ? n.x : `<${n.t}${n.a.filter(([k]) => !MASK.has(k)).map(([k, v]) => ` ${k}=${v}`).join("")}>${shape(n.c)}</>`)).join("");

function fill(values) {
  const out = [...values];
  const first = out.find((v) => v !== null);
  let last = first;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === null) out[i] = last;
    else last = out[i];
  }
  return out;
}

function statesOf(cap) {
  const attrs = Array.from({ length: cap.count }, () => []);
  const html = Array.from({ length: cap.count }, () => []);
  const nowA = Array(cap.count).fill(null);
  const nowH = Array(cap.count).fill(null);
  cap.frames.forEach((frame, f) => {
    for (const [id, a, h] of frame.c) {
      if (a !== null) nowA[id] = Object.fromEntries(JSON.parse(a));
      if (h !== null) nowH[id] = h;
    }
    for (let id = 0; id < cap.count; id++) {
      attrs[id][f] = nowA[id];
      html[id][f] = nowH[id];
    }
  });
  return { attrs, html };
}

function cleaned(nodes) {
  for (const node of X.elements(nodes)) {
    node.a = node.a.filter(([k]) => !k.startsWith("data-") || KEEP_DATA.has(k));
  }
}

// moving = animated; otherwise the figure is frozen at frame `at`
function figure(cap, st, { at = null, report }) {
  const svg = X.parse(cap.base).c[0];
  const tracked = new Map();
  for (const el of X.elements(svg.c)) {
    const id = X.get(el, "data-x");
    if (id !== null) tracked.set(+id, el);
  }
  const dur = `${cap.total.toFixed(3)}s`;
  const times = cap.times;
  const spent = (id, nodes) => {
    const label = X.get(tracked.get(id), "data-p") ?? "scene";
    const group = label.replace(/-?[A-Z]?\d+$/, "").replace(/^(lo|up|cap|sb|sf)-.*/, "$1");
    report.set(group, (report.get(group) ?? 0) + nodes.reduce((sum, n) => sum + X.out(n).length, 0));
  };

  for (const [id, el] of tracked) {
    if (id === 0) {
      X.del(el, "style");
      if (at === null) {
        const track = trackOf("opacity", cap.frames.map((fr) => fr.f.toFixed(3)), times);
        if (track) { const node = animation("opacity", track, dur); el.c.push(node); spent(id, [node]); }
      }
      continue;
    }
    const attrsAt = st.attrs[id];
    if (at !== null) {
      const now = attrsAt[at];
      el.a = el.a.filter(([k]) => k.startsWith("data-") || k in now);
      for (const [k, v] of Object.entries(now)) X.set(el, k, v);
      if (st.html[id][at] !== null) el.c = X.parse(st.html[id][at]).c;
      continue;
    }
    const names = new Set(attrsAt.flatMap((a) => Object.keys(a)));
    let htmlAt = st.html[id];
    let wrapper = null;
    // a path whose shape changes becomes a group of path copies, so it gets the same cheapest-form choice
    if (htmlAt.every((h) => h === null || h === "") && names.has("d")) {
      const shapes = attrsAt.map((a) => a.d ?? null);
      if (shapes.every((d) => d !== null) && new Set(shapes).size > 1) {
        wrapper = new Set(["opacity", "transform"]);
        const proto = el.a.filter(([k]) => !wrapper.has(k) && !k.startsWith("data-x") && k !== "d");
        const cache = new Map();
        htmlAt = shapes.map((d) => {
          if (!cache.has(d)) cache.set(d, X.out({ t: el.t, a: [...proto, ["d", d]], c: [] }));
          return cache.get(d);
        });
        el.t = "g";
        el.a = el.a.filter(([k]) => wrapper.has(k) || k === "data-p" || k === "data-x");
      }
    }
    // rebuilt children first, so the animations below are not wiped when the children are replaced
    if (htmlAt[0] !== null) container(el, htmlAt, times, dur, (nodes) => spent(id, nodes), id);
    // the element's own attributes
    for (const name of names) {
      if (name === "class" || (wrapper && !wrapper.has(name))) continue;
      let values = attrsAt.map((a) => a[name] ?? null);
      if (values.some((v) => v === null)) {
        const absent = { opacity: "1", transform: "translate(0 0)" }[name]; // what the browser assumes when the attribute is missing
        if (absent === undefined) continue;
        values = values.map((v) => v ?? absent);
      }
      const track = trackOf(name, values, times);
      if (!track) continue;
      const node = animation(name, track, dur);
      el.c.push(node);
      spent(id, [node]);
    }
  }
  cleaned(svg.c);
  return svg.c;
}

// An element whose children are rewritten each frame. Two ways to draw it, and the smaller file wins:
//   groups: one copy per shape skeleton, with the numbers inside it animated;
//   swap:   one static copy per distinct drawing, shown at the frames where it applies.
// Repeating strokes (a plunger pressed again and again) give few distinct drawings, so swap is cheap there.
function container(el, htmlAt, times, dur, spent, id) {
  const distinct = [...new Set(htmlAt)];
  if (distinct.length === 1) { el.c = X.parse(distinct[0]).c; return; }
  const size = (nodes) => nodes.reduce((sum, n) => sum + X.out(n).length, 0);
  const grouped = groupsOf(htmlAt, distinct, times, dur);
  const swapped = distinct.length <= 600 ? swapOf(htmlAt, distinct, times, dur) : null;
  const useSwap = swapped && size(swapped) < size(grouped);
  el.c = useSwap ? swapped : grouped;
  spent(el.c);
  if (process.env.DEBUG) console.log(`    #${id} ${X.get(el, "data-p") ?? el.t}: ${distinct.length} drawings, groups ${(size(grouped) / 1024).toFixed(1)}KB, swap ${swapped ? (size(swapped) / 1024).toFixed(1) + "KB" : "-"} -> ${useSwap ? "swap" : "groups"}`);
}

function swapOf(htmlAt, distinct, times, dur) {
  const holders = [];
  for (const html of distinct) {
    if (html === "") continue;
    const flags = htmlAt.map((h) => (h === html ? "1" : "0"));
    const holder = { t: "g", a: [["opacity", flags[0]]], c: X.parse(html).c };
    holder.c.push(animation("opacity", trackOf("opacity", flags, times, { discrete: true }), dur));
    holders.push(holder);
  }
  return holders;
}

function groupsOf(htmlAt, distinct, times, dur) {
  const info = new Map();
  for (const html of distinct) {
    const forest = X.parse(html);
    info.set(html, { forest, els: X.elements(forest.c), sig: shape(forest.c) });
  }
  const groups = new Map();
  htmlAt.forEach((html, f) => {
    if (html === "") return;
    const { sig } = info.get(html);
    if (!groups.has(sig)) groups.set(sig, { first: info.get(html), active: Array(htmlAt.length).fill(false) });
    groups.get(sig).active[f] = true;
  });
  const holders = [];
  for (const group of groups.values()) {
    const holder = { t: "g", a: [], c: group.first.forest.c };
    holders.push(holder);
    group.first.els.forEach((target, e) => {
      for (const [name] of target.a.filter(([k]) => MASK.has(k))) {
        const values = fill(htmlAt.map((html, f) => (group.active[f] ? X.get(info.get(html).els[e], name) : null)));
        const track = trackOf(name, values, times);
        if (track) target.c.push(animation(name, track, dur));
      }
    });
    if (!group.active.every(Boolean)) {
      const shown = group.active.map((on) => (on ? "1" : "0"));
      X.set(holder, "opacity", shown[0]);
      holder.c.push(animation("opacity", trackOf("opacity", shown, times, { discrete: true }), dur));
    }
  }
  return holders;
}

// ---- 4. the card ------------------------------------------------------------------------------------------
const xmlText = (s) => X.escapeText(s);
function page(cap, theme, children, { isoCss, still }) {
  const [, , vw, vh] = cap.meta.viewBox.split(" ").map(Number);
  const W = vw + 48;
  const H = vh + 104;
  const dur = `${cap.total.toFixed(3)}s`;
  const readouts = [];
  const lines = cap.frames.map((fr) => fr.r);
  const show = still === null ? [...new Set(lines)] : [lines[still]];
  for (const line of show) {
    const text = { t: "text", a: [["class", "c r"], ["x", W - 20], ["y", H - 20], ["text-anchor", "end"]], c: [{ x: xmlText(line) }] };
    if (still === null && show.length > 1) {
      const flags = lines.map((l) => (l === line ? "visible" : "hidden"));
      X.set(text, "visibility", flags[0]);
      text.c.push(animation("visibility", trackOf("visibility", flags, cap.times), dur));
    }
    readouts.push(text);
  }
  const css = `${isoCss}
.c{font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.04em;fill:var(--anatomy-muted)}
.f{fill:var(--anatomy-text)}.t{letter-spacing:.1em}.r{fill:var(--anatomy-text)}`;
  const body = [
    `<style>${css}</style>`,
    `<rect width="${W}" height="${H}" fill="var(--anatomy-card)"/>`,
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" fill="none" stroke="var(--anatomy-mid)"/>`,
    `<text class="c f" x="20" y="27">${xmlText(cap.meta.fig)}</text>`,
    `<text class="c t" x="${W - 20}" y="27" text-anchor="end">${xmlText(cap.meta.title.toUpperCase())}</text>`,
    `<g transform="translate(24 52)">${children.map(X.out).join("")}</g>`,
    readouts.map(X.out).join(""),
  ].join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg iso" data-theme="${theme}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${cap.meta.label.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}">${body}</svg>`;
  return svg.replace(/&nbsp;/g, "&#160;");
}

// ---- 5. run ---------------------------------------------------------------------------------------------------
const { k } = await loadKit();
const chrome = await launch();
const kb = (text) => `${(Buffer.byteLength(text) / 1024).toFixed(0)} KB`;
try {
  for (const name of names) {
    console.log(`${name}`);
    const cap = await capture(chrome, name);
    console.log(`  ${cap.frames.length} frames over ${cap.total.toFixed(1)} s at ${FPS} fps, ${cap.count} animated elements`);
    const st = statesOf(cap);
    const rest = Math.min(cap.frames.length - 1, Math.round(cap.rest * FPS));
    for (const theme of ["dark", "light"]) {
      const report = new Map();
      const moving = page(cap, theme, figure(cap, st, { report }), { isoCss: k.ISO_CSS, still: null });
      const frozen = page(cap, theme, figure(cap, st, { at: rest, report: new Map() }), { isoCss: k.ISO_CSS, still: rest });
      writeFileSync(join(OUT, `${name}-${theme}.svg`), moving);
      writeFileSync(join(OUT, `${name}-${theme}-still.svg`), frozen);
      console.log(`  ${theme}: ${kb(moving)} animated, ${kb(frozen)} still`);
      if (theme === "dark") {
        const top = [...report].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, bytes]) => `${label} ${(bytes / 1024).toFixed(0)}KB`);
        console.log(`  by part: ${top.join(", ")}`);
      }
    }
  }
} finally {
  chrome.close();
}

