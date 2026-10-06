// The Atlas's layout and routes, worked out in a Web Worker
// (layout-worker.js) so the page stays responsive. A layout is kept in this
// browser by what the map contains, so a reload places everything at once.

import { nestedLayout } from "./grid/nested.js";
import { buildCells } from "./grid/cells.js";
import { makeRouter, lanes, routeAll as gridRouteAll } from "./grid/router.js";

// What the layout needs from the map model, as plain data a worker can receive.
// `flat`: the folderless view (T71): every note an item of one folder, the root, so the whole base is one DAG.
export function plainModel(model, flat = false) {
  const strip = (n) => (n.kind === "dir"
    ? { kind: "dir", id: n.id, ref: n.ref, children: n.children.map(strip) }
    : { kind: n.kind, id: n.id, ref: n.ref, weight: n.weight, rank: n.rank || 0 });
  if (flat) {
    const notes = [];
    const walk = (n) => { if (n.kind === "dir") n.children.forEach(walk); else notes.push(strip(n)); };
    walk(model.root);
    return { root: { kind: "dir", id: model.root.id, ref: model.root.ref, children: notes }, edges: model.edges, code: false };
  }
  return { root: strip(model.root), edges: model.edges, code: !!model.code };
}

// The grid Atlas's layout (grid/nested.js, which says what one is): each
// folder a layered DAG of its items, and one item in its parent's. `gridFlow`
// is the top level's direction, "up" or "right".
export function gridLayout(model, o) {
  const layout = nestedLayout(model, { flow: o.gridFlow === "right" ? "right" : "up" });
  layout.feeders = feeders(layout);
  return layout;
}

// Feeders (T72): where a trunk ends on a folder, what is in the folder that the trunk's links come from.
// From each of the folder's items holding an end of one of those links, a branch runs to the trunk's foot,
// the cell just inside the wall where the trunk arrives, with the number of links it carries. Branches to
// one foot join: subfolders are routed first, the one with the most links before the rest, and each one
// after may stop on a branch already there. A branch from a subfolder is itself fed, from inside it, in
// the same way. Only the branches from subfolders are drawn at rest (a branch from every note is too
// much); those from notes (`leaf`) are kept so that a link can be traced the whole way, note to note,
// along its trunk. A note's branch may join any branch; a subfolder's only another subfolder's.
//   [{ item, folder, trunk, count, pts, lane, leaf, via }]: the item fed from, the folder it is in, the
//   trunk fed (an index into `trunks`), the links carried, the path in cells from the item's edge, whether
//   the item is a note, and the feeder whose branch this one ends on (its index, or -1 at the foot).
export function feeders(layout) {
  const { items, links, trunks, W } = layout;
  if (!trunks.some((t) => t.pts && (items[t.a].kind === "folder" || items[t.b].kind === "folder"))) return [];
  const cells = buildCells(layout), router = makeRouter(layout, cells, { crowd: 1 });
  for (const t of trunks) if (t.pts) router.occupy(t.pts);
  const childIn = (i, f) => { while (items[i].parent !== f) i = items[i].parent; return i; }; // the item of folder f that holds i
  const foot = (f, [x, y]) => { // the cell just inside f's wall at a point on the wall
    const F = items[f], near = (p, q) => Math.abs(p - q) < 1e-6;
    return near(x, F.gx) ? [F.gx, Math.floor(y)] : near(x, F.gx + F.w) ? [F.gx + F.w - 1, Math.floor(y)] : near(y, F.gy) ? [Math.floor(x), F.gy] : [Math.floor(x), F.gy + F.h - 1];
  };
  // Each end of a drawn trunk that is a folder is a stem to feed: the notes in the folder that its links end on.
  const stems = [];
  trunks.forEach((t, k) => {
    if (!t.pts) return;
    const level = items[t.a].parent, mine = links.filter((l) => l.s >= 2 && l.level === level && childIn(l.a, level) === t.a && childIn(l.b, level) === t.b);
    if (items[t.a].kind === "folder") stems.push({ folder: t.a, at: t.pts[t.pts.length - 1], notes: mine.map((l) => l.a), trunk: k });
    if (items[t.b].kind === "folder") stems.push({ folder: t.b, at: t.pts[0], notes: mine.map((l) => l.b), trunk: k });
  });
  const out = [];
  for (let s = 0; s < stems.length; s++) {
    const { folder, at, notes, trunk } = stems[s];
    const [fx, fy] = foot(folder, at);
    if (fx < 0 || fy < 0 || fx >= W || cells.blocked[fy * W + fx]) continue;
    const by = new Map();
    for (const n of notes) { const c = childIn(n, folder); by.set(c, [...(by.get(c) || []), n]); }
    const footCell = fy * W + fx, isNote = (i) => items[i].kind === "note";
    const ends = new Map([[footCell, [footCell, at[0], at[1]]]]), endsAny = new Map(ends), owner = new Map([[footCell, -1]]);
    for (const [item, held] of [...by].sort((a, b) => isNote(a[0]) - isNote(b[0]) || b[1].length - a[1].length || a[0] - b[0])) {
      const leaf = isNote(item), r = router.routeTo(item, { ends: leaf ? endsAny : ends, folder });
      if (!r) continue;
      const me = out.length;
      out.push({ item, folder, trunk, count: held.length, pts: r.pts, cells: r.cells, leaf, via: owner.get(r.cells[r.cells.length - 1]) ?? -1 });
      for (const c of r.cells) {
        if (endsAny.has(c)) continue;
        const end = [c, (c % W) + 0.5, Math.floor(c / W) + 0.5];
        endsAny.set(c, end); owner.set(c, me);
        if (!leaf) ends.set(c, end);
      }
      if (!leaf) stems.push({ folder: item, at: r.pts[0], notes: held, trunk });
    }
  }
  lanes(out, cells.W * cells.H);
  return out.map(({ item, folder, trunk, count, pts, lane, leaf, via }) => ({ item, folder, trunk, count, pts, lane, leaf, via }));
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
const GRID_CACHE = "rdstudio.gridlayout", GRID_VERSION = 10; // bump whenever the grid layout changes what it returns, or browsers keep the old one
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
