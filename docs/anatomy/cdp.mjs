// A small headless-Chrome driver for the exporter and its checks. Set CHROME_PATH to a Chrome or Chromium binary.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { SKILL } from "./common.mjs";

const { chromePort } = await import(join(SKILL, "scripts", "chrome-port.mjs"));

function chromeBinary() {
  const found = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((path) => path && existsSync(path));
  if (!found) throw new Error("No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.");
  return found;
}

export async function launch() {
  const profile = mkdtempSync(join(tmpdir(), "anatomy-cdp-"));
  const chrome = spawn(chromeBinary(), ["--headless=new", ...(process.platform === "linux" ? ["--no-sandbox"] : []), "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--allow-file-access-from-files", "about:blank"]);
  const port = await chromePort(chrome, profile);

  async function open(target, { width = 1000, height = 800, scale = 1, reduced = false, scheme = null } = {}) {
    const url = /^(https?:|file:|about:)/.test(target) ? target : pathToFileURL(target).href;
    const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    const socket = new WebSocket(tab.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const problems = [];
    let loaded = () => {};
    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.method === "Page.loadEventFired") loaded();
      else if (data.method === "Runtime.exceptionThrown") problems.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text);
      else if (data.method === "Runtime.consoleAPICalled" && data.params.type === "error") problems.push(data.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data);
        pending.delete(data.id);
      }
    };
    await new Promise((done) => (socket.onopen = done));
    const send = (method, params = {}) =>
      new Promise((done, fail) => {
        const call = ++id;
        pending.set(call, (data) => (data.error ? fail(new Error(`${method}: ${data.error.message}`)) : done(data.result)));
        socket.send(JSON.stringify({ id: call, method, params }));
      });
    await send("Runtime.enable");
    await send("Page.enable");
    const features = [...(reduced ? [{ name: "prefers-reduced-motion", value: "reduce" }] : []), ...(scheme ? [{ name: "prefers-color-scheme", value: scheme }] : [])];
    if (features.length) await send("Emulation.setEmulatedMedia", { features });
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
    const load = new Promise((done) => {
      loaded = done;
      setTimeout(done, 10000);
    });
    await send("Page.navigate", { url });
    await load;
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    };
    return {
      evaluate,
      problems,
      sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
      async shot(clip) {
        const result = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
        return Buffer.from(result.data, "base64");
      },
      close: () => socket.close(),
    };
  }

  return {
    open,
    close() {
      chrome.kill("SIGKILL");
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };
}
