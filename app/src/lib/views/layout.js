// Map layout: where each folder and note sits, in layout units. Runs in a Web
// Worker (layout-worker.js) so the page stays responsive; the result is cached
// in this browser by what the map contains and the layout settings, so a
// reload places everything at once.

import * as d3 from "d3";
import { bake } from "./terrain.js";
import { outlines, routingGrid, routeAll } from "./contours.js";

export const SIZE = 1000; // layout units
// Bump when the algorithm changes, so cached layouts are not reused.
const VERSION = 3;
// The settings that change positions (the rest only change drawing).
export const LAYOUT_KEYS = ["room", "spread", "outward", "spacing", "margin", "north"];
const CACHE = "rdstudio.layout";

// What the layout needs from the map model, as plain data a worker can receive.
export function plainModel(model) {
  const strip = (n) => (n.kind === "dir"
    ? { kind: "dir", id: n.id, ref: n.ref, children: n.children.map(strip) }
    : { kind: n.kind, id: n.id, ref: n.ref, weight: n.weight, rank: n.rank || 0 });
  return { root: strip(model.root), edges: model.edges };
}

function hierarchy(root) {
  return d3.hierarchy(root, (d) => (d.kind === "dir" ? d.children : null))
    .sum((d) => (d.kind === "concept" ? d.weight : d.children.length ? 0 : 1));
}

// The quick starting arrangement (circle packing), with an index and colour
// groups: a usable map while the full layout is worked out.
export function start(modelRoot) {
  const root = hierarchy(modelRoot);
  d3.pack().size([SIZE, SIZE]).padding((d) => (d.depth === 0 ? 10 : 6))(root);
  const byId = new Map();
  root.each((n) => byId.set(n.data.id, n));
  const groups = [...new Set((root.children || []).map((c) => c.data.ref))].sort();
  root.each((n) => {
    const top = n.ancestors().reverse()[1];
    n.group = top ? (top.data.kind === "dir" ? groups.indexOf(top.data.ref) : -1) : -1;
  });
  return { root, byId };
}

// Positions as [x, y, r] per node, in the order root.each() visits them.
export function positions(root) {
  const out = [];
  root.each((n) => out.push(n.x, n.y, n.r));
  return Float64Array.from(out);
}

export function applyPositions(root, xyr) {
  let i = 0;
  root.each((n) => { n.x = xyr[i++]; n.y = xyr[i++]; n.r = xyr[i++]; });
}

// The full layout, from a plain model. Returns positions. `prev` holds where
// items sat in an earlier layout ({id: [x, y]}, relative to their folder's
// centre and radius), so a change of contents leaves the rest in place.
export function layoutPositions(model, o, prev = null) {
  const { root, byId } = start(model.root);
  arrange(root, byId, model.edges, o, prev);
  return positions(root);
}

// Where each item sits relative to its folder, from a layout: the `prev` of
// the next one.
export function relative(root) {
  const out = {};
  root.each((n) => { if (n.parent && n.parent.r) out[n.data.id] = [(n.x - n.parent.x) / n.parent.r, (n.y - n.parent.y) / n.parent.r]; });
  return out;
}

// Top down: give each folder's contents room, then spread them out evenly
// inside its wall, keeping linked items near each other and drawing items
// towards the side where their links leave the folder, and later in the study
// order further north.
function arrange(root, byId, edges, o, prev) {
  const leafEdges = edges.map(([a, b]) => [byId.get("c:" + a), byId.get("c:" + b)]).filter(([a, b]) => a && b);
  // A link matters only to the folders that contain one of its ends, so each
  // folder looks at those links alone (in their original order).
  const linksIn = new Map();
  for (const e of leafEdges) {
    const folders = new Set([...e[0].ancestors().slice(1), ...e[1].ancestors().slice(1)]);
    for (const f of folders) {
      if (!linksIn.has(f)) linksIn.set(f, []);
      linksIn.get(f).push(e);
    }
  }
  const moveTree = (n, dx, dy) => n.each((d) => { d.x += dx; d.y += dy; });
  const scaleTree = (n, k) => n.each((d) => { d.x = n.x + (d.x - n.x) * k; d.y = n.y + (d.y - n.y) * k; d.r *= k; });
  const childOf = (folder, n) => n.ancestors().find((a) => a.parent === folder);

  function place(folder) {
    const kids = folder.children;
    if (!kids) return;
    const unit = folder.r / (SIZE / 2); // settings are given for the whole map; scale them to this folder
    const inner = folder.depth ? folder.r - Math.min(o.margin * unit, folder.r * 0.25) : folder.r;
    const gap = o.spacing * unit;
    const area = kids.reduce((s, c) => s + c.r * c.r, 0) || 1;
    const k = Math.min(1, Math.sqrt((o.room * inner * inner) / area));
    for (const c of kids) {
      scaleTree(c, k);
      moveTree(c, folder.x + (c.x - folder.x) * (inner / folder.r) - c.x, folder.y + (c.y - folder.y) * (inner / folder.r) - c.y);
    }
    if (kids.length > 1) {
      // Items that were laid out before start where they were, so they stay put.
      const was = (c) => prev?.[c.data.id];
      const warm = kids.filter(was).length >= kids.length / 2;
      const nodes = kids.map((c) => {
        const at = warm && was(c);
        return { c, x: at ? at[0] * folder.r : c.x - folder.x, y: at ? at[1] * folder.r : c.y - folder.y, r: c.r, pull: [0, 0, 0] };
      });
      // North: each child's mean depth in the requires-chain, centred on the
      // folder's own and scaled to [-1, 1]; deeper (later) sits further north.
      if (o.north) {
        const rk = kids.map((c) => { const l = c.leaves(); return l.reduce((t, n) => t + (n.data.rank || 0), 0) / l.length; });
        const lo = Math.min(...rk), hi = Math.max(...rk), mid = (lo + hi) / 2, half = (hi - lo) / 2 || 1;
        nodes.forEach((nd, i) => { nd.rank = (rk[i] - mid) / half; });
      }
      const index = new Map(kids.map((c, i) => [c, i]));
      const links = [];
      for (const [u, v] of linksIn.get(folder) || []) {
        const cu = childOf(folder, u), cv = childOf(folder, v);
        if (cu && cv && cu !== cv) links.push({ source: index.get(cu), target: index.get(cv) });
        // A link leaving the folder pulls its end towards that side.
        for (const [inside, outside, other] of [[cu, cv, v], [cv, cu, u]]) {
          if (!inside || outside) continue;
          const dx = other.x - folder.x, dy = other.y - folder.y, d = Math.hypot(dx, dy) || 1;
          const pull = nodes[index.get(inside)].pull;
          pull[0] += dx / d; pull[1] += dy / d; pull[2] += 1;
        }
      }
      for (const nd of nodes) {
        if (nd.pull[2]) {
          const d = Math.hypot(nd.pull[0], nd.pull[1]) || 1;
          nd.tx = (nd.pull[0] / d) * inner * 0.7;
          nd.ty = (nd.pull[1] / d) * inner * 0.7;
        }
      }
      const sim = d3.forceSimulation(nodes).stop()
        .force("collide", d3.forceCollide((d) => d.r + gap / 2).strength(1).iterations(2))
        .force("charge", d3.forceManyBody().strength(-o.spread * inner * 0.15))
        .force("link", d3.forceLink(links).distance((l) => l.source.r + l.target.r + gap * 1.5).strength(0.04))
        .force("x", d3.forceX((d) => d.tx ?? 0).strength((d) => (d.tx !== undefined ? 0.04 * o.outward : 0.03)))
        .force("y", d3.forceY((d) => d.ty ?? 0).strength((d) => (d.ty !== undefined ? 0.04 * o.outward : 0.03)))
        .force("north", o.north ? d3.forceY((d) => -d.rank * inner * 0.55).strength(0.05 * o.north) : null);
      if (warm) sim.alpha(0.3); // settle from where they were, not from scratch
      const contain = () => {
        for (const nd of nodes) { // stay inside the wall
          const d = Math.hypot(nd.x, nd.y), max = Math.max(0, inner - nd.r - gap / 4);
          if (d > max) { nd.x *= max / d; nd.y *= max / d; }
        }
      };
      for (let i = 0; i < 240; i++) { sim.tick(); contain(); }
      // Finish by separating anything still overlapping, without other forces.
      for (let round = 0; round < 80; round++) {
        let moved = false;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j];
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, want = a.r + b.r + gap;
            if (d < want) {
              const push = (want - d) / 2;
              a.x -= (dx / d) * push; a.y -= (dy / d) * push;
              b.x += (dx / d) * push; b.y += (dy / d) * push;
              moved = true;
            }
          }
        }
        contain();
        if (!moved) break;
      }
      for (const nd of nodes) moveTree(nd.c, folder.x + nd.x - nd.c.x, folder.y + nd.y - nd.c.y);
    }
    kids.forEach(place);
  }
  place(root);
}

// ------------------------------------------------------------ cache

// cyrb53: a fast 53-bit string hash, plenty to tell layouts apart.
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function layoutKey(plain, o) {
  return hash(JSON.stringify([VERSION, LAYOUT_KEYS.map((k) => o[k]), plain]));
}

export function cached(key, count) {
  try {
    const hit = JSON.parse(localStorage.getItem(CACHE) || "null");
    return hit?.key === key && hit.xyr.length === count * 3 ? Float64Array.from(hit.xyr) : null;
  } catch {
    return null;
  }
}

export function remember(key, xyr, root) {
  try {
    const ids = [], parents = [], index = new Map();
    root.each((n) => { index.set(n, ids.length); ids.push(n.data.id); parents.push(n.parent ? index.get(n.parent) : -1); });
    localStorage.setItem(CACHE, JSON.stringify({ key, xyr: Array.from(xyr, (v) => Math.round(v * 1000) / 1000), ids, parents }));
  } catch { /* storage full or unavailable: lay out again next time */ }
}

// The last layout this browser kept, as a `prev` for the next one.
export function previous() {
  try {
    const hit = JSON.parse(localStorage.getItem(CACHE) || "null");
    if (!hit?.ids || !hit.parents) return null;
    const out = {};
    hit.ids.forEach((id, i) => {
      const p = hit.parents[i];
      if (p < 0) return;
      const r = hit.xyr[p * 3 + 2];
      if (r) out[id] = [(hit.xyr[i * 3] - hit.xyr[p * 3]) / r, (hit.xyr[i * 3 + 1] - hit.xyr[p * 3 + 1]) / r];
    });
    return out;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ worker

let worker = null, workerFailed = false, nextId = 0;
const waiting = new Map();

function getWorker() {
  if (worker || workerFailed) return worker;
  try {
    worker = new Worker(new URL("./layout-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const w = waiting.get(data.id);
      waiting.delete(data.id);
      if (!w) return;
      if (data.error) w.reject(new Error(data.error));
      else w.resolve(data.xyr ?? data.result);
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      workerFailed = true;
      worker = null;
      for (const w of waiting.values()) w.reject(new Error("layout worker failed"));
      waiting.clear();
    };
  } catch {
    workerFailed = true;
  }
  return worker;
}

// The full layout's positions, worked out off the main thread where possible.
export function computeLayout(plain, o, prev = null) {
  const settings = Object.fromEntries(LAYOUT_KEYS.map((k) => [k, o[k]]));
  return ask({ model: plain, o: settings, prev }, () => layoutPositions(plain, settings, prev));
}

// The terrain of some top-level folders (terrain.js), off the main thread.
export function computeTerrain(folders) {
  return ask({ terrain: folders }, () => folders.map(bake));
}

// Contour folders' outlines (contours.js), off the main thread.
export function computeOutlines(specs) {
  return ask({ outlines: specs }, () => outlines(specs));
}

// Downhill routes (contours.js), off the main thread. The grid is built once
// per key and kept (by the worker, or here).
let localGrid = null;
export function computeRoutes(key, input, asks) {
  return ask({ routes: { key, input, asks } }, () => {
    if (localGrid?.key !== key) localGrid = { key, grid: routingGrid(input) };
    return routeAll(localGrid.grid, asks);
  });
}

function ask(message, here) {
  const w = getWorker();
  if (!w) return Promise.resolve(here());
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    w.postMessage({ id, ...message });
  }).catch(() => here()); // no worker after all: do it here
}
