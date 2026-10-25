// A tiny parser and serializer for the SVG the kit writes: well-formed, no CDATA, no entities beyond
// the five XML ones. Attribute values stay in their escaped form, so what goes in comes out unchanged.

const ATTR = /([^\s=\/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
const TOKEN = /<!--[\s\S]*?-->|<\/([^\s>]+)\s*>|<([^\s\/>]+)((?:\s+[^\s=\/>"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|([^<]+)/g;

export function parse(source) {
  const root = { t: "#root", a: [], c: [] };
  const stack = [root];
  TOKEN.lastIndex = 0;
  for (let match; (match = TOKEN.exec(source)); ) {
    if (match[0].startsWith("<!--")) continue;
    if (match[1]) {
      stack.pop();
    } else if (match[2]) {
      const node = { t: match[2], a: [], c: [] };
      ATTR.lastIndex = 0;
      for (let attr; (attr = ATTR.exec(match[3])); ) node.a.push([attr[1], attr[2] ?? attr[3] ?? ""]);
      stack.at(-1).c.push(node);
      if (!match[4]) stack.push(node);
    } else if (match[5] !== undefined) {
      stack.at(-1).c.push({ x: match[5] });
    }
  }
  return root;
}

export const get = (node, name) => node.a.find(([key]) => key === name)?.[1] ?? null;
export function set(node, name, value) {
  const found = node.a.find(([key]) => key === name);
  if (found) found[1] = value;
  else node.a.push([name, value]);
}
export const del = (node, name) => { node.a = node.a.filter(([key]) => key !== name); };

export function out(node) {
  if (node.x !== undefined) return node.x;
  const attrs = node.a.map(([key, value]) => ` ${key}="${value}"`).join("");
  return node.c.length ? `<${node.t}${attrs}>${node.c.map(out).join("")}</${node.t}>` : `<${node.t}${attrs}/>`;
}

export function elements(nodes, into = []) {
  for (const node of nodes) {
    if (node.x !== undefined) continue;
    into.push(node);
    elements(node.c, into);
  }
  return into;
}

export const escapeText = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
