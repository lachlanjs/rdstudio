// The Atlas's layout and routes, worked out in a Web Worker
// (layout-worker.js) so the page stays responsive. A layout is kept in this
// browser by what the map contains, so a reload places everything at once.

import { nestedLayout } from "./grid/nested.js";
import { buildCells } from "./grid/cells.js";
import { makeRouter, routeAll as gridRouteAll } from "./grid/router.js";

// What the layout needs from the map model, as plain data a worker can receive.
export function plainModel(model) {
  const strip = (n) => (n.kind === "dir"
    ? { kind: "dir", id: n.id, ref: n.ref, children: n.children.map(strip) }
    : { kind: n.kind, id: n.id, ref: n.ref, weight: n.weight, rank: n.rank || 0 });
  return { root: strip(model.root), edges: model.edges };
}

// The grid Atlas's layout (grid/nested.js, which says what one is): each
// folder a layered DAG of its items, and one item in its parent's. `gridFlow`
// is the top level's direction, "up" or "right".
export function gridLayout(model, o) {
  return nestedLayout(model, { flow: o.gridFlow === "right" ? "right" : "up" });
}

// Routes over a grid layout's cells (grid/router.js). The cells and the
// router's arrays are made once per layout and kept.
export function gridRouter(layout) {
  const cells = buildCells(layout), router = makeRouter(layout, cells);
  return (asks) => gridRouteAll(router, asks, cells.W, cells.H);
}

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

// One is kept for each direction of flow, so turning a phone finds its map
// ready. The key is what the map contains and the direction: none of the
// continuous layout's settings move anything on the grid.
const GRID_CACHE = "rdstudio.gridlayout", GRID_VERSION = 6; // bump whenever the grid layout changes what it returns, or browsers keep the old one
const slot = (o) => GRID_CACHE + (o.gridFlow === "right" ? ".right" : "");
export function gridKey(plain, o) {
  return hash(JSON.stringify([GRID_VERSION, o.gridFlow === "right" ? "right" : "up", plain]));
}
export function cachedGrid(key, o) {
  try {
    const hit = JSON.parse(localStorage.getItem(slot(o)) || "null");
    return hit?.key === key ? hit.layout : null;
  } catch {
    return null;
  }
}
export function computeGrid(key, plain, o) {
  const settings = { gridFlow: o.gridFlow };
  return ask({ grid: { model: plain, o: settings } }, () => gridLayout(plain, settings)).then((layout) => {
    try { localStorage.setItem(slot(o), JSON.stringify({ key, layout })); } catch { /* storage full or unavailable: lay out again next time */ }
    return layout;
  });
}

// Routes on a grid layout (grid/router.js), off the main thread. The router is
// built once per key and kept (by the worker, or here).
// The layout is sent to the worker once for each key, not with every ask.
let localRouter = null, sentKey = null;
export function computeGridRoutes(key, layout, asks) {
  const first = sentKey !== key;
  sentKey = key;
  return ask({ gridRoutes: { key, layout: first ? layout : null, asks } }, () => {
    if (localRouter?.key !== key) localRouter = { key, run: gridRouter(layout) };
    return localRouter.run(asks);
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
