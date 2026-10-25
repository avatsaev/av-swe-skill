// Compare an exported SVG with the live page at the same instants.
//   node docs/anatomy/verify-svg.mjs grill dark 3 9.5 14 [--png /tmp/shots]
// Prints the mean and worst-pixel difference between the two renderings of the figure area.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { HERE } from "./common.mjs";
import { launch } from "./cdp.mjs";

const args = process.argv.slice(2);
const dir = args.includes("--png") ? args[args.indexOf("--png") + 1] : null;
const [name, theme, ...rest] = args.filter((arg, i) => arg !== "--png" && args[i - 1] !== "--png");
const times = rest.map(Number);

const chrome = await launch();
try {
  const livePage = await chrome.open(join(HERE, theme === "light" ? `${name}-light.html` : `${name}.html`), { reduced: true, width: 840, height: 1200 });
  await livePage.sleep(600);
  const svgPath = join(HERE, "svg", `${name}-${theme}.svg`);
  const svgPage = await chrome.open(svgPath, { width: 808, height: 600 });
  const size = await svgPage.evaluate(`(() => { const r = document.documentElement.getBoundingClientRect(); return [r.width, r.height]; })()`);
  await svgPage.evaluate(`document.documentElement.pauseAnimations()`);
  await chrome.open("about:blank").then(async (tab) => {
    const box = await livePage.evaluate(`(() => { const r = document.querySelector(".iso-stage svg").getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height }; })()`);
    console.log(`${name} ${theme}: figure ${box.width.toFixed(0)}x${box.height.toFixed(0)}, svg card ${size.map((v) => v.toFixed(0)).join("x")}`);
    for (const u of times) {
      await livePage.evaluate(`window.__anatomy.frame(${u})`);
      const live = await livePage.shot({ x: box.x, y: box.y, width: box.width, height: box.height });
      await svgPage.evaluate(`document.documentElement.setCurrentTime(${u})`);
      const drawn = await svgPage.shot({ x: 24, y: 52, width: box.width, height: box.height });
      if (dir) {
        writeFileSync(join(dir, `v-${name}-${theme}-${u}-live.png`), live);
        writeFileSync(join(dir, `v-${name}-${theme}-${u}-svg.png`), drawn);
      }
      const result = await tab.evaluate(`(async () => {
        const load = (b64) => new Promise((done) => { const img = new Image(); img.onload = () => done(img); img.src = "data:image/png;base64," + b64; });
        const [a, b] = await Promise.all([load(${JSON.stringify(live.toString("base64"))}), load(${JSON.stringify(drawn.toString("base64"))})]);
        const draw = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
        const p = draw(a), q = draw(b);
        let sum = 0, over = 0, worst = 0;
        const out = document.createElement("canvas"); out.width = a.width; out.height = a.height;
        const oc = out.getContext("2d"), od = oc.createImageData(a.width, a.height);
        for (let i = 0; i < p.length; i += 4) { const d = Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2])); sum += d; if (d > 40) over++; if (d > worst) worst = d; const v = Math.min(255, d * 4); od.data[i] = v; od.data[i + 1] = v; od.data[i + 2] = v; od.data[i + 3] = 255; }
        oc.putImageData(od, 0, 0);
        return { mean: sum / (p.length / 4), over: over / (p.length / 4), worst, w: a.width, h: a.height, w2: b.width, h2: b.height, diff: out.toDataURL("image/png").split(",")[1] };
      })()`);
      if (dir) writeFileSync(join(dir, `v-${name}-${theme}-${u}-diff.png`), Buffer.from(result.diff, "base64"));
      console.log(`  t=${u}s  mean ${result.mean.toFixed(2)}  pixels off by >40: ${(result.over * 100).toFixed(2)}%  worst ${result.worst}  (${result.w}x${result.h} vs ${result.w2}x${result.h2})`);
    }
    tab.close();
  });
  livePage.close();
  svgPage.close();
} finally {
  chrome.close();
}
