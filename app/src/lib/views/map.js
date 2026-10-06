// The Atlas's model, settings and panel: what the map is made of (the folder
// tree and the links between notes, with their ratings), the choices kept in
// this browser over the project's `[map]` table in rdstudio.toml, the height
// lenses, and the lens panel. The drawing is gridmap.js. See
// knowledge/design/map-view.md.

import * as d3 from "d3";
import { OFF_MAP, isStudyNote } from "@rdstudio/core/learning";
import { store } from "../data.svelte.ts";
import { titleCase } from "../format.ts";
import { h } from "./dom.js";
import { understanding } from "../understanding.svelte.ts";
import { exerciseNotes, testsOf } from "../exercises.ts";
import { projectMode } from "../shell.svelte.ts";
import { codeMap, healthOf, KIND_LABEL } from "../code.ts";

const KEY = "rdstudio.map";

// The settings, each also settable per project under [map] in rdstudio.toml.
export const VIEW_DEFAULTS = {
  detail: 60, // a folder opens when it is this many pixels wide on screen
  showLinks: true, // the Links lens: the trunks between the items of each open folder
  terrain: true, // tone the ground and the notes by the height lens
  height: null, // the height lens: "understanding", "activity" or "health"; by default understanding, or activity in project mode
  hideImplied: true, // leave out a link that a longer way already makes
  feeders: true, // inside a folder, branches from its items to the foot of each trunk that ends on it (T72)
  source: null, // what is mapped: "notes" (the default), or "code" (T66) when the code is indexed
  folderless: false, // the whole base as one DAG, with no folders; each note carries its folder's colour (T71)
  panelOpen: null, // the lens panel: open, or folded to its bar; by default open where there is room
  foldersOpen: true, // the folderless view's list of folders and their colours: open, or folded to its heading
  // The top level runs "up", "right", or "auto" (up; right on a phone on its
  // side); the levels inside it turn in turn (T64).
  gridFlow: "auto",
};
// How consequential a link is, from its Markdown title ("requires", "uses", "see also").
const STRENGTH = { requires: 3, uses: 2, "see also": 1 };

// Marker shape per concept type (lower case). Projects override or extend this
// under [map.markers] in rdstudio.toml; unknown types are circles.
export const MARKERS = {
  definition: "circle", theorem: "diamond", lemma: "diamond", proposition: "diamond", corollary: "diamond",
  example: "triangle", trick: "square", reference: "ring", overview: "star",
  decision: "square", task: "triangle", question: "cross", idea: "wye", procedure: "star",
  // The code map's items (T66).
  function: "circle", method: "circle", class: "square", field: "triangle", constant: "diamond", target: "star", job: "star", file: "ring", dir: "ring",
};
export const SYMBOLS = {
  circle: d3.symbolCircle, diamond: d3.symbolDiamond, triangle: d3.symbolTriangle, square: d3.symbolSquare,
  star: d3.symbolStar, cross: d3.symbolCross, wye: d3.symbolWye, ring: d3.symbolCircle,
};

const saved = (() => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
})();

// User choices (this browser) layered over project defaults over built-in defaults.
export const M = { user: saved.user || saved.opts || {} };

function projectMap() {
  return store.site.map || {};
}

export function effective() {
  const project = Object.fromEntries(Object.entries(projectMap()).filter(([k]) => k !== "markers"));
  return Object.assign({}, VIEW_DEFAULTS, project, M.user);
}

// ------------------------------------------------------------ height lenses

// What the terrain's height means (T59): where you stand (understanding, 0
// not reached to 3 understood), how recently a note changed (activity: this
// week, this month, this quarter; 90 days untouched is fog), or how settled
// it is (health: one step each for reviewed by a person, tested by an
// exercise, and current, neither its checks nor its content stale).
export const LENSES = { understanding: "Understanding", activity: "Activity", health: "Health" };
const LEVEL = { undiscovered: 0, discovered: 1, processed: 2, understood: 3 };
/** What the Atlas maps: the notes, or the code (T66). */
export function sourceOf(o) {
  if (!store.code) return "notes";
  return o.source === "code" ? "code" : "notes"; // the Atlas is the knowledge base's map; the code is there when asked for
}
export function heightLens(o) {
  const lens = LENSES[o.height] ? o.height : projectMode() === "Project" ? "activity" : "understanding";
  return lens === "understanding" && (!understanding.on || sourceOf(o) === "code") ? "activity" : lens;
}
let changesSeen = null, changedAt = new Map();
function lastChanged() {
  if (changesSeen === store.changes) return changedAt;
  changesSeen = store.changes;
  changedAt = new Map();
  for (const c of store.changes.commits) {
    const t = c.pending || !c.date ? Date.now() : Date.parse(c.date);
    for (const f of c.files) if (!(changedAt.get(f.path) >= t)) changedAt.set(f.path, t);
  }
  return changedAt;
}
let testedSeen = null, testedSet = new Set();
function tested() {
  if (testedSeen === store.concepts) return testedSet;
  testedSeen = store.concepts;
  testedSet = new Set(exerciseNotes().flatMap(testsOf));
  return testedSet;
}
export function lensValue(lens, c) {
  if (lens === "understanding") return LEVEL[understanding.state(c.id)?.state] ?? 0;
  if (c.code && lens === "health") { const map = codeMap(); return map ? healthOf(map, c.code) : 0; }
  if (lens === "activity") {
    const t = c.code ? lastChanged().get(c.code.path) ?? 0 : lastChanged().get(store.site.knowledge + "/" + c.path) ?? c.mtime * 1000;
    const days = (Date.now() - t) / 86400000;
    return days <= 7 ? 3 : days <= 30 ? 2 : days <= 90 ? 1 : 0;
  }
  return (c.trust === "human-reviewed" ? 1 : 0) + (tested().has(c.id) ? 1 : 0) + (!c.verification_stale && !c.content_stale ? 1 : 0);
}

function markerFor(type) {
  const custom = Object.fromEntries(Object.entries(projectMap().markers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const shape = custom[String(type || "").toLowerCase()] || MARKERS[String(type || "").toLowerCase()] || "circle";
  return SYMBOLS[shape] ? shape : "circle";
}


/** Keep one of this browser's choices (the views keep a few of their own: a legend open or shut). */
export function remember(key, value) {
  M.user[key] = value;
  persist();
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ user: M.user })); } catch { /* storage unavailable */ }
}

// --------------------------------------------------------------- model

function pagerank(ids, edges, damping = 0.85, rounds = 40) {
  const n = ids.length;
  const out = new Map(ids.map((id) => [id, []]));
  for (const [a, b] of edges) out.get(a).push(b);
  let rank = new Map(ids.map((id) => [id, 1 / n]));
  for (let i = 0; i < rounds; i++) {
    const next = new Map(ids.map((id) => [id, (1 - damping) / n]));
    let dangling = 0;
    for (const id of ids) {
      const targets = out.get(id);
      if (!targets.length) { dangling += rank.get(id); continue; }
      const share = damping * rank.get(id) / targets.length;
      for (const t of targets) next.set(t, next.get(t) + share);
    }
    for (const id of ids) next.set(id, next.get(id) + damping * dangling / n);
    rank = next;
  }
  return rank;
}

// Order notes so that linked notes are packed next to each other: start from
// the most important, then repeatedly take the note most linked to the last few.
function chainOrder(leaves, adjacent) {
  const left = [...leaves].sort((a, b) => b.weight - a.weight);
  const order = [];
  while (left.length) {
    let best = 0, bestScore = -1;
    const recent = order.slice(-3);
    left.forEach((leaf, i) => {
      const score = recent.reduce((s, r) => s + (adjacent.get(r.ref)?.has(leaf.ref) ? 1 : 0), 0);
      if (score > bestScore) { best = i; bestScore = score; }
    });
    order.push(left.splice(best, 1)[0]);
  }
  return order;
}

export function buildModel() {
  if (sourceOf(effective()) === "code") return buildCodeModel();
  // Tours are walks through the map, not places on it (understanding-layer.md).
  const concepts = [...store.concepts.values()].filter(isStudyNote);
  const ids = concepts.map((c) => c.id);
  const known = new Set(ids);
  // Directed links, each with its strongest rating: [from, to, strength].
  const strongest = new Map();
  let hasRatings = false;
  for (const c of concepts) {
    for (const l of c.links) {
      if (l.broken || l.kind !== "concept" || !known.has(l.target) || l.target === c.id) continue;
      if (l.rel) hasRatings = true;
      const key = c.id + "\n" + l.target;
      strongest.set(key, Math.max(strongest.get(key) || 0, STRENGTH[l.rel] || 2));
    }
  }
  const edges = [...strongest].map(([key, s]) => [...key.split("\n"), s]);
  const adjacent = new Map(ids.map((id) => [id, new Set()]));
  for (const [a, b] of edges) { adjacent.get(a).add(b); adjacent.get(b).add(a); }
  const rank = pagerank(ids, edges);
  const top = Math.max(...rank.values(), 1e-9);
  // How deep each note is in the chain of what it requires or uses: later in
  // the study order is deeper, and lies further north.
  const needs = new Map(ids.map((id) => [id, []]));
  for (const [a, b, s] of edges) if (s >= 2) needs.get(a).push(b);
  const depth = new Map();
  const depthOf = (id, seen = new Set()) => {
    if (depth.has(id)) return depth.get(id);
    if (seen.has(id)) return 0; // a cycle
    seen.add(id);
    const d = 1 + Math.max(-1, ...needs.get(id).map((b) => depthOf(b, seen)));
    depth.set(id, d);
    return d;
  };

  const dirs = new Map();
  for (const d of Object.values(store.tree)) {
    dirs.set(d.id, {
      kind: "dir", id: "d:" + d.id, ref: d.id, children: [],
      label: d.id ? titleCase(d.name) : store.site.title || "Knowledge",
    });
  }
  const leaves = new Map();
  for (const c of concepts) {
    const landmark = c.meta?.landmark === true;
    leaves.set(c.id, {
      kind: "concept", id: "c:" + c.id, ref: c.id, label: c.title, c, landmark, marker: markerFor(c.type),
      weight: 1 + 2.5 * (rank.get(c.id) / top) + (landmark ? 1.5 : 0), rank: depthOf(c.id),
    });
  }
  for (const d of Object.values(store.tree)) {
    const node = dirs.get(d.id);
    node.subdirs = d.children.map((id) => dirs.get(id)).filter(Boolean);
    node.notes = chainOrder(d.concepts.map((id) => leaves.get(id)).filter(Boolean), adjacent);
  }
  // Larger folders first packs more tidily; notes follow in link order.
  const size = (d) => d.notes.length + d.subdirs.reduce((s, x) => s + size(x), 0);
  // A folder holding only tours, goals and exercises (and nothing else below it) is left off too.
  const onlyTours = (id) => {
    const d = store.tree[id];
    return !!d && d.concepts.length > 0 && d.concepts.every((c) => OFF_MAP.has(store.concepts.get(c)?.type)) && d.children.every(onlyTours);
  };
  for (const node of dirs.values()) {
    node.children = [...node.subdirs.filter((x) => !onlyTours(x.ref)).sort((a, b) => size(b) - size(a)), ...node.notes];
  }
  return { root: dirs.get(""), edges, hasRatings };
}

// The code map as the Atlas's model (T66): directories, files and classes are
// folders; functions, methods, fields, constants, targets and jobs (and files
// or classes with nothing in them) are places. A link may end on a folder (a
// file imports a file). Every link counts but tests and builds, which are
// drawn like "see also" and do not shape the layout.
function buildCodeModel() {
  const map = codeMap();
  const root = { kind: "dir", id: "d:", ref: "", label: store.site.title || "Code", children: [] };
  const nodes = new Map();
  const container = (i) => i.kind === "dir" || (map.children.get(i.id)?.length ?? 0) > 0;
  const degree = new Map();
  for (const [a, b] of map.index.links) { degree.set(a, (degree.get(a) || 0) + 1); degree.set(b, (degree.get(b) || 0) + 1); }
  for (const i of map.index.items) {
    if (container(i)) nodes.set(i.id, { kind: "dir", id: "d:" + i.id, ref: i.id, label: i.name, code: i, children: [] });
    else nodes.set(i.id, {
      kind: "concept", id: "c:" + i.id, ref: i.id, label: i.name, code: i, landmark: false, marker: markerFor(i.kind), rank: 0,
      weight: 1 + Math.log2(1 + (degree.get(i.id) || 0)),
      c: { id: i.id, title: i.name, type: KIND_LABEL[i.kind], description: i.doc, trust: "unverified", verification_stale: false, content_stale: false, path: i.path, mtime: 0, links: [], backlinks: [], meta: {}, directory: i.parent ?? "", code: i },
    });
  }
  for (const i of map.index.items) (i.parent ? nodes.get(i.parent) : root).children.push(nodes.get(i.id));
  // A directory holding nothing but one directory is folded into it
  // (src/ and src/nanosim/ become src/nanosim): one wall, not two.
  const fold = (n) => {
    if (n.kind !== "dir") return n;
    while (n.code?.kind === "dir" && n.children.length === 1 && n.children[0].kind === "dir" && n.children[0].code?.kind === "dir") {
      const only = n.children[0];
      only.label = n.label + "/" + only.label;
      n = only;
    }
    n.children = n.children.map(fold);
    return n;
  };
  root.children = root.children.map(fold);
  const size = (n) => (n.kind === "dir" ? n.children.reduce((t, c) => t + size(c), 0) : 1);
  const order = (n) => { if (n.kind !== "dir") return; n.children.sort((a, b) => (b.kind === "dir") - (a.kind === "dir") || size(b) - size(a)); n.children.forEach(order); };
  order(root);
  const STR = { tests: 1, builds: 1 };
  const strongest = new Map();
  for (const [a, b, kind] of map.index.links) { const k = a + "\n" + b; strongest.set(k, Math.max(strongest.get(k) || 0, STR[kind] ?? 2)); }
  const edges = [...strongest].map(([k, s]) => [...k.split("\n"), s]);
  return { root, edges, hasRatings: false, code: true };
}

// --------------------------------------------------------------- panel

// The lens panel. `view` is called when a choice changes; `readout` and
// `summary` are the view's own lines; `key` gives the key's items for a
// height lens.
export function controls({ view, readout, summary, key: keyItems }) {
  const narrow = matchMedia("(max-width: 760px), (max-height: 560px)").matches; // start collapsed where space is short
  const o = effective();
  const slider = (key, text, min, max, step, help) => {
    const input = h("input", { type: "range", min, max, step, value: o[key], "aria-label": text });
    const out = h("output", {}, String(o[key]));
    input.addEventListener("input", () => { M.user[key] = Number(input.value); out.textContent = String(M.user[key]); persist(); view(); });
    return h("label", { class: "slider", title: help || null }, h("span", {}, text), input, out);
  };
  // On a phone the panel folds to one bar naming the lenses that are on (T58).
  const lensNames = h("span", { class: "lens-names" });
  const nameLenses = () => {
    const e = effective();
    const on = [e.showLinks && "Links", e.terrain && LENSES[heightLens(e)]].filter(Boolean);
    lensNames.textContent = on.length ? on.join(", ") : "none";
  };
  nameLenses();
  const toggle = (key, text, help) => {
    const b = h("button", { class: "toggle", type: "button", "aria-pressed": String(!!o[key]), title: help }, text);
    b.addEventListener("click", () => { M.user[key] = !effective()[key]; b.setAttribute("aria-pressed", String(M.user[key])); persist(); nameLenses(); view(); });
    return b;
  };
  const rated = [...store.concepts.values()].some((c) => c.links.some((l) => l.rel));
  const button = (text, fn) => { const b = h("button", { class: "toggle", type: "button" }, text); b.addEventListener("click", fn); return b; };
  // One of a few values, as pressed buttons.
  // `current`: the value in use, when it can be chosen automatically (the source).
  const choice = (key, text, options, after = null, current = () => effective()[key]) => {
    const buttons = options.map(([value, label, help]) => {
      const b = h("button", { class: "toggle", type: "button", "aria-pressed": String(current() === value), title: help }, label);
      b.addEventListener("click", () => {
        M.user[key] = value;
        buttons.forEach((x, i) => x.setAttribute("aria-pressed", String(options[i][0] === value)));
        persist(); if (after) after(); else view();
      });
      return b;
    });
    return h("div", { class: "row seg", role: "group", "aria-label": text }, h("span", {}, text), ...buttons);
  };

  // The key: the kinds of note on this map, where you stand, and the lines.
  const kinds = h("div", { class: "legend map-legend kinds" });
  const types = new Map();
  const code = sourceOf(o) === "code";
  if (code) { for (const i of store.code.items) if (i.kind !== "dir" && !types.has(KIND_LABEL[i.kind])) types.set(KIND_LABEL[i.kind], markerFor(i.kind)); }
  else for (const c of store.concepts.values()) if (c.type && isStudyNote(c) && !types.has(c.type)) types.set(c.type, markerFor(c.type));
  for (const [type, shape] of [...types].sort()) {
    const icon = h("svg:svg", { width: 22, height: 22, viewBox: "-7 -7 14 14", class: "m-key", "aria-hidden": "true" });
    icon.innerHTML = `<path d="${d3.symbol(SYMBOLS[shape], 30)()}" class="key-shape"/>${shape === "ring" ? '<path d="M-3.1 0H3.1" class="key-shape bar"/>' : ""}`;
    kinds.append(h("span", {}, icon, titleCase(type)));
  }
  const key = h("ul", { class: "legend map-key" });
  const drawKey = () => { const e = effective(); key.replaceChildren(...keyItems(heightLens(e), !!e.terrain)); };
  drawKey();
  // The height lenses: one at a time; choosing the one shown again puts the tones away.
  const heights = Object.entries(LENSES).filter(([k]) => k !== "understanding" || (understanding.on && !code)).map(([value, label]) => {
    const b = h("button", { class: "toggle", type: "button", title: {
      understanding: "Where you stand: reached ground is lighter, and each note is faint, outlined or filled.",
      activity: "Recent work: changed this week, this month, this quarter; 90 days untouched is faint.",
      health: "How settled: one step each for reviewed by a person, tested by an exercise, and current.",
    }[value] }, label);
    b.addEventListener("click", () => {
      const e = effective();
      if (e.terrain && heightLens(e) === value) M.user.terrain = false;
      else { M.user.terrain = true; M.user.height = value; }
      persist(); nameLenses(); drawKey(); pressHeights(); view();
    });
    return [value, b];
  });
  const pressHeights = () => { const e = effective(); for (const [value, b] of heights) b.setAttribute("aria-pressed", String(!!e.terrain && heightLens(e) === value)); };
  pressHeights();

  // The panel folds to one bar, here as on a phone, and stays as it was left.
  const change = h("span", { class: "lens-change" });
  let fold = null;
  const panel = h("div", { class: "graph-panel map-panel" },
    fold = h("details", { class: "graph-options", open: o.panelOpen ?? !narrow },
      h("summary", { title: "Show or hide the Atlas's settings" }, h("span", { class: "lens-label" }, "Lenses"), lensNames, change),
      h("div", { class: "row lenses" },
        toggle("showLinks", "Links", "The trunks between the items of each open folder, with their counts. Pointing at a note lights what it depends on."),
        ...heights.map(([, b]) => b)),
      understanding.on && !code ? h("label", { class: "hide-undiscovered" }, (() => {
        const box = h("input", { type: "checkbox" });
        box.checked = understanding.hiding;
        box.addEventListener("change", () => { understanding.setHiding(box.checked); view(); });
        return box;
      })(), "Hide what I have not reached") : "",
      kinds,
      key,
      summary,
      h("details", { class: "map-more" },
        h("summary", {}, "More options"),
        choice("folderless", "Folders", [[false, "Shown", "Each folder a region, laid out on its own."],
          [true, "None", "The whole base as one graph: every note in one layout, with its folder as a colour on its edge."]], () => M.resource?.()),
        store.code ? choice("source", "Map", [["code", "Code", "The code itself: directories, files, classes, functions; imports, calls and bindings as links."],
          ["notes", "Notes", "The knowledge base's notes and the links between them."]], () => M.resource?.(), () => sourceOf(effective())) : "",
        choice("gridFlow", "Flows", [["auto", "Auto", "The top level runs bottom to top; left to right on a phone turned on its side."],
          ["up", "Up", "The top level runs from the bottom up; folders inside it left to right; and so on in turn."],
          ["right", "Right", "The top level runs from left to right; folders inside it bottom to top; and so on in turn."]]),
        h("div", { class: "row" }, toggle("feeders", "Feeders", "Inside a folder, show which of its items each trunk's links come from: a branch from each to where the trunk meets the wall.")),
        rated ? h("div", { class: "row" }, toggle("hideImplied", "Hide implied", "Hide a link between two notes when a longer way already joins them.")) : "",
        h("div", { class: "sliders" }, slider("detail", "Open folders at", 40, 400, 10, "A folder opens when it is this many pixels wide on screen.")),
        readout,
        h("div", { class: "row" },
          button("Show everything", () => M.reset?.()),
          button("Default view", () => { for (const k of Object.keys(VIEW_DEFAULTS)) delete M.user[k]; persist(); location.reload(); })))));
  const folded = () => { change.textContent = fold.open ? "Hide" : "Show"; panel.classList.toggle("folded", !fold.open); };
  fold.addEventListener("toggle", () => { M.user.panelOpen = fold.open; persist(); folded(); });
  folded();
  return panel;
}
