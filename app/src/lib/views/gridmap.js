// The grid Atlas (T62, T64): everything on a coarse square grid. Notes are
// blocks of cells. Each folder is laid out in layers by what requires what,
// and is one block in its parent's layout; its title sits on its top edge.
// Links between two items of a folder are a trunk with a count, drawn on a
// path of the layout's own. Pointing at a note lights what it depends on.
// Where you stand is tone and fill.
//
// The layout (grid/nested.js says what one is) is worked out in the layout
// worker, in cells, with the few routes it leaves to the router
// (grid/router.js); every zoom frame only places them on the screen and
// decides what is open. It is chosen with `folders = "grid"` and sits beside
// the continuous Atlas (map.js) until it does everything that one does (T63).

import * as d3 from "d3";
import { learner, store } from "../data.svelte.ts";
import { conceptHref, trustState, TRUST_LABEL } from "../format.ts";
import { measure, timed } from "../perf.ts";
import { h } from "./dom.js";
import { actions } from "../actions.svelte.ts";
import { editing } from "../edit.svelte.ts";
import { understanding } from "../understanding.svelte.ts";
import { exerciseNotes, statusOf, testsOf, tried } from "../exercises.ts";
import { plainModel, gridKey, cachedGrid, computeGrid, computeGridRoutes } from "./layout.js";
import { buildCells, reachedCells, maskPaths } from "./grid/cells.js";
import { mapView, effective, buildModel, controls, heightLens, lensValue, SYMBOLS, M } from "./map.js";

const KEY = "rdstudio.gridmap";
const CELL = 10; // a cell's side at zoom 1
const MIN_CELL = 1.6; // folders stay closed while a cell is smaller than this on screen
const LABELS_AT = 7; // notes carry their titles from this cell size up
const DOTS_AT = 8; // the dot at each grid corner is drawn from this cell size up

/** The Atlas: on the grid when that is chosen, else the continuous one. */
export function atlasView(focusRef = "") {
  return effective().folders === "grid" ? gridView(focusRef) : mapView(focusRef);
}

// A rectangle on grid lines with its corners cut by `c`, drawn `inset` inside its cells.
function cut(x0, y0, x1, y1, c, inset = 0) {
  x0 += inset; y0 += inset; x1 -= inset; y1 -= inset;
  c = Math.max(0, Math.min(c, (x1 - x0) / 2, (y1 - y0) / 2));
  const f = (v) => v.toFixed(1);
  return `M${f(x0 + c)} ${f(y0)}H${f(x1 - c)}L${f(x1)} ${f(y0 + c)}V${f(y1 - c)}L${f(x1 - c)} ${f(y1)}H${f(x0 + c)}L${f(x0)} ${f(y1 - c)}V${f(y0 + c)}Z`;
}

// Shift a route sideways by `o` (its lane), with one normal per undirected
// direction, so routes running opposite ways do not collide.
function offsetLine(P, o) {
  if (!o) return P;
  const normal = (a, b) => {
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    if (dx < -1e-6 || (Math.abs(dx) < 1e-6 && dy < 0)) { dx = -dx; dy = -dy; }
    return [-dy, dx];
  };
  return P.map((p, i) => {
    const n1 = i > 0 ? normal(P[i - 1], p) : normal(p, P[i + 1]), n2 = i < P.length - 1 ? normal(p, P[i + 1]) : n1;
    const d = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    return d < 0.2 ? [p[0] + n1[0] * o, p[1] + n1[1] * o] : [p[0] + ((n1[0] + n2[0]) / d) * o, p[1] + ((n1[1] + n2[1]) / d) * o];
  });
}

// Straight runs with their corners cut at 45 degrees, by up to `d`.
function cutPath(P, d) {
  const Q = P.filter((p, i) => i === 0 || i === P.length - 1 || Math.abs((p[0] - P[i - 1][0]) * (P[i + 1][1] - p[1]) - (p[1] - P[i - 1][1]) * (P[i + 1][0] - p[0])) > 1e-3);
  const f = (v) => v.toFixed(1);
  let out = `M${f(Q[0][0])} ${f(Q[0][1])}`;
  for (let i = 1; i < Q.length - 1; i++) {
    const a = Q[i - 1], b = Q[i], c = Q[i + 1];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, l2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1, r = Math.min(d, l1 / 2, l2 / 2);
    out += `L${f(b[0] - ((b[0] - a[0]) / l1) * r)} ${f(b[1] - ((b[1] - a[1]) / l1) * r)}L${f(b[0] + ((c[0] - b[0]) / l2) * r)} ${f(b[1] + ((c[1] - b[1]) / l2) * r)}`;
  }
  const z = Q[Q.length - 1];
  return out + `L${f(z[0])} ${f(z[1])}`;
}

// The key: where a note stands under the height lens, and the grid's lines.
function gridKeyItems(lens, terrain) {
  const icon = (inner) => { const el = h("svg:svg", { width: 22, height: 22, viewBox: "0 0 22 22", class: "m-key", "aria-hidden": "true" }); el.innerHTML = inner; return el; };
  const item = (inner, text) => h("li", {}, icon(inner), h("span", {}, text));
  const block = (cls, extra = "") => `<g class="gn ${cls}"><path class="gn-block" d="${cut(2, 6, 20, 16, 2)}"/>${extra}</g>`;
  const rule = '<path class="gn-ok" d="M5 11.5h12M5 13.5h12"/>';
  const words = {
    understanding: ["Understood: filled, double green rule", "Worked through: filled", "Opened: outline", "Not reached: faint"],
    activity: ["Changed this week: filled", "This month: filled", "This quarter: outline", "90 days untouched: faint"],
    health: ["Reviewed, tested and current: double green rule", "Two of the three: filled", "One: outline", "None: faint"],
  }[lens];
  return [
    item(block("l3", lens === "activity" ? "" : rule), words[0]),
    ...(lens === "activity" ? [] : [item(block("l2"), words[1])]),
    item(block("l1"), words[2]),
    item(block("l0"), words[3]),
    ...(lens === "understanding" ? [item(block("l1 bad"), "The teacher says: needs work")] : []),
    ...(terrain ? [item('<path class="g-reach" d="M2 4h18v14h-18z"/><path class="g-front" d="M2 4h18v14h-18z"/>', "Reached ground: lighter")] : []),
    item(`<path class="g-wall" d="${cut(2, 4, 20, 18, 3)}"/>`, "A folder's wall; each level in is a tone lighter"),
    item('<path class="g-rt" d="M2 11H20" stroke-width="2.2"/>', "Trunk: the links between two items of a folder, with their count"),
    item('<g class="back"><path class="g-rt" d="M2 11H9L13 7H20" stroke-width="1"/></g>', "Dashed: a back link, against the order of the layers"),
    item('<g class="g-hot"><path class="g-rt hot req" d="M2 11H20"/></g>', "Under the pointer: what the note requires"),
    item('<g class="g-hot"><path class="g-rt hot dep" d="M2 11H20"/></g>', "Under the pointer: what builds on it"),
  ];
}

/** @param {string} [focusRef] a folder to open on */
export function gridView(focusRef = "") {
  document.title = `Map · ${store.site.title}`;
  let o = effective();
  const wrap = h("div", { class: "graph-wrap map-wrap gridmap-wrap" });
  const svg = d3.select(wrap).append("svg").attr("class", "gridmap").attr("role", "img").attr("aria-label", "Knowledge map, on a grid");
  const tip = h("div", { class: "graph-tip", hidden: true });
  const crumbs = h("nav", { class: "map-crumbs", "aria-label": "Current folder" });
  const readout = h("p", { class: "map-readout" });
  const summary = h("p", { class: "map-summary" });
  const newNote = h("button", { class: "toggle", type: "button" }, "New note");
  const newFolder = h("button", { class: "toggle", type: "button" }, "New folder");
  newNote.addEventListener("click", () => actions.open({ kind: "new-note", folder: focusRefNow() }));
  newFolder.addEventListener("click", () => actions.open({ kind: "new-folder", folder: focusRefNow(), from: "map" }));
  const create = h("div", { class: "map-create", role: "group", "aria-label": "Create here", hidden: true }, newNote, newFolder);
  void editing.known.then(() => { create.hidden = !editing.enabled; });
  const panel = controls({
    view: () => { if (effective().folders !== "grid") return location.reload(); o = effective(); cache = null; tones = null; arrange(); schedule(); }, // the continuous Atlas is another view
    tune: () => { o = effective(); cache = null; arrange(); schedule(); },
    readout, summary, key: gridKeyItems,
  });
  const status = h("p", { class: "map-status", role: "status", hidden: true }, "Arranging the map…");
  wrap.append(panel, crumbs, create, tip, status, h("div", { class: "graph-hint" }, "Click a note to select it, again to open it; a folder to zoom in, empty space to step out."));

  const back = svg.append("rect").attr("class", "g-sea");
  // One layer, moved and scaled during a gesture and redrawn when it pauses, as on the continuous Atlas.
  const world = svg.append("g").attr("class", "g-world");
  const gFloor = world.append("g");
  const gReach = world.append("g").attr("class", "g-ground");
  const reachArea = gReach.append("path").attr("class", "g-reach"), reachEdge = gReach.append("path").attr("class", "g-front");
  const gWalls = world.append("g");
  const gRoutes = world.append("g").attr("class", "g-routes");
  const gNotes = world.append("g");
  const gTitles = world.append("g").attr("class", "g-titles");
  const gCounts = world.append("g").attr("class", "g-counts");
  const gHot = world.append("g").attr("class", "g-hot");

  let model = timed("map-model", buildModel);
  let nodes = byId(model); // the model's notes and folders, by id
  let L = null, key = null, wanted = null; // the layout shown, its key, and the key asked for
  let cells = null, up = [], noteCount = [];
  let cache = null; // the routes for the folder in focus and what is open in it
  let drawn = []; // the routes on screen: the last that arrived
  let tones = null; // where each note stands under the lens, and the reached ground
  let w = 800, hgt = 600;
  let focus = -1, selected = null; // a folder's index (-1: the whole map); a note's id
  let viewed = false, userMoved = false, left = false;
  let needsOf = [], neededBy = [], ownPath = new Map(); // each note's links, and the paths the layout drew
  let hovered = -1, hot = null, hotFor = null; // the note pointed at; its dependencies, lit; and what they were worked out for
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } })();
  let T = null;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const focusRefNow = () => (focus >= 0 ? L.items[focus].ref : "");

  function byId(m) {
    const out = new Map();
    const walk = (n) => { out.set(n.id, n); (n.children || []).forEach(walk); };
    walk(m.root);
    return out;
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(T && key ? { key, x: T.x, y: T.y, k: T.k } : null)); } catch { /* storage unavailable */ }
  }

  // ------------------------------------------------------------ layout

  // The layout's top level runs bottom to top, which suits a page taller
  // than wide; on a phone turned on its side, left to right. Both are worked
  // out there, so turning it finds the other ready.
  const phone = matchMedia("(pointer: coarse)").matches;
  const flowFor = (wide) => (o.gridFlow === "up" || o.gridFlow === "right" ? o.gridFlow : phone && wide ? "right" : "up");
  const ready = new Map(); // layouts by key, this visit
  function arrange() {
    const wide = window.innerWidth > window.innerHeight;
    const oo = { ...o, gridFlow: flowFor(wide) }, plain = plainModel(model), k = gridKey(plain, oo);
    if (k === wanted) return;
    wanted = k;
    if (k === key) { status.hidden = true; return; }
    const get = (kk, opts) => {
      const hit = ready.get(kk) || cachedGrid(kk, opts);
      return hit ? Promise.resolve(hit) : computeGrid(kk, plain, opts);
    };
    const hit = ready.get(k) || cachedGrid(k, oo);
    if (hit) { ready.set(k, hit); settle(k, hit); }
    else {
      status.hidden = false;
      const t0 = performance.now();
      get(k, oo).then((layout) => {
        ready.set(k, layout);
        if (left || k !== wanted) return;
        measure("map-grid-layout", t0);
        settle(k, layout);
      });
    }
    if (phone && o.gridFlow !== "up" && o.gridFlow !== "right") {
      const turned = { ...o, gridFlow: flowFor(!wide) }, tk = gridKey(plain, turned);
      if (!ready.has(tk)) get(tk, turned).then((layout) => { ready.set(tk, layout); });
    }
  }

  function settle(k, layout) {
    const first = !L;
    L = layout; key = k;
    cells = buildCells(L);
    up = L.items.map((n) => { const out = []; for (let p = n.parent; p >= 0; p = L.items[p].parent) out.push(p); return out; });
    noteCount = L.items.map(() => 0);
    L.items.forEach((n, i) => { if (n.kind === "note") for (const p of up[i]) noteCount[p]++; });
    cache = null; drawn = []; tones = null;
    status.hidden = true;
    needsOf = L.items.map(() => []); neededBy = L.items.map(() => []);
    for (const l of L.links) if (l.s >= 2) { needsOf[l.a].push(l.b); neededBy[l.b].push(l.a); }
    ownPath = new Map((L.trunks || []).filter((t) => t.pts).map((t) => [t.a + "|" + t.b, t.pts]));
    hot = null; hotFor = null;
    if (viewed && (first || !userMoved)) initialView();
    schedule();
    measure("map-settled", 0);
  }

  // ------------------------------------------------------------ view

  let drawnAt = null, drawnWhen = 0, moving = false;
  const zoom = d3.zoom().scaleExtent([0.03, 12]).extent(() => [[0, 0], [w || 800, hgt || 600]])
    .on("start", (event) => { if (event.sourceEvent) userMoved = true; moving = true; svg.classed("moving", true); })
    .on("zoom", (event) => {
      const t = event.transform;
      T = t;
      dotGrid(t);
      const s = drawnAt ? t.k / drawnAt.k : 0;
      if (moving && drawnAt && s > 0.67 && s < 1.5 && performance.now() - drawnWhen < 350) {
        world.attr("transform", `translate(${t.x - drawnAt.x * s},${t.y - drawnAt.y * s}) scale(${s})`);
      } else schedule();
    })
    .on("end", () => { moving = false; svg.classed("moving", false); schedule(); persist(); });
  svg.call(zoom).on("dblclick.zoom", null);

  // The grid's corners, as dots, once cells are large enough to count. They
  // are the page's background, not part of the drawing: a tiled background
  // follows every zoom step for nothing, where an SVG pattern is repainted.
  function dotGrid(t) {
    const c = CELL * t.k;
    wrap.classList.toggle("dotted", c >= DOTS_AT);
    if (c < DOTS_AT) return;
    wrap.style.backgroundSize = `${c}px ${c}px`;
    wrap.style.backgroundPosition = `${t.x - c / 2}px ${t.y - c / 2}px`;
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; timed("map-render", render); });
  }

  // The lens panel covers the left of a wide view; the map is fitted beside it.
  const inset = () => (w >= 900 ? Math.min(panel.offsetWidth + 24, w / 3) : 0);
  // The view that shows an item with a little room round it; the whole map for -1.
  function fit(i) {
    const n = i >= 0 ? L.items[i] : { gx: 0, gy: 0, w: L.W, h: L.H }, room = i >= 0 ? 2 : 0, x0 = inset();
    const k = Math.min((w - x0) / ((n.w + 2 * room) * CELL), hgt / ((n.h + 2 * room) * CELL)) * 0.96;
    return d3.zoomIdentity.translate(x0 + (w - x0) / 2 - k * (n.gx + n.w / 2) * CELL, hgt / 2 - k * (n.gy + n.h / 2) * CELL).scale(k);
  }
  function zoomTo(i) {
    if (!L) return;
    if (reduceMotion) svg.call(zoom.transform, fit(i));
    else svg.transition().duration(550).call(zoom.transform, fit(i));
  }

  function select(id) {
    selected = id;
    hotFor = null;
    tip.hidden = true;
    schedule();
  }
  back.on("click", () => { if (selected) select(null); else if (focus >= 0) zoomTo(L.items[focus].parent); });
  wrap.addEventListener("keydown", (e) => { if (e.key === "Escape" && selected) { e.preventDefault(); select(null); } });

  // The notes the teacher says need work: an exercise testing them was missed.
  let needsAt = null, needsSet = new Set();
  function needsWork() {
    if (heightLens(o) !== "understanding") return new Set();
    if (needsAt === learner.events) return needsSet;
    needsAt = learner.events;
    const all = tried();
    needsSet = new Set();
    for (const ex of exerciseNotes()) {
      const st = statusOf(ex.id, all);
      if (st === "missed" || st === "partly") for (const id of testsOf(ex)) needsSet.add(id);
    }
    return needsSet;
  }

  // Where each note stands under the height lens (0 not reached to 3), how
  // many of each folder's are reached, and the reached ground as two paths
  // in cells. Worked out again only when the layout, the lens or what you
  // have done changes.
  function toned() {
    const lens = heightLens(o), sig = `${lens}|${o.terrain}`;
    if (tones && tones.sig === sig && tones.events === learner.events && tones.concepts === store.concepts) return tones;
    const level = L.items.map((n) => (n.kind === "note" && nodes.get(n.id)?.c ? lensValue(lens, nodes.get(n.id).c) : 0));
    const reached = L.items.map(() => 0);
    L.items.forEach((n, i) => { if (n.kind === "note" && level[i] > 0) for (const p of up[i]) reached[p]++; });
    const ground = o.terrain ? maskPaths(reachedCells(L, cells, (i) => level[i] > 0), cells.W, cells.H) : { area: "", edge: "" };
    tones = { sig, events: learner.events, concepts: store.concepts, lens, level, reached, ground };
    return tones;
  }

  // What links are drawn at rest: the layout's trunks (grid/nested.js). Each
  // joins two items of one folder, and is drawn when both are shown. It has
  // its own path, except a back trunk (dashed) or an implied one (hidden,
  // unless Hide implied is off), which the router finds a way for.
  function routesFor(open, shown) {
    if (!o.showLinks) { cache = null; drawn = []; return; }
    const sig = `${o.hideImplied}|${Array.from(open).join("")}`;
    if (cache?.sig === sig) return;
    const fixed = [], asks = [];
    let links = 0;
    for (const t of L.trunks) {
      if (!shown[t.a] || !shown[t.b] || (t.implied && o.hideImplied)) continue;
      links += t.count;
      if (t.pts) fixed.push({ a: t.a, b: t.b, count: t.count, cls: "dag", pts: t.pts, lane: 0 });
      else asks.push({ a: t.a, b: t.b, count: t.count, cls: "solo" + (t.back ? " back" : "") });
    }
    const mine = cache = { sig, asks, fixed, links, measures: null };
    drawn = fixed;
    if (!asks.length) return;
    const t0 = performance.now();
    computeGridRoutes(key, L, asks.map(({ a, b }) => ({ a, b }))).then((res) => {
      if (left || cache !== mine) return;
      measure("map-grid-routes", t0);
      mine.measures = res.measures;
      drawn = [...fixed, ...asks.map((m, k) => res.routes[k] && { ...m, ...res.routes[k] }).filter(Boolean)];
      schedule();
    });
  }

  // Pointing at a note, or selecting one, lights what it depends on. Inside
  // its own folder: every link down its chain of requirements. Beyond the
  // folder: only what it requires directly, each link drawn all the way from
  // note to note, through the walls. And the links from what builds on it
  // directly, dotted. An end inside a closed folder is drawn to that folder.
  // What was worked out is kept, so pointing again is at once.
  const lights = new Map();
  function point(i) {
    if (hovered === i) return;
    hovered = i;
    schedule();
  }
  function lightFor(open) {
    const at = hovered >= 0 ? hovered : selected ? L.items.findIndex((n) => n.id === selected) : -1;
    const sig = at + "|" + key + "|" + Array.from(open).join("");
    if (sig === hotFor) return;
    hotFor = sig;
    if (at < 0 || !o.showLinks) { hot = null; return; }
    if (lights.has(sig)) { hot = lights.get(sig); return; }
    const shownAs = (i) => { for (let k = up[i].length - 1; k >= 0; k--) if (!open[up[i][k]]) return up[i][k]; return i; };
    const notes = new Set(), pairs = [], home = L.items[at].parent;
    const todo = [at], seen = new Set([at]);
    while (todo.length) {
      const a = todo.pop();
      for (const b of needsOf[a]) {
        const inside = L.items[b].parent === home;
        if (!inside && a !== at) continue;
        pairs.push([a, b, "hot req"]);
        notes.add(b);
        if (inside && !seen.has(b)) { seen.add(b); todo.push(b); }
      }
    }
    for (const a of neededBy[at]) { pairs.push([a, at, "hot dep"]); notes.add(a); }
    const routes = [], asks = [];
    for (const [a, b, cls] of pairs) {
      const sa = shownAs(a), sb = shownAs(b), own = sa === a && sb === b && ownPath.get(a + "|" + b);
      if (sa === sb) continue;
      if (own) routes.push({ a, b, cls, pts: own, lane: 0 });
      else asks.push({ a: sa, b: sb, cls });
    }
    const mine = hot = { at, notes, routes };
    if (lights.size > 400) lights.clear();
    lights.set(sig, mine);
    if (!asks.length) return;
    computeGridRoutes(key, L, asks.map(({ a, b }) => ({ a, b }))).then((res) => {
      if (left) return;
      mine.routes = [...routes, ...asks.map((m, k) => res.routes[k] && { ...m, pts: res.routes[k].pts, lane: 0 }).filter(Boolean)];
      if (hot === mine) schedule();
    });
  }

  function render() {
    const t = T || d3.zoomIdentity;
    drawnAt = t; drawnWhen = performance.now();
    world.attr("transform", null);
    if (!L) return;
    const items = L.items, c = CELL * t.k;
    const X = (x) => t.applyX(x * CELL), Y = (y) => t.applyY(y * CELL);
    const onScreen = (n) => X(n.gx + n.w) > 0 && X(n.gx) < w && Y(n.gy + n.h) > 0 && Y(n.gy) < hgt;
    const { level, reached, ground, lens } = toned();
    const needs = needsWork();

    // What is open: a folder big enough on screen whose parent is open. A
    // layout lists parents before their children.
    const open = new Uint8Array(items.length), shown = new Uint8Array(items.length);
    items.forEach((n, i) => {
      shown[i] = n.parent < 0 || open[n.parent] ? 1 : 0;
      if (n.kind === "folder" && shown[i] && c >= MIN_CELL && Math.max(n.w, n.h) * c >= o.detail) open[i] = 1;
    });
    // Focus: the deepest open folder that fills the view: most of its area,
    // or nearly all of its width or height (a folder zoomed to is one or the other).
    focus = -1;
    const x0 = inset(), wide = w - x0;
    items.forEach((n, i) => {
      if (!open[i]) return;
      const sw = Math.max(0, Math.min(w, X(n.gx + n.w)) - Math.max(x0, X(n.gx))), sh = Math.max(0, Math.min(hgt, Y(n.gy + n.h)) - Math.max(0, Y(n.gy)));
      const centred = X(n.gx) <= x0 + wide / 2 && X(n.gx + n.w) >= x0 + wide / 2 && Y(n.gy) <= hgt / 2 && Y(n.gy + n.h) >= hgt / 2;
      if ((sw * sh >= 0.55 * wide * hgt || (centred && (sw >= 0.8 * wide || sh >= 0.8 * hgt))) && (focus < 0 || n.depth > items[focus].depth)) focus = i;
    });
    drawCrumbs();

    dotGrid(t);

    // Folders, outermost first: the floor of an open one (a tone lighter per
    // level), the reached ground over the floors, then the walls; a closed
    // folder is one filled block.
    const folders = items.map((n, i) => i).filter((i) => items[i].kind === "folder" && shown[i] && onScreen(items[i])).sort((a, b) => items[a].depth - items[b].depth);
    const wall = (i) => { const n = items[i]; return cut(X(n.gx), Y(n.gy), X(n.gx + n.w), Y(n.gy + n.h), c * 1.5); };
    const enter = (event, i) => showTip(event, i), leave = () => { tip.hidden = true; };
    const zoomIn = (event, i) => { event.stopPropagation(); zoomTo(i === focus ? items[i].parent : i); };
    gFloor.selectAll("path").data(folders.filter((i) => open[i]), (i) => items[i].id).join("path")
      .attr("class", (i) => `g-floor d${Math.min(items[i].depth, 3)}`).attr("d", wall).on("click", zoomIn);
    gReach.attr("transform", `translate(${t.x},${t.y}) scale(${c})`);
    reachArea.attr("d", ground.area);
    reachEdge.attr("d", ground.edge);
    gWalls.selectAll("path").data(folders, (i) => items[i].id).join("path")
      .attr("class", (i) => `g-wall d${Math.min(items[i].depth, 3)} ${open[i] ? "open" : "closed"}`).attr("d", wall)
      .on("click", zoomIn).on("pointerenter", enter).on("pointerleave", leave);

    // Routes: neutral lines, wider with more links, each in its lane; a later
    // one is drawn over an earlier one with a gap, so a crossing reads as over and under.
    routesFor(open, shown);
    lightFor(open);
    svg.classed("lit", !!hot);
    const step = Math.max(2.2, Math.min(5, c / 4.2));
    const line = (m) => cutPath(offsetLine(m.pts.map(([x, y]) => [X(x), Y(y)]), m.lane * step), c * 0.9);
    const width = (m) => 1 + Math.log2(m.count) * 0.8;
    gRoutes.selectAll("g").data(drawn, (m) => m.cls[0] + m.a + "|" + m.b).join((el) => { const g = el.append("g"); g.append("path").attr("class", "g-halo"); g.append("path").attr("class", "g-rt"); return g; })
      .attr("class", (m) => m.cls)
      .each(function (m) {
        const d = line(m), g = d3.select(this);
        g.select(".g-halo").attr("d", d).attr("stroke-width", width(m) + 3.5);
        g.select(".g-rt").attr("d", d).attr("stroke-width", width(m));
      });
    gHot.selectAll("path").data(hot ? hot.routes : [], (m) => m.cls + m.a + "|" + m.b).join("path").attr("class", (m) => "g-rt " + m.cls).attr("d", line);
    // A trunk's count, where it runs between its two folders.
    const counted = drawn.filter((m) => m.count > 1);
    gCounts.selectAll("text").data(counted, (m) => m.cls[0] + m.a + "|" + m.b).join("text").attr("class", "g-count")
      .attr("x", (m) => X(m.pts[m.pts.length >> 1][0])).attr("y", (m) => Y(m.pts[m.pts.length >> 1][1]) + 4).text((m) => m.count);

    // Notes: a block with the glyph for its kind, and its title once there is room.
    const notes = items.map((n, i) => i).filter((i) => items[i].kind === "note" && shown[i] && onScreen(items[i]));
    const labels = c >= LABELS_AT;
    gNotes.selectAll("g").data(notes, (i) => items[i].id).join("g")
      .attr("class", (i) => `gn l${level[i]}${needs.has(items[i].ref) ? " bad" : ""}${items[i].id === selected ? " sel" : ""}${hot?.notes.has(i) ? " dep" : ""}${hot?.at === i ? " at" : ""}`)
      .attr("tabindex", 0).attr("role", "link").attr("aria-label", (i) => nodes.get(items[i].id)?.label || items[i].ref)
      .on("click", (event, i) => { event.stopPropagation(); if (selected === items[i].id) openNote(i); else select(items[i].id); })
      .on("dblclick", (event, i) => { event.stopPropagation(); openNote(i); })
      .on("keydown", (event, i) => { if (event.key === "Enter") openNote(i); else if (event.key === " ") { event.preventDefault(); select(items[i].id); } })
      .on("pointerenter", (event, i) => { enter(event, i); point(i); }).on("pointerleave", () => { leave(); point(-1); })
      .each(function (i) {
        const n = items[i], d = nodes.get(n.id), g = d3.select(this), l = level[i];
        const x0 = X(n.gx), y0 = Y(n.gy), bw = n.w * c, bh = n.h * c;
        g.selectAll("*").remove();
        g.append("path").attr("class", "gn-block").attr("d", cut(x0, y0, x0 + bw, y0 + bh, Math.min(8, c * 0.7), Math.min(1.5, c * 0.15)));
        if (l === 3 && lens !== "activity" && bw > 14) g.append("path").attr("class", "gn-ok").attr("d", `M${(x0 + 5).toFixed(1)} ${(y0 + bh - 5.5).toFixed(1)}h${(bw - 10).toFixed(1)}M${(x0 + 5).toFixed(1)} ${(y0 + bh - 8.5).toFixed(1)}h${(bw - 10).toFixed(1)}`);
        if (c >= 4) {
          const shape = d?.marker || "circle", r = labels ? 3.8 : Math.min(3.6, c * 0.42);
          const kx = labels ? x0 + bw - 11 : x0 + bw / 2, ky = y0 + bh / 2 - (l === 3 ? 2 : 0);
          g.append("path").attr("class", "g-kind").attr("transform", `translate(${kx.toFixed(1)},${ky.toFixed(1)})`).attr("d", d3.symbol(SYMBOLS[shape], r * r * 3)());
          if (shape === "ring") g.append("path").attr("class", "g-kind").attr("d", `M${(kx - r).toFixed(1)} ${ky.toFixed(1)}h${(2 * r).toFixed(1)}`);
        }
        if (labels && d) {
          // The title, wrapped to the block and cut short where it does not fit.
          const per = Math.floor((bw - 28) / 6.9), most = Math.max(1, Math.floor((bh - (l === 3 ? 16 : 8)) / 13));
          if (per >= 4) {
            const lines = [];
            let cur = "";
            for (let word of String(d.label).split(/\s+/)) {
              if (word.length > per) word = word.slice(0, per - 1) + "…";
              if (cur && (cur + " " + word).length > per) { lines.push(cur); cur = word; } else cur = cur ? cur + " " + word : word;
            }
            lines.push(cur);
            const show = lines.slice(0, most);
            if (lines.length > most) show[most - 1] = lines.slice(most - 1).join(" ").slice(0, per - 1) + "…";
            const text = g.append("text").attr("class", "g-note");
            show.forEach((s, k) => text.append("tspan").attr("x", (x0 + 7).toFixed(1))
              .attr("y", (y0 + (show.length === 1 && bh < 40 ? bh / 2 + (l === 3 ? 2 : 4.5) : 15 + k * 13)).toFixed(1)).text(s));
          }
        }
      });

    // Titles, each with how many of the folder's notes are reached.
    const size = Math.max(10, Math.min(12, c * 0.72));
    const titled = folders.filter((i) => { const n = items[i]; return open[i] || (n.w * c >= 44 && n.h * c >= 16); });
    gTitles.selectAll("text").data(titled, (i) => items[i].id).join("text")
      .attr("class", (i) => `g-title ${open[i] ? `open d${Math.min(items[i].depth, 3)}` : "closed"}`).style("font-size", `${size.toFixed(1)}px`)
      // An open folder's title sits on its top edge, as part of the edge; a closed one's in the middle of its block.
      .attr("x", (i) => (open[i] ? X(items[i].gx) + c * 1.5 + 6 : X(items[i].gx + items[i].w / 2)))
      .attr("y", (i) => (open[i] ? Y(items[i].gy) : Y(items[i].gy + items[i].h / 2)) + size * 0.36)
      .each(function (i) {
        const n = items[i], el = d3.select(this);
        const count = lens === "understanding" && understanding.on ? `${reached[i]}/${noteCount[i]}` : String(noteCount[i]);
        const most = Math.floor((n.w * c - (open[i] ? c * 3 + 12 : 14)) / (size * 0.64));
        let name = nodes.get(n.id)?.label || n.ref;
        if (name.length + count.length + 1 > most) name = most - count.length - 2 >= 3 ? name.slice(0, most - count.length - 2) + "…" : "";
        el.text(name);
        if (name || count.length <= most) el.append("tspan").attr("class", "g-n").text((name ? " " : "") + count);
      });

    const m = cache?.measures;
    if (!o.showLinks) summary.textContent = "Links are off.";
    else if (cache) {
      const backs = cache.asks.filter((a) => a.cls.endsWith(" back")).length;
      summary.textContent = `${cache.links} links, as ${cache.fixed.length + cache.asks.length} trunks` + (backs ? `, ${backs} of them against the layers (dashed).` : ".") + " Point at a note for what it depends on.";
    }
    readout.textContent = `Grid ${L.W} by ${L.H} cells, flowing ${L.flow}.` + (m ? ` Routes ${m.routes}, crossings ${m.crossings}, cells of route ${m.length}, beside another route ${Math.round(m.beside * 100)}%${m.lost ? `, no way found for ${m.lost}` : ""}.` : "");
  }

  function openNote(i) {
    persist();
    location.hash = conceptHref(L.items[i].ref);
  }

  function drawCrumbs() {
    const path = focus >= 0 ? [...up[focus].slice().reverse(), focus] : [];
    const where = focus >= 0 ? ` in ${nodes.get(L.items[focus].id)?.label || L.items[focus].ref}` : "";
    newNote.title = `Write a new note${where}`;
    newFolder.title = `Start a new folder${where}, a new region on the map`;
    const button = (i, label) => {
      const b = h("button", { type: "button", "aria-current": i === focus ? "location" : null }, label);
      b.addEventListener("click", () => zoomTo(i));
      return b;
    };
    crumbs.replaceChildren(button(-1, model.root.label), ...path.flatMap((i) => [h("span", { "aria-hidden": "true" }, "/"), button(i, nodes.get(L.items[i].id)?.label || L.items[i].ref)]));
  }

  function showTip(event, i) {
    const n = L.items[i], d = nodes.get(n.id);
    if (!d) return;
    const lines = [h("strong", {}, d.label)];
    if (n.kind === "note") {
      lines.push(h("span", {}, `${d.c.type || "Concept"} · ${TRUST_LABEL[trustState(d.c)]}${d.landmark ? " · Landmark" : ""}`));
      if (d.c.description) lines.push(h("div", {}, d.c.description));
    } else lines.push(h("span", {}, `Folder · ${noteCount[i]} note${noteCount[i] === 1 ? "" : "s"}`));
    tip.replaceChildren(...lines);
    const box = wrap.getBoundingClientRect();
    tip.style.left = `${Math.min(event.clientX - box.left + 14, box.width - 290)}px`;
    tip.style.top = `${event.clientY - box.top + 14}px`;
    tip.hidden = false;
  }

  function size() {
    const rect = wrap.getBoundingClientRect();
    w = rect.width || 800; hgt = rect.height || 600;
    back.attr("width", w).attr("height", hgt);
  }

  function initialView() {
    if (!L) return;
    const target = focusRef ? L.items.findIndex((n) => n.id === "d:" + focusRef) : -1;
    if (target >= 0) svg.call(zoom.transform, fit(target));
    else if (saved?.key === key && !T) svg.call(zoom.transform, d3.zoomIdentity.translate(saved.x, saved.y).scale(saved.k));
    else svg.call(zoom.transform, fit(-1));
  }

  arrange();
  requestAnimationFrame(() => {
    size();
    viewed = true;
    initialView();
  });
  const onResize = () => { size(); arrange(); schedule(); };
  window.addEventListener("resize", onResize);
  wrap.leave = () => { left = true; svg.interrupt(); window.removeEventListener("resize", onResize); persist(); };
  wrap.refresh = () => { model = timed("map-model", buildModel); nodes = byId(model); o = effective(); arrange(); tones = null; schedule(); };
  M.reset = () => zoomTo(-1);
  wrap.routes = () => drawn; // for tests and inspection
  wrap.layout = () => L;
  wrap.model = () => model;
  wrap.measures = () => cache?.measures || null;
  return wrap;
}
