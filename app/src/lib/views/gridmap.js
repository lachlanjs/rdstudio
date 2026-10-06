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
// decides what is open. The model, the settings and the lens panel are map.js.

import * as d3 from "d3";
import { isStudyNote } from "@rdstudio/core/learning";
import { learner, store } from "../data.svelte.ts";
import { prerequisites } from "../learn.ts";
import { conceptHref, trustState, TRUST_LABEL } from "../format.ts";
import { measure, timed } from "../perf.ts";
import { h } from "./dom.js";
import { actions } from "../actions.svelte.ts";
import { editing } from "../edit.svelte.ts";
import { understanding, STATE_LABEL } from "../understanding.svelte.ts";
import { exerciseNotes, statusOf, testsOf, tried } from "../exercises.ts";
import { plainModel, gridKey, cachedGrid, computeGrid, computeGridRoutes } from "./layout.js";
import { buildCells, reachedCells, maskPaths } from "./grid/cells.js";
import { effective, buildModel, controls, heightLens, lensValue, remember, SYMBOLS, M } from "./map.js";
import { codeMap, codeHref, KIND_LABEL, LINK_LABEL } from "../code.ts";

const KEY = "rdstudio.gridmap";
const CELL = 10; // a cell's side at zoom 1
const MIN_CELL = 1.6; // folders stay closed while a cell is smaller than this on screen
const LABELS_AT = 6; // notes carry their titles from this cell size up
const LABEL_MIN = 10; // a title's smallest size on a note; it grows with the block as far as the whole title still fits
const STEP_MS = 170, DRAW_MS = 280; // lighting what a note depends on: each link starts this long after the one before, and takes this long (as in app.css) before the note's frame follows
const DOTS_AT = 8; // the dot at each grid corner is drawn from this cell size up

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
    item('<g class="feed"><path class="g-rt" d="M2 15H8L12 11H20M2 6H8L12 10" stroke-width="1"/></g>', "Feeder: inside a folder, where a trunk's links come from"),
    item('<g class="back"><path class="g-rt" d="M2 11H9L13 7H20" stroke-width="1"/></g>', "Dashed: a back link, against the order of the layers"),
    item('<g class="g-hot"><path class="g-rt hot req" d="M2 11H20"/></g>', "Under the pointer: what the note requires"),
    item('<g class="g-hot"><path class="g-rt hot req far" d="M2 11H20"/></g>', "Fainter: what those require in turn, all the way back"),
    item('<g class="g-hot"><path class="g-rt hot dep" d="M2 11H20"/></g>', "Under the pointer: what builds on it"),
  ];
}

/**
 * @param {string} [focusRef] a folder to open on
 * @param {{ path?: string, tour?: any }} [opts] a study path (a note and
 *   everything it requires, numbered in reading order), or a tour ({key,
 *   title, stops: [{id, title, text}], start, narrate, onStep, onFinish,
 *   back}), numbered by stop with a route from each stop to the next
 */
export function mapView(focusRef = "", { path = "", tour = null } = {}) {
  document.title = `${tour ? tour.title : "Map"} · ${store.site.title}`;
  const goal = !tour && path && store.concepts.get(path);
  const onMap = (id) => id && store.concepts.has(id) && isStudyNote(store.concepts.get(id));
  const trail = tour ? [...new Set(tour.stops.map((st) => st.id).filter(onMap))] : goal ? [...prerequisites(goal.id), goal].map((c) => c.id) : null;
  const step = new Map();
  if (tour) tour.stops.forEach((st, i) => { if (onMap(st.id) && !step.has(st.id)) step.set(st.id, i + 1); });
  else (trail || []).forEach((id, i) => step.set(id, i + 1));
  let atStop = tour ? Math.min(Math.max(0, tour.start || 0), tour.stops.length - 1) : -1;
  const goalId = () => (tour ? tour.stops[atStop]?.id : path);
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
  const makePanel = () => controls({
    view: () => { o = effective(); cache = null; tones = null; hotFor = null; arrange(); schedule(); },
    readout, summary, key: gridKeyItems,
  });
  let panel = makePanel();
  // The folderless view's legend: the folders and their colours, one to a line; it folds to its heading.
  const folderRows = h("ul", {});
  const legendShow = h("span", { class: "lens-change" });
  const legend = h("details", { class: "map-folders", hidden: true, open: o.foldersOpen !== false },
    h("summary", { title: "Show or hide the folders' colours" }, h("span", { class: "lens-label" }, "Folders"), legendShow), folderRows);
  const legendFolded = () => { legendShow.textContent = legend.open ? "Hide" : "Show"; };
  legend.addEventListener("toggle", () => { remember("foldersOpen", legend.open); legendFolded(); });
  legendFolded();
  const status = h("p", { class: "map-status", role: "status", hidden: true }, "Arranging the map…");
  // The selected note: what it is, where you stand, and the way in.
  const card = h("section", { class: "atlas-card", hidden: true, "aria-live": "polite" });
  wrap.append(panel, crumbs, legend, create, tip, status, card, h("div", { class: "graph-hint" }, "Click a note to select it, again to open it; a folder to zoom in, empty space to step out."));

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
  const gSteps = world.append("g").attr("class", "m-steps");

  let model = timed("map-model", buildModel);
  let nodes = byId(model); // the model's notes and folders, by id
  let L = null, key = null, wanted = null; // the layout shown, its key, and the key asked for
  let cells = null, up = [], noteCount = [];
  let flat = false, folderOf = new Map(), folderList = []; // the folderless view: each note's top-level folder (a number, for its colour), and the folders
  let cache = null; // the routes for the folder in focus and what is open in it
  let drawn = []; // the routes on screen: the last that arrived
  let tones = null; // where each note stands under the lens, and the reached ground
  let w = 800, hgt = 600;
  let focus = -1, selected = null; // a folder's index (-1: the whole map); a note's id
  let viewed = false, userMoved = false, left = false;
  let noteAt = new Map(); // a note's place among the layout's items, by its id in the bundle
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
    const oo = { ...o, gridFlow: flowFor(wide) }, plain = plainModel(model, !!o.folderless), k = gridKey(plain, oo);
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
    // Folderless: a layout with no folders in it. Each note keeps its top-level folder, as a colour on its edge.
    flat = !!o.folderless && !L.items.some((n) => n.kind === "folder");
    folderOf = new Map(); folderList = [];
    if (flat) {
      const tops = model.root.children.filter((n) => n.kind === "dir").sort((a, b) => (a.ref < b.ref ? -1 : 1));
      tops.forEach((d, k) => {
        let count = 0;
        const walk = (n) => { if (n.kind === "dir") n.children.forEach(walk); else { folderOf.set(n.id, k); count++; } };
        walk(d);
        folderList.push({ label: d.label, count, k });
      });
    }
    legend.hidden = !flat || !folderList.length;
    folderRows.replaceChildren(...folderList.map((f) => h("li", {}, h("i", { class: `f${f.k % 8}` }), h("span", {}, f.label), h("span", { class: "n" }, String(f.count)))));
    L.items.forEach((n, i) => { if (n.kind === "note") for (const p of up[i]) noteCount[p]++; });
    cache = null; drawn = []; tones = null;
    status.hidden = true;
    needsOf = L.items.map(() => []); neededBy = L.items.map(() => []);
    for (const l of L.links) if (l.s >= 2) { needsOf[l.a].push(l.b); neededBy[l.b].push(l.a); }
    ownPath = new Map((L.trunks || []).filter((t) => t.pts).map((t) => [t.a + "|" + t.b, t.pts]));
    hot = null; hotFor = null; lights.clear();
    // A new layout numbers its items afresh: what is drawn is keyed by those numbers, so it is drawn again from
    // nothing, and what was pointed at or selected in the last one may not be in this one (Notes to Code).
    if (!first) for (const g of [gFloor, gWalls, gRoutes, gHot, gCounts, gNotes, gTitles]) g.selectAll("*").remove();
    hovered = -1;
    if (selected && !L.items.some((n) => n.id === selected)) { selected = null; fillCard(); }
    noteAt = new Map(L.items.map((n, i) => [n.ref, i]).filter(([, i]) => L.items[i].kind === "note"));
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
    fillCard();
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
    const sig = `${o.hideImplied}|${o.feeders}|${Array.from(open).join("")}`;
    if (cache?.sig === sig) return;
    const fixed = [], asks = [];
    let links = 0;
    for (const t of L.trunks) {
      if (!shown[t.a] || !shown[t.b] || (t.implied && o.hideImplied)) continue;
      links += t.count;
      if (t.pts) fixed.push({ a: t.a, b: t.b, count: t.count, cls: "dag", pts: t.pts, lane: 0 });
      else asks.push({ a: t.a, b: t.b, count: t.count, cls: "solo" + (t.back ? " back" : "") });
    }
    const trunkCount = fixed.length;
    // Feeders: inside an open folder, where a trunk's links come from (layout.js `feeders`).
    if (o.feeders) (L.feeders || []).forEach((f, k) => {
      const t = L.trunks[f.trunk];
      if (open[f.folder] && shown[f.item] && shown[t.a] && shown[t.b]) fixed.push({ key: "f" + k, a: f.item, b: f.folder, count: f.count, cls: "dag feed", pts: f.pts, lane: f.lane });
    });
    const mine = cache = { sig, asks, fixed, links, trunks: trunkCount + asks.length, measures: null };
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
    const sig = (at < 0 && trail ? "trail" + atStop : at) + "|" + key + "|" + Array.from(open).join("");
    if (sig === hotFor) return;
    hotFor = sig;
    if ((at < 0 && !trail) || !o.showLinks) { hot = null; return; }
    if (lights.has(sig)) { hot = lights.get(sig); hot.since = performance.now(); return; }
    const shownAs = (i) => { for (let k = up[i].length - 1; k >= 0; k--) if (!open[up[i][k]]) return up[i][k]; return i; };
    const notes = new Set(), pairs = [], far = new Map(); // far: how many links from the note pointed at
    if (at < 0) {
      // A study path: the links among its notes. A tour: from each stop to the next.
      const on = trail.map((id) => noteAt.get(id)).filter((i) => i !== undefined), set = new Set(on);
      for (const i of on) notes.add(i);
      if (tour) for (let k = 1; k < on.length; k++) pairs.push([on[k], on[k - 1], "hot req"]);
      else for (const l of L.links) if (l.s >= (model.hasRatings ? 3 : 2) && set.has(l.a) && set.has(l.b)) pairs.push([l.a, l.b, "hot req"]);
    } else {
      const home = L.items[at].parent, todo = [at];
      far.set(at, 0);
      for (let k = 0; k < todo.length; k++) { // nearest first, so each note's distance is its least
        const a = todo[k];
        for (const b of needsOf[a]) {
          const inside = L.items[b].parent === home;
          if (!inside && a !== at) continue;
          pairs.push([a, b, a === at ? "hot req" : "hot req far", far.get(a)]); // far: not required by the note itself, but by what it requires
          notes.add(b);
          if (!far.has(b)) { far.set(b, far.get(a) + 1); if (inside) todo.push(b); }
        }
      }
      for (const a of neededBy[at]) { pairs.push([a, at, "hot dep", 0]); notes.add(a); if (!far.has(a)) far.set(a, 1); }
    }
    const routes = [], asks = [];
    // Each is drawn away from the note pointed at. The layout's own path runs
    // from what is required to what requires it; the router's, the other way.
    for (const [a, b, cls, depth = 0] of pairs) {
      const sa = shownAs(a), sb = shownAs(b), own = sa === a && sb === b && ownPath.get(a + "|" + b), req = cls.startsWith("hot req");
      if (sa === sb) continue;
      const key = `${at}:${cls}${a}|${b}`; // one drawing of this link for this note, so it is drawn afresh for another
      if (own) routes.push({ key, a, b, cls, depth, rev: req, pts: own, lane: 0 });
      else asks.push({ key, a: sa, b: sb, cls, depth, rev: !req });
    }
    const here = tour ? noteAt.get(goalId()) : undefined;
    const mine = hot = { at: at >= 0 ? at : here ?? -1, notes, far, routes, drawn: at >= 0 };
    mine.since = performance.now();
    if (lights.size > 400) lights.clear();
    lights.set(sig, mine);
    if (!asks.length) return;
    computeGridRoutes(key, L, asks.map(({ a, b }) => ({ a, b }))).then((res) => {
      if (left) return;
      mine.routes = [...routes, ...asks.map((m, k) => res.routes[k] && { ...m, pts: res.routes[k].pts, lane: 0 }).filter(Boolean)];
      if (hot === mine) schedule();
    });
  }

  // What you have not reached, hidden when you choose (understanding.svelte.ts):
  // a note, unless it is reached, on the frontier or on the path being shown; a folder holding none.
  const hiddenFromYou = (n) => !model.code && understanding.hiding && !step.has(n.ref) && !(n.kind === "note" ? understanding.visible(n.ref) : understanding.folderVisible(n.ref));

  // ------------------------------------------------------------ selection

  const plural = (k, one, many = one + "s") => `${k} ${k === 1 ? one : many}`;
  function fillCard() {
    const i = selected ? L.items.findIndex((n) => n.id === selected) : -1;
    card.hidden = i < 0;
    if (i < 0) return;
    const ref = L.items[i].ref, label = nodes.get(selected)?.label || ref;
    if (nodes.get(selected)?.code) return fillCodeCard(nodes.get(selected).code);
    const st = understanding.state(ref)?.state, needs = needsWork().has(ref);
    const reqs = needsOf[i].length, builds = neededBy[i].length;
    const where = needs ? "Needs work." : st ? `${STATE_LABEL[st]}.` : "";
    const exercises = exerciseNotes().filter((e) => testsOf(e).includes(ref));
    const open = h("a", { class: "toggle primary", href: conceptHref(ref) }, "Open the note");
    open.addEventListener("click", () => persist());
    const close = h("button", { class: "atlas-card-close", type: "button", "aria-label": "Close" }, "×");
    close.addEventListener("click", () => select(null));
    card.className = `atlas-card ${needs ? "card-red" : st === "understood" ? "card-green" : ""}`;
    card.setAttribute("aria-label", label);
    card.replaceChildren(
      h("h3", {}, label), close,
      h("p", {}, `${where} Requires ${plural(reqs, "note")}; ${plural(builds, "note")} ${builds === 1 ? "builds" : "build"} on it.`),
      h("div", { class: "atlas-card-actions" }, open,
        exercises.length ? h("a", { class: "toggle", href: conceptHref(exercises[0].id) }, exercises.length === 1 ? "Exercise" : `Exercises (${exercises.length})`) : "",
        reqs ? h("a", { class: "toggle", href: "#/path/" + ref, title: "This note and everything it requires, in reading order" }, "Study path") : ""));
  }

  // A code item's card (T66): what it is, where, and its links by kind.
  function fillCodeCard(i) {
    const map = codeMap();
    const count = (list) => { const k = {}; for (const [, , kind] of list ?? []) k[kind] = (k[kind] || 0) + 1; return k; };
    const outs = count(map.out.get(i.id)), ins = count(map.into.get(i.id));
    const words = [...Object.entries(outs).map(([k, v]) => `${LINK_LABEL[k][0].toLowerCase()} ${v}`), ...Object.entries(ins).map(([k, v]) => `${LINK_LABEL[k][1].toLowerCase()} ${v}`)];
    const notes = map.notes.get(i.id) ?? [];
    const open = h("a", { class: "toggle primary", href: codeHref(i.id) }, "Open");
    open.addEventListener("click", () => persist());
    const close = h("button", { class: "atlas-card-close", type: "button", "aria-label": "Close" }, "×");
    close.addEventListener("click", () => select(null));
    card.className = "atlas-card";
    card.setAttribute("aria-label", i.name);
    card.replaceChildren(
      h("h3", {}, i.name), close,
      h("p", {}, `${KIND_LABEL[i.kind]} in ${i.path}${i.line ? `:${i.line}` : ""}.${words.length ? " " + words.join(", ").replace(/^./, (c) => c.toUpperCase()) + "." : ""}`),
      h("div", { class: "atlas-card-actions" }, open, ...notes.slice(0, 2).map((c) => h("a", { class: "toggle", href: conceptHref(c.id) }, c.title))));
  }

  // ------------------------------------------------------------ study paths and tours

  // Step numbers: on each note of the path, and on each closed folder holding
  // some of it (as the steps inside, e.g. 3–5).
  function drawSteps(items, shown, open, X, Y, c) {
    const badges = [];
    if (trail) {
      const inside = new Map(); // closed folder -> the steps in it
      for (const [ref, k] of step) {
        const i = noteAt.get(ref);
        if (i === undefined) continue;
        if (shown[i]) { badges.push({ id: items[i].id, x: X(items[i].gx), y: Y(items[i].gy), text: String(k), last: ref === goalId() }); continue; }
        const f = up[i].find((p) => shown[p] && !open[p]);
        if (f !== undefined) inside.set(f, [...(inside.get(f) || []), k]);
      }
      const end = tour ? step.get(goalId()) : trail.length;
      for (const [f, ks] of inside) badges.push({ id: items[f].id, x: X(items[f].gx + items[f].w) - c, y: Y(items[f].gy) + c, text: spans(ks.sort((a, b) => a - b)), last: ks.includes(end) });
    }
    gSteps.selectAll("g").data(badges, (b) => b.id).join((enter) => { const g = enter.append("g"); g.append("rect"); g.append("text"); return g; })
      .attr("class", (b) => `m-step${b.last ? " goal" : ""}`)
      .attr("transform", (b) => `translate(${b.x},${b.y})`)
      .each(function (b) {
        const g = d3.select(this), width = Math.max(16, b.text.length * 6.6 + 8);
        g.select("rect").attr("x", -width / 2).attr("y", -8).attr("width", width).attr("height", 16).attr("rx", 8);
        g.select("text").attr("y", 4).text(b.text);
      });
  }
  function spans(nums) {
    const out = [];
    for (let i = 0; i < nums.length; i++) {
      let j = i;
      while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
      out.push(j > i ? `${nums[i]}–${nums[j]}` : String(nums[i]));
      i = j;
    }
    return out.length > 3 ? out.slice(0, 3).join(", ") + "…" : out.join(", ");
  }
  // Show a note of the path: zoom to its folder and light what it depends on.
  function show(id) {
    const i = noteAt.get(id);
    if (i === undefined) return;
    zoomTo(L.items[i].parent);
    point(i);
  }

  // The list of steps beside the map; choosing one zooms to where it is.
  function trailCard() {
    const narrowNow = matchMedia("(max-width: 760px), (max-height: 560px)").matches;
    const list = h("ol", { class: "trail-steps" }, trail.map((id) => {
      const c = store.concepts.get(id);
      const b = h("button", { type: "button", title: "Show on the map" }, c.title);
      b.addEventListener("click", () => show(id));
      return h("li", { class: id === path ? "goal" : null }, b,
        h("a", { href: conceptHref(id), "aria-label": `Open ${c.title}`, title: "Open the note" }, "open"));
    }));
    const close = h("a", { class: "trail-close", href: "#/map", "aria-label": "Close the study path" }, "×");
    return h("details", { class: "trail-card", open: !narrowNow },
      h("summary", {}, `Study path to ${goal.title}`, h("span", { class: "count" }, trail.length)),
      h("p", { class: "section-note" }, trail.length > 1
        ? "Read in this order: each note comes after the notes it requires."
        : "Nothing is marked as required before this note."),
      list, close);
  }

  // A tour's card: where you are, its narration, and the way on.
  function tourCard() {
    const last = tour.stops.length - 1;
    const counter = h("p", { class: "tour-count" });
    const title = h("h3", { class: "tour-stop" });
    const narration = h("div", { class: "tour-narration" });
    const prev = h("button", { class: "toggle", type: "button" }, "Previous");
    const next = h("button", { class: "toggle", type: "button" }, "Next");
    const open = h("a", { class: "tour-open", title: "Open the note (Back returns to the tour)" }, "Open the note");
    const stops = tour.stops.map((st, i) => {
      const b = h("button", { type: "button" }, st.title);
      b.addEventListener("click", () => go(i));
      return h("li", {}, b);
    });
    const all = h("details", { class: "tour-all" }, h("summary", {}, "All stops"), h("ol", { class: "trail-steps" }, stops));
    const close = h("a", { class: "trail-close", href: tour.back || "#/learn", "aria-label": "Leave the tour" }, "×");
    prev.addEventListener("click", () => go(atStop - 1));
    next.addEventListener("click", () => (atStop === last ? tour.onFinish?.() : go(atStop + 1)));
    const tell = () => {
      const st = tour.stops[atStop];
      counter.textContent = `Stop ${atStop + 1} of ${tour.stops.length}`;
      title.textContent = st.title;
      narration.innerHTML = st.text ? tour.narrate(st.text) : "";
      prev.disabled = atStop === 0;
      next.textContent = atStop === last ? "Finish" : "Next";
      open.hidden = !st.id;
      if (st.id) open.href = conceptHref(st.id);
      stops.forEach((li, i) => li.classList.toggle("goal", i === atStop));
    };
    function go(i) {
      if (i < 0 || i > last) return;
      atStop = i;
      tell();
      tour.onStep?.(i);
      const at = onMap(goalId()) ? noteAt.get(goalId()) : undefined;
      if (at !== undefined && L) zoomTo(L.items[at].parent);
      hotFor = null;
      schedule();
    }
    const el = h("section", { class: "trail-card tour-card", "aria-label": `Tour: ${tour.title}`, tabindex: "-1" },
      h("p", { class: "tour-name" }, tour.title), counter, title, narration, h("div", { class: "tour-nav" }, prev, next, open), all, close);
    el.addEventListener("keydown", (e) => {
      if (e.target.closest?.("summary, a")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next.click(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev.click(); }
    });
    tell();
    queueMicrotask(() => tour.onStep?.(atStop));
    return el;
  }
  if (trail) wrap.append(tour ? tourCard() : trailCard());

  // A view that holds every note on the path.
  function trailFit() {
    const on = trail.map((id) => noteAt.get(id)).filter((i) => i !== undefined).map((i) => L.items[i]);
    if (!on.length) return null;
    const x0 = Math.min(...on.map((n) => n.gx)) - 2, x1 = Math.max(...on.map((n) => n.gx + n.w)) + 2;
    const y0 = Math.min(...on.map((n) => n.gy)) - 2, y1 = Math.max(...on.map((n) => n.gy + n.h)) + 2, left = inset();
    const k = Math.min(1.6, (w - left) / ((x1 - x0) * CELL), hgt / ((y1 - y0) * CELL)) * 0.94;
    return d3.zoomIdentity.translate(left + (w - left) / 2 - (k * (x0 + x1) * CELL) / 2, hgt / 2 - (k * (y0 + y1) * CELL) / 2).scale(k);
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
      shown[i] = (n.parent < 0 || open[n.parent]) && !hiddenFromYou(n) ? 1 : 0;
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
    svg.classed("lit", !!hot).classed("trail", !!trail);
    drawSteps(items, shown, open, X, Y, c);
    const laneStep = Math.max(2.2, Math.min(5, c / 4.2));
    const line = (m) => cutPath(offsetLine(m.pts.map(([x, y]) => [X(x), Y(y)]), m.lane * laneStep), c * 0.9);
    const width = (m) => 1 + Math.log2(m.count) * 0.8;
    gRoutes.selectAll("g").data(drawn, (m) => m.key || m.cls[0] + m.a + "|" + m.b).join((el) => { const g = el.append("g"); g.append("path").attr("class", "g-halo"); g.append("path").attr("class", "g-rt"); return g; })
      .attr("class", (m) => m.cls)
      .each(function (m) {
        const d = line(m), g = d3.select(this);
        g.select(".g-halo").attr("d", d).attr("stroke-width", width(m) + 3.5);
        g.select(".g-rt").attr("d", d).attr("stroke-width", width(m));
      });
    // What the note pointed at depends on is drawn out from it: each link in
    // turn, nearest first, then (below) the frame of the note it reaches.
    const animate = !!hot?.drawn && !reduceMotion;
    // (Keyed by the route's own key: d3 also asks the key of what is being taken away, when nothing is lit.)
    gHot.selectAll("path").data(hot ? hot.routes : [], (m) => m.key)
      .join((enter) => enter.append("path").attr("class", (m) => "g-rt " + m.cls).property("fresh", true))
      .attr("d", line)
      .each(function (m) {
        if (!this.fresh) return;
        this.fresh = false;
        if (!animate) return;
        this.style.setProperty("--len", this.getTotalLength().toFixed(1));
        this.style.setProperty("--delay", `${m.depth * STEP_MS}ms`);
        this.classList.add("draw");
        if (m.rev) this.classList.add("rev");
        this.addEventListener("animationend", () => this.classList.remove("draw", "rev"), { once: true });
      });
    // A trunk's count, where it runs between its two folders.
    const counted = drawn.filter((m) => m.count > 1);
    gCounts.selectAll("text").data(counted, (m) => m.key || m.cls[0] + m.a + "|" + m.b).join("text").attr("class", (m) => (m.cls.includes("feed") ? "g-count feed" : "g-count"))
      .attr("x", (m) => X(m.pts[m.pts.length >> 1][0])).attr("y", (m) => Y(m.pts[m.pts.length >> 1][1]) + 4).text((m) => m.count);

    // Notes: a block with the glyph for its kind, and its title once there is room.
    const notes = items.map((n, i) => i).filter((i) => items[i].kind === "note" && shown[i] && onScreen(items[i]));
    const labels = c >= LABELS_AT;
    const station = document.documentElement.dataset.theme === "station";
    gNotes.selectAll("g").data(notes, (i) => items[i].id).join("g")
      .attr("class", (i) => `gn l${level[i]}${needs.has(items[i].ref) ? " bad" : ""}${items[i].id === selected ? " sel" : ""}${hot?.notes.has(i) ? ((hot.far.get(i) ?? 1) > 1 ? " dep far" : " dep") : ""}${hot?.at === i ? " at" : ""}${trail && !step.has(items[i].ref) ? " off" : ""}${nodes.get(items[i].id)?.landmark ? " landmark" : ""}`)
      .attr("tabindex", 0).attr("role", "link").attr("aria-label", (i) => nodes.get(items[i].id)?.label || items[i].ref)
      .on("click", (event, i) => { event.stopPropagation(); if (selected === items[i].id) openNote(i); else select(items[i].id); })
      .on("dblclick", (event, i) => { event.stopPropagation(); openNote(i); })
      .on("keydown", (event, i) => { if (event.key === "Enter") openNote(i); else if (event.key === " ") { event.preventDefault(); select(items[i].id); } })
      .on("pointerenter", (event, i) => { enter(event, i); point(i); }).on("pointerleave", () => { leave(); point(-1); })
      .each(function (i) {
        const n = items[i], d = nodes.get(n.id), g = d3.select(this), l = level[i];
        const x0 = X(n.gx), y0 = Y(n.gy), bw = n.w * c, bh = n.h * c;
        g.selectAll("*").remove();
        const frame = cut(x0, y0, x0 + bw, y0 + bh, Math.min(8, c * 0.7), Math.min(1.5, c * 0.15));
        g.append("path").attr("class", "gn-block").attr("d", frame);
        if (flat && folderOf.has(n.id)) { // its folder, as a strip of colour down its first edge
          const sw = Math.max(2.5, Math.min(6, c * 0.6)), inset = Math.min(8, c * 0.7) * 0.6;
          g.append("path").attr("class", `gn-folder f${folderOf.get(n.id) % 8}`).attr("d", `M${(x0 + 1).toFixed(1)} ${(y0 + inset).toFixed(1)}h${sw.toFixed(1)}V${(y0 + bh - inset).toFixed(1)}h${(-sw).toFixed(1)}z`);
        }
        if (hot && (hot.notes.has(i) || hot.at === i)) {
          // Lit: a frame in the blue pen, drawn round the note once the link to it has arrived.
          const ring = g.append("path").attr("class", (hot.far.get(i) ?? 1) > 1 ? "gn-ring far" : "gn-ring").attr("d", frame).node(), due = hot.since + ((hot.far.get(i) ?? 0) * STEP_MS + (hot.at === i ? 0 : DRAW_MS));
          if (animate && hot.at !== i && performance.now() < due) { // one already under way is shown whole, not begun again
            ring.style.setProperty("--len", ring.getTotalLength().toFixed(1));
            ring.style.setProperty("--delay", `${Math.max(0, due - performance.now())}ms`);
            ring.classList.add("draw");
          }
        }
        if (l === 3 && lens !== "activity" && bw > 14) g.append("path").attr("class", "gn-ok").attr("d", `M${(x0 + 5).toFixed(1)} ${(y0 + bh - 5.5).toFixed(1)}h${(bw - 10).toFixed(1)}M${(x0 + 5).toFixed(1)} ${(y0 + bh - 8.5).toFixed(1)}h${(bw - 10).toFixed(1)}`);
        // The title fills the block: the largest size at which it fits, wrapped
        // to the block's width with room left for the glyph of its kind; at the
        // smallest size it is cut short where it does not fit.
        const foot = l === 3 && lens !== "activity" ? 9 : 0; // the double green rule
        let fit = null;
        if (labels && d) {
          const words = String(d.label).split(/\s+/), wide = station ? 0.7 : 0.62; // a letter's width over the size (Station sets capitals)
          const wrap = (size) => {
            const mark = size * 0.9 + 10, per = Math.floor((bw - 14 - mark) / (size * wide)), most = Math.max(1, Math.floor((bh - 8 - foot) / (size * 1.2)));
            const lines = [];
            let cur = "", whole = true;
            for (let word of words) {
              if (word.length > per) { word = word.slice(0, Math.max(1, per - 1)) + "…"; whole = false; }
              if (cur && (cur + " " + word).length > per) { lines.push(cur); cur = word; } else cur = cur ? cur + " " + word : word;
            }
            lines.push(cur);
            return { size, per, most, lines, whole: whole && lines.length <= most };
          };
          for (let size = Math.min(48, Math.floor(bh * 0.42)); size >= LABEL_MIN && !fit; size--) { const t = wrap(size); if (t.whole) fit = t; }
          if (!fit) {
            fit = wrap(LABEL_MIN);
            if (fit.per < 4) fit = null;
            else if (fit.lines.length > fit.most) fit.lines = [...fit.lines.slice(0, fit.most - 1), fit.lines.slice(fit.most - 1).join(" ").slice(0, fit.per - 1) + "…"];
          }
        }
        if (c >= 4) {
          const shape = d?.marker || "circle", r = fit ? Math.max(3.8, fit.size * 0.36) : Math.min(3.6, c * 0.42);
          const kx = fit ? x0 + bw - r - 8 : x0 + bw / 2, ky = y0 + bh / 2 - (foot ? 2 : 0);
          g.append("path").attr("class", "g-kind").attr("transform", `translate(${kx.toFixed(1)},${ky.toFixed(1)})`).attr("d", d3.symbol(SYMBOLS[shape], r * r * 3)());
          if (shape === "ring") g.append("path").attr("class", "g-kind").attr("d", `M${(kx - r).toFixed(1)} ${ky.toFixed(1)}h${(2 * r).toFixed(1)}`);
        }
        if (fit) {
          const step = fit.size * 1.2, top = y0 + (bh - foot - fit.lines.length * step) / 2 + fit.size * 0.95; // the lines centred in the block
          const text = g.append("text").attr("class", "g-note").style("font-size", `${fit.size}px`);
          fit.lines.forEach((line, k) => text.append("tspan").attr("x", (x0 + (flat ? 11 : 8)).toFixed(1)).attr("y", (top + k * step).toFixed(1)).text(line));
        }
      });

    placeTip(X, Y);

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
      summary.textContent = `${cache.links} links, as ${cache.trunks} trunks` + (backs ? `, ${backs} of them against the layers (dashed).` : ".") + " Point at a note for what it depends on.";
    }
    readout.textContent = `Grid ${L.W} by ${L.H} cells, flowing ${L.flow}.` + (m ? ` Routes ${m.routes}, crossings ${m.crossings}, cells of route ${m.length}, beside another route ${Math.round(m.beside * 100)}%${m.lost ? `, no way found for ${m.lost}` : ""}.` : "");
  }

  function openNote(i) {
    persist();
    location.hash = model.code ? codeHref(L.items[i].ref) : conceptHref(L.items[i].ref);
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
      lines.push(h("span", {}, d.code ? `${d.c.type} in ${d.code.path}` : `${d.c.type || "Concept"} · ${TRUST_LABEL[trustState(d.c)]}${d.landmark ? " · Landmark" : ""}`));
      if (flat && d.c.directory) lines.push(h("div", {}, `In ${d.c.directory}`));
      if (d.c.description) lines.push(h("div", {}, d.c.description));
    } else lines.push(h("span", {}, `${d.code ? KIND_LABEL[d.code.kind] : "Folder"} · ${noteCount[i]} ${model.code ? "item" : "note"}${noteCount[i] === 1 ? "" : "s"}`));
    tip.replaceChildren(...lines);
    const box = wrap.getBoundingClientRect();
    tip.style.left = `${Math.min(event.clientX - box.left + 14, box.width - 290)}px`;
    tip.style.top = `${event.clientY - box.top + 14}px`;
    tip.hidden = false;
  }

  // A note's tip sits beside the note, not under the pointer, in the nearest place that covers none of what
  // is lit for it (the notes it depends on and that build on it), nor the panels: below it or above, to
  // either side, then further out. Where every place covers something, the one that covers least.
  function placeTip(X, Y) {
    const n = hovered >= 0 ? L.items[hovered] : null;
    if (tip.hidden || !n || n.kind !== "note") return;
    const box = (i) => { const m = L.items[i]; return [X(m.gx) - 3, Y(m.gy) - 3, X(m.gx + m.w) + 3, Y(m.gy + m.h) + 3]; };
    const at = wrap.getBoundingClientRect();
    const fixed = [panel, crumbs, legend, card].filter((el) => !el.hidden && el.offsetWidth).map((el) => { const r = el.getBoundingClientRect(); return [r.left - at.left, r.top - at.top, r.right - at.left, r.bottom - at.top]; });
    const avoid = [box(hovered), ...(hot ? [...hot.notes].filter((i) => L.items[i]).map(box) : []), ...fixed];
    const [x0, y0, x1, y1] = box(hovered), tw = tip.offsetWidth, th = tip.offsetHeight;
    const covered = (x, y) => avoid.reduce((t, [a, b, c2, d]) => t + Math.max(0, Math.min(x + tw, c2) - Math.max(x, a)) * Math.max(0, Math.min(y + th, d) - Math.max(y, b)), 0);
    let best = null;
    for (let ring = 0; ring < 5 && !(best && best.cost === 0); ring++) {
      const gx = 8 + ring * (tw * 0.5 + 12), gy = 8 + ring * (th * 0.6 + 12);
      for (const [x, y] of [[x0, y1 + gy], [x1 - tw, y1 + gy], [x0, y0 - th - gy], [x1 - tw, y0 - th - gy], [x1 + gx, y0], [x0 - tw - gx, y0], [x1 + gx, y1 - th], [x0 - tw - gx, y1 - th],
        [x1 + gx, y1 + gy], [x0 - tw - gx, y1 + gy], [x1 + gx, y0 - th - gy], [x0 - tw - gx, y0 - th - gy]]) {
        const px = Math.max(8, Math.min(w - tw - 8, x)), py = Math.max(8, Math.min(hgt - th - 8, y));
        const cost = covered(px, py);
        if (!best || cost < best.cost) best = { x: px, y: py, cost };
        if (cost === 0) break;
      }
    }
    tip.style.left = `${Math.round(best.x)}px`;
    tip.style.top = `${Math.round(best.y)}px`;
  }

  function size() {
    const rect = wrap.getBoundingClientRect();
    w = rect.width || 800; hgt = rect.height || 600;
    back.attr("width", w).attr("height", hgt);
  }

  function initialView() {
    if (!L) return;
    const target = focusRef ? L.items.findIndex((n) => n.id === "d:" + focusRef) : -1;
    const onTrail = trail && trailFit();
    if (onTrail) svg.call(zoom.transform, onTrail);
    else if (target >= 0) svg.call(zoom.transform, fit(target));
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
  // The panel's Notes or Code, or folders or none: another map, so shown whole, with a panel made for it
  // (the kinds in its key and the lenses it offers depend on what is mapped).
  M.resource = () => {
    userMoved = false;
    wrap.refresh();
    const next = makePanel(), more = next.querySelector(".map-more");
    if (more) more.open = !!panel.querySelector(".map-more")?.open;
    panel.replaceWith(next);
    panel = next;
  };
  wrap.routes = () => drawn; // for tests and inspection
  wrap.layout = () => L;
  wrap.model = () => model;
  wrap.measures = () => cache?.measures || null;
  return wrap;
}
