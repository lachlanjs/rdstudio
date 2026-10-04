// The Atlas: the folder tree as nested territories (circle packing), notes as
// places, and links as routes that travel through the hierarchy: out of each
// folder by a gate on its edge, across the lowest folder containing both ends,
// and in again. See knowledge/design/map-view.md.
//
// One question at a time (T57, design/project/README.md "The Atlas"): links
// are trunks between top-level folders with their counts, a folder in focus
// shows the links inside it, and a selected note shows only its own links in
// the blue pen. The terrain of your understanding lies over the land: reached
// ground is clear, the rest is fog, contours are steps of understanding and
// later in the study order lies north.
//
// Layout, routes and terrain are computed in layout units and cached; every
// zoom frame only transforms them to the screen and decides what is open and
// labelled.

import * as d3 from "d3";
import { OFF_MAP, isStudyNote } from "@rdstudio/core/learning";
import { learner, store } from "../data.svelte.ts";
import { prerequisites } from "../learn.ts";
import { conceptHref, trustState, TRUST_LABEL, titleCase } from "../format.ts";
import { measure, timed } from "../perf.ts";
import { h } from "./dom.js";
import { actions } from "../actions.svelte.ts";
import { editing } from "../edit.svelte.ts";
import { understanding, STATE_LABEL } from "../understanding.svelte.ts";
import { exerciseNotes, statusOf, testsOf, tried } from "../exercises.ts";
import { projectMode } from "../shell.svelte.ts";
import { start, plainModel, layoutKey, cached, remember, previous, relative, applyPositions, computeLayout, computeTerrain, computeOutlines, computeRoutes } from "./layout.js";
import { widthOf } from "./terrain.js";
import { folderSpecs } from "./contours.js";


const KEY = "rdstudio.map";

// View settings, shown in the Options panel.
export const VIEW_DEFAULTS = {
  labels: 30, detail: 60,
  showLinks: true, // the Links lens: trunks between top-level folders, and the links inside the folder in focus
  allLinks: false, // every link at the shown scale instead, filtered as below
  terrain: true, // the terrain of the height lens
  height: null, // the height lens: "understanding", "activity" or "health"; by default understanding, or activity in project mode
  // Folder shape: "contour" (the outline follows the contents) or "circle"
  // (the packing's own circles); routing: "downhill" (crossing contours at
  // right angles, gathering in the flats) or "gates" (gates, corridors and
  // bundling). Positions, lenses and terrain are the same under both (T60).
  folders: "contour", routing: "downhill",
  // How far apart a link's ends are in the folder tree, counted in bubble walls:
  // "out" is the larger of the two ends' distances out to the lowest shared
  // folder, "path" is the total crossed going out and back in.
  distMeasure: "out", distMin: 0, distMax: 9,
  lanes: false, // one-way links keep to one side of their route, two-way links take the middle
  rateMin: 2, rateMax: 3, // 1 see also, 2 uses (and unrated), 3 requires
  hideImplied: true, focusOnly: false,
};
// How consequential a link is, from its Markdown title ("requires", "uses", "see also").
const STRENGTH = { requires: 3, uses: 2, "see also": 1 };
const STRENGTH_LABEL = { 1: "see also", 2: "uses", 3: "requires" };

// Tuning parameters, shown in the Tuning panel and settable per project under
// [map] in rdstudio.toml. [key, label, min, max, step, default, what it does]
export const TUNING = [
  ["room", "Room inside folders", 0.15, 0.9, 0.05, 0.3, "How much of a folder its contents fill; lower leaves more space between everything."],
  ["spread", "Spread", 0, 3, 0.1, 1, "How strongly the items in a folder push apart to use its space evenly."],
  ["outward", "Pull towards links", 0, 3, 0.1, 1, "How strongly an item moves to the side of its folder where its links leave."],
  ["spacing", "Space between items", 4, 160, 1, 90, "Least gap between neighbouring items, in map units (the map is 1000 across) and scaled down inside smaller folders."],
  ["margin", "Margin inside folders", 0, 160, 1, 60, "Space between a folder's edge and its contents, where routes reach the gates; scaled like spacing."],
  ["north", "Pull north", 0, 10, 0.5, 5, "How strongly notes later in the study order (deeper in the chain of requires-links) move north in their folder. Off in project mode."],
  ["dot", "Dot size", 0.25, 0.9, 0.05, 0.6, "A note's dot as a fraction of the space the layout gives it."],
  ["dotMax", "Largest dot", 4, 24, 1, 6, "Cap on a dot's radius on screen, in pixels."],
  ["bundle", "Bundling", 0, 0.5, 0.05, 0.1, "How much cheaper a corridor becomes each time a route uses it; higher gathers routes into trunks."],
  ["detour", "Avoid crossing bubbles", 1, 50, 1, 8, "Cost multiplier for a route segment that passes through a bubble."],
  ["bow", "Bow of direct links", 0, 0.3, 0.01, 0.12, "Sideways curve of a link with nothing in its way, as a fraction of its length."],
  ["width", "Line width", 0.5, 3, 0.1, 1.2, "Width of a route carrying one link, in pixels."],
  ["laneGap", "Lane spacing", 1, 12, 0.5, 4, "With lanes on, how far one-way routes sit to each side of the middle, in pixels."],
];
const TUNING_DEFAULTS = Object.fromEntries(TUNING.map((t) => [t[0], t[5]]));

// Marker shape per concept type (lower case). Projects override or extend this
// under [map.markers] in rdstudio.toml; unknown types are circles.
export const MARKERS = {
  definition: "circle", theorem: "diamond", lemma: "diamond", proposition: "diamond", corollary: "diamond",
  example: "triangle", trick: "square", reference: "ring", overview: "star",
  decision: "square", task: "triangle", question: "cross", idea: "wye", procedure: "star",
};
const SYMBOLS = {
  circle: d3.symbolCircle, diamond: d3.symbolDiamond, triangle: d3.symbolTriangle, square: d3.symbolSquare,
  star: d3.symbolStar, cross: d3.symbolCross, wye: d3.symbolWye, ring: d3.symbolCircle,
};
const PALETTE = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `var(--g${i})`);

const saved = (() => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
})();

// User choices (this browser) layered over project defaults over built-in defaults.
const M = {
  user: saved.user || saved.opts || {},
  transform: saved.transform ? d3.zoomIdentity.translate(saved.transform.x, saved.transform.y).scale(saved.transform.k) : null,
};

function projectMap() {
  return store.site.map || {};
}

function effective() {
  const project = Object.fromEntries(Object.entries(projectMap()).filter(([k]) => k !== "markers"));
  const o = Object.assign({}, VIEW_DEFAULTS, TUNING_DEFAULTS, project, M.user);
  if (projectMode() === "Project") o.north = 0; // direction means nothing on a project's map
  return o;
}

// ------------------------------------------------------------ height lenses

// What the terrain's height means (T59): where you stand (understanding, 0
// not reached to 3 understood), how recently a note changed (activity: this
// week, this month, this quarter; 90 days untouched is fog), or how settled
// it is (health: one step each for reviewed by a person, tested by an
// exercise, and current, neither its checks nor its content stale).
export const LENSES = { understanding: "Understanding", activity: "Activity", health: "Health" };
const LEVEL = { undiscovered: 0, discovered: 1, processed: 2, understood: 3 };
const LEVEL_CLASS = ["st-undiscovered", "st-discovered", "st-processed", "st-understood"];
function heightLens(o) {
  const lens = LENSES[o.height] ? o.height : projectMode() === "Project" ? "activity" : "understanding";
  return lens === "understanding" && !understanding.on ? "activity" : lens;
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
function lensValue(lens, c) {
  if (lens === "understanding") return LEVEL[understanding.state(c.id)?.state] ?? 0;
  if (lens === "activity") {
    const t = lastChanged().get(store.site.knowledge + "/" + c.path) ?? c.mtime * 1000;
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

function persist() {
  const t = M.transform;
  try {
    localStorage.setItem(KEY, JSON.stringify({ user: M.user, transform: t ? { x: t.x, y: t.y, k: t.k } : null }));
  } catch { /* storage unavailable */ }
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

function buildModel() {
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
  const maxDepth = Math.max(0, ...Object.keys(store.tree).filter(Boolean).map((id) => id.split("/").length));
  return { root: dirs.get(""), edges, implied: impliedLinks(ids, edges), hasRatings, maxDepth, ordered: [...depth.values()].some((d) => d > 0) };
}

// Links implied by others: a → c is implied when c can also be reached from a
// through a chain of links at least as strong (never through "see also"), as
// in a transitive reduction. Links inside a group of notes that require each
// other (a cycle) are left alone. Only the map hides them; notes keep them all.
function impliedLinks(ids, edges) {
  const out = new Map(ids.map((id) => [id, []]));
  for (const [a, b, s] of edges) out.get(a).push([b, s]);
  const component = stronglyConnected(ids, (v) => out.get(v).filter(([, s]) => s >= 2).map(([w]) => w));
  const implied = new Set();
  for (const [a, c, s] of edges) {
    if (component.get(a) === component.get(c)) continue;
    const need = Math.max(s, 2);
    const seen = new Set([a]);
    const stack = [];
    for (const [b, sb] of out.get(a)) if (b !== c && sb >= need && !seen.has(b)) { seen.add(b); stack.push(b); }
    while (stack.length) {
      const v = stack.pop();
      if (v === c) { implied.add(a + "\n" + c); break; }
      for (const [w, sw] of out.get(v)) if (sw >= need && !seen.has(w)) { seen.add(w); stack.push(w); }
    }
  }
  return implied;
}

// Tarjan's strongly connected components: node -> component number.
function stronglyConnected(ids, next) {
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [], component = new Map();
  let counter = 0, groups = 0;
  const visit = (v) => {
    index.set(v, counter); low.set(v, counter); counter++;
    stack.push(v); onStack.add(v);
    for (const w of next(v)) {
      if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) {
      let w;
      do { w = stack.pop(); onStack.delete(w); component.set(w, groups); } while (w !== v);
      groups++;
    }
  };
  for (const v of ids) if (!index.has(v)) visit(v);
  return component;
}

function wrapWords(text, width, charW) {
  const words = text.split(/ +/); // not \s: non-breaking spaces keep words together
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (line && next.length * charW > width) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// Bubble walls between two notes: "out" is the larger of the two distances out
// to the lowest folder they share, "path" the total out and back in.
function wallsBetween(na, nb, measure) {
  const shared = lowestCommon(na.parent, nb.parent);
  const wa = na.parent.depth - shared.depth, wb = nb.parent.depth - shared.depth;
  return measure === "path" ? wa + wb : Math.max(wa, wb);
}

function lowestCommon(a, b) {
  const up = new Set(a.ancestors());
  for (const n of b.ancestors()) if (up.has(n)) return n;
  return null;
}

// --------------------------------------------------------------- routing
//
// Each folder has a network of corridors through the open space inside it:
// a waypoint in the middle of each gap between neighbouring items (from a
// Delaunay triangulation of their centres), one in the open space of each
// triangle, and a gate on the folder's edge directly outward from each item.
// Gates next to each other are joined, like a ring road inside the wall.
// Routes are shortest paths through these networks, straightened where clear.

// Does the segment p–q pass through circle c of radius r?
function crosses(p, q, c, r) {
  const dx = q.x - p.x, dy = q.y - p.y, len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / len2));
  return Math.hypot(p.x + t * dx - c.x, p.y + t * dy - c.y) < r * 0.98;
}

function makeRouter(o) {
  const itemRadius = (n) => (n.data.kind === "concept" ? n.r * o.dot : n.r);
  const nets = new Map();

  function network(folder) {
    if (nets.has(folder)) return nets.get(folder);
    const items = folder.children || [];
    const nodes = [], adj = [];
    const touching = new Map(items.map((_, i) => [i, []]));
    const index = new Map(items.map((n, i) => [n, i]));
    const discount = new Map();
    const node = (x, y) => { adj.push([]); return nodes.push({ x, y }) - 1; };
    const blockedBy = (p, q, skip) => items.some((m) => !skip.includes(m) && crosses(p, q, m, itemRadius(m)));
    const link = (u, v, skip = []) => {
      const p = nodes[u], q = nodes[v];
      const w = Math.hypot(p.x - q.x, p.y - q.y) * (blockedBy(p, q, skip) ? o.detour : 1);
      const key = u < v ? `${u}-${v}` : `${v}-${u}`;
      adj[u].push({ to: v, w, key });
      adj[v].push({ to: u, w, key });
    };
    const gapWaypoint = new Map();
    const waypoint = (i, j) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (gapWaypoint.has(key)) return gapWaypoint.get(key);
      const a = items[i], b = items[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const gap = d - itemRadius(a) - itemRadius(b);
      let id = -1;
      if (gap > 1) {
        const t = (itemRadius(a) + gap / 2) / d;
        id = node(a.x + dx * t, a.y + dy * t);
        touching.get(i).push(id); touching.get(j).push(id);
      }
      gapWaypoint.set(key, id);
      return id;
    };
    if (items.length === 2) waypoint(0, 1);
    if (items.length >= 3) {
      const tri = d3.Delaunay.from(items, (n) => n.x, (n) => n.y).triangles;
      for (let t = 0; t < tri.length; t += 3) {
        const ws = [waypoint(tri[t], tri[t + 1]), waypoint(tri[t + 1], tri[t + 2]), waypoint(tri[t + 2], tri[t])].filter((x) => x >= 0);
        if (ws.length < 2) continue;
        // Start from the centroid of the gaps and push it out of any item it
        // falls in, so the middle waypoint sits in open space.
        let mx = ws.reduce((s, x) => s + nodes[x].x, 0) / ws.length, my = ws.reduce((s, x) => s + nodes[x].y, 0) / ws.length;
        for (let round = 0; round < 4; round++) {
          for (const m of [items[tri[t]], items[tri[t + 1]], items[tri[t + 2]]]) {
            const dx = mx - m.x, dy = my - m.y, d = Math.hypot(dx, dy) || 1e-6, r = itemRadius(m) * 1.04;
            if (d < r) { mx = m.x + (dx / d) * r; my = m.y + (dy / d) * r; }
          }
        }
        const mid = node(mx, my);
        for (const x of ws) link(x, mid);
      }
    }
    // Gates on the folder's edge (the root has no edge to cross).
    const gates = [];
    const firstGate = nodes.length; // nodes before this are corridors between items
    if (folder.parent) {
      const R = folder.r * 0.995;
      items.forEach((item, i) => {
        const dx = item.x - folder.x, dy = item.y - folder.y, d = Math.hypot(dx, dy);
        const angle = d > 1e-6 ? Math.atan2(dy, dx) : (i / items.length) * 2 * Math.PI;
        const g = node(folder.x + R * Math.cos(angle), folder.y + R * Math.sin(angle));
        gates.push({ id: g, angle, item: i });
        touching.get(i).push(g);
      });
      gates.sort((a, b) => a.angle - b.angle);
      // The ring road follows the wall in short steps rather than long chords.
      for (let k = 0; k < gates.length && gates.length > 1; k++) {
        const g0 = gates[k], g1 = gates[(k + 1) % gates.length];
        let span = g1.angle - g0.angle;
        if (span <= 0) span += 2 * Math.PI;
        const steps = Math.max(1, Math.ceil(span / (Math.PI / 12)));
        let prev = g0.id;
        for (let st = 1; st < steps; st++) {
          const a = g0.angle + (span * st) / steps;
          const id = node(folder.x + R * Math.cos(a), folder.y + R * Math.sin(a));
          link(prev, id);
          prev = id;
        }
        link(prev, g1.id);
      }
      // Join each gate to the nearest corridors inside.
      const inner = nodes.map((_, id) => id).slice(0, firstGate);
      for (const g of gates) {
        const p = nodes[g.id];
        inner.sort((a, b) => Math.hypot(nodes[a].x - p.x, nodes[a].y - p.y) - Math.hypot(nodes[b].x - p.x, nodes[b].y - p.y));
        for (const id of inner.slice(0, 3)) link(g.id, id);
      }
    }
    const net = { folder, items, nodes, adj, touching, index, gates, discount, itemRadius, blockedBy };
    nets.set(folder, net);
    return net;
  }

  // Dijkstra from a set of start nodes to a set of end nodes (with the cost of
  // stepping off the network added); the networks are small.
  function shortest(net, starts, ends) {
    const dist = new Map(), prev = new Map(), done = new Set();
    for (const [id, c] of starts) if (c < (dist.get(id) ?? Infinity)) dist.set(id, c);
    let best = null, bestCost = Infinity;
    while (true) {
      let u = -1, du = Infinity;
      for (const [k, v] of dist) if (!done.has(k) && v < du) { u = k; du = v; }
      if (u < 0 || du >= bestCost) break;
      done.add(u);
      if (ends.has(u) && du + ends.get(u) < bestCost) { best = u; bestCost = du + ends.get(u); }
      for (const e of net.adj[u]) {
        const nd = du + e.w * (net.discount.get(e.key) || 1);
        if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: u, key: e.key }); }
      }
    }
    if (best === null) return null;
    const path = [];
    for (let u = best; u !== undefined; u = prev.get(u)?.from) {
      path.push(u);
      const step = prev.get(u);
      if (step && o.bundle > 0) net.discount.set(step.key, Math.max(0.3, (net.discount.get(step.key) || 1) * (1 - o.bundle)));
    }
    return path.reverse();
  }

  // How a route gets on or off the network at an item or at a point.
  function attachItem(net, item) {
    const i = net.index.get(item);
    const out = new Map();
    for (const id of net.touching.get(i) || []) {
      const p = net.nodes[id];
      const c = Math.hypot(p.x - item.x, p.y - item.y) * (net.blockedBy(item, p, [item]) ? o.detour : 1);
      out.set(id, c);
    }
    return out;
  }
  function attachPoint(net, pt) {
    const out = new Map();
    const near = net.nodes.map((p, id) => [id, Math.hypot(p.x - pt.x, p.y - pt.y)]).sort((a, b) => a[1] - b[1]).slice(0, 4);
    for (const [id, d] of near) out.set(id, d * (net.blockedBy(pt, net.nodes[id], []) ? o.detour : 1));
    return out;
  }

  // Straighten a route: keep only the waypoints needed to get around obstacles.
  function pull(points, obstacles) {
    const clear = (p, q) => !obstacles.some((m) => crosses(p, q, m, itemRadius(m)));
    const out = [points[0]];
    let i = 0;
    while (i < points.length - 1) {
      let j = points.length - 1;
      while (j > i + 1 && !clear(points[i], points[j])) j--;
      out.push(points[j]);
      i = j;
    }
    return out;
  }

  // Inside `folder`: from item a to item b, or from item a to a point on the edge.
  function within(folder, a, b, pt) {
    const net = network(folder);
    const end = pt || { x: b.x, y: b.y };
    const obstacles = net.items.filter((n) => n !== a && n !== b);
    const start = { x: a.x, y: a.y };
    if (!obstacles.some((m) => crosses(start, end, m, itemRadius(m)))) return [start, end];
    const starts = attachItem(net, a);
    const ends = b ? attachItem(net, b) : attachPoint(net, pt);
    const path = starts.size && ends.size ? shortest(net, starts, ends) : null;
    return pull([start, ...(path || []).map((id) => net.nodes[id]), end], obstacles);
  }

  // Where a route leaves circle c heading for point q.
  const edgeToward = (c, q) => {
    const dx = q.x - c.x, dy = q.y - c.y, d = Math.hypot(dx, dy) || 1;
    return { x: c.x + (dx / d) * c.r, y: c.y + (dy / d) * c.r };
  };
  const childToward = (folder, rep) => rep.ancestors().find((n) => n.parent === folder);

  // From rep out to the point `exit` on the edge of `folder` (which contains rep).
  function climb(folder, rep, exit) {
    const child = childToward(folder, rep);
    const path = within(folder, child, null, exit);
    if (child === rep) return path;
    const inner = climb(child, rep, edgeToward(child, path[1]));
    return [...inner, ...path.slice(1)];
  }

  // The full route between two shown items, through their folders.
  function route(ra, rb) {
    const lca = lowestCommon(ra, rb);
    const ca = childToward(lca, ra), cb = childToward(lca, rb);
    const middle = within(lca, ca, cb);
    const left = ca === ra ? [middle[0]] : climb(ca, ra, edgeToward(ca, middle[1]));
    const right = cb === rb ? [middle[middle.length - 1]] : climb(cb, rb, edgeToward(cb, middle[middle.length - 2])).reverse();
    return [...left, ...middle.slice(1, -1), ...right].map((p) => [p.x, p.y]);
  }

  return { route, itemRadius };
}

// Crossings, for tuning: routes through bubbles they do not belong to, and
// routes crossing each other.
function crossings(routes, shown, itemRadius) {
  let bubbles = 0, lines = 0;
  const seg = (a, b, c, d) => {
    const o1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const o2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    const o3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]);
    const o4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
    return o1 * o2 < 0 && o3 * o4 < 0;
  };
  for (const r of routes) {
    const own = new Set([...r.p.ancestors(), ...r.q.ancestors()]);
    for (const n of shown) {
      if (own.has(n)) continue;
      const rad = itemRadius(n);
      for (let i = 0; i < r.pts.length - 1; i++) {
        if (crosses({ x: r.pts[i][0], y: r.pts[i][1] }, { x: r.pts[i + 1][0], y: r.pts[i + 1][1] }, n, rad)) { bubbles++; break; }
      }
    }
  }
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const A = routes[i].pts, B = routes[j].pts;
      let hit = false;
      for (let a = 0; a < A.length - 1 && !hit; a++) {
        for (let b = 0; b < B.length - 1 && !hit; b++) hit = seg(A[a], A[a + 1], B[b], B[b + 1]);
      }
      if (hit) lines++;
    }
  }
  return { bubbles, lines };
}

// --------------------------------------------------------------- view

const curve = d3.line().curve(d3.curveBasis); // stays within its waypoints: no loops

/** @param {string} [focusRef] @param {{ path?: string, tour?: any }} [opts] */
export function mapView(focusRef = "", { path = "", tour = null } = {}) {
  document.title = `${tour ? tour.title : "Map"} · ${store.site.title}`;
  let o = effective();
  // A study path: a note and everything it requires, numbered in reading order.
  // Only requires links between them are drawn, and everything else fades.
  // A tour ({key, title, stops: [{id, title, text}], start, narrate, onStep,
  // onFinish, back}) is shown the same way, numbered by stop, with a route
  // from each stop to the next and the stop you are at marked.
  const goal = !tour && path && store.concepts.get(path);
  const onMap = (id) => id && store.concepts.has(id) && isStudyNote(store.concepts.get(id));
  const trail = tour ? [...new Set(tour.stops.map((s) => s.id).filter(onMap))] : goal ? [...prerequisites(goal.id), goal].map((c) => c.id) : null;
  const step = new Map();
  if (tour) tour.stops.forEach((s, i) => { if (onMap(s.id) && !step.has(s.id)) step.set(s.id, i + 1); });
  else (trail || []).forEach((id, i) => step.set(id, i + 1));
  let atStop = tour ? Math.min(Math.max(0, tour.start || 0), tour.stops.length - 1) : -1;
  const goalId = () => (tour ? tour.stops[atStop]?.id : path);
  const wrap = h("div", { class: "graph-wrap map-wrap" });
  const svg = d3.select(wrap).append("svg").attr("role", "img").attr("aria-label", "Knowledge map");
  const tip = h("div", { class: "graph-tip", hidden: true });
  const crumbs = h("nav", { class: "map-crumbs", "aria-label": "Current folder" });
  const readout = h("p", { class: "map-readout" });
  const summary = h("p", { class: "map-summary" }); // what the links drawn are, in a sentence
  // Creating where you are looking: a note in the folder in focus, or a new
  // folder (a new region) inside it, which the map then shows.
  const newNote = h("button", { class: "toggle", type: "button" }, "New note");
  const newFolder = h("button", { class: "toggle", type: "button" }, "New folder");
  newNote.addEventListener("click", () => actions.open({ kind: "new-note", folder: focus.data.ref }));
  newFolder.addEventListener("click", () => actions.open({ kind: "new-folder", folder: focus.data.ref, from: "map" }));
  const create = h("div", { class: "map-create", role: "group", "aria-label": "Create here", hidden: true }, newNote, newFolder);
  void editing.known.then(() => { create.hidden = !editing.enabled; });
  const panel = controls({
    view: () => { o = effective(); cache = null; schedule(); },
    tune: () => { o = effective(); cache = null; arrange(); schedule(); },
    readout, summary,
  });
  const status = h("p", { class: "map-status", role: "status", hidden: true }, "Arranging the map…");
  // North means something only where notes are ordered by what they require.
  const north = h("div", { class: "atlas-north", "aria-hidden": "true", hidden: true },
    d3.create("svg").attr("width", 14).attr("height", 52).attr("viewBox", "0 0 14 52")
      .call((g) => g.append("path").attr("d", "M7 51V3M2 13L7 2L12 13").attr("class", "north-arrow")).node(),
    h("span", {}, "N · later in the study order"));
  // The selected note: what it is, where you stand, and the way in.
  const card = h("section", { class: "atlas-card", hidden: true, "aria-live": "polite" });
  wrap.append(panel, crumbs, create, tip, status, north, card, h("div", { class: "graph-hint" }, "Click a note to see its links, again to open it; a region to zoom in, empty space to step out."));
  if (trail) wrap.append(tour ? tourCard() : trailCard());

  const defs = svg.append("defs");
  const back = svg.append("rect").attr("class", "m-back");
  // The fog's stipple, and the land the terrain is clipped to.
  defs.append("pattern").attr("id", "m-fogdots").attr("width", 7).attr("height", 7).attr("patternUnits", "userSpaceOnUse")
    .append("circle").attr("cx", 2).attr("cy", 2).attr("r", 0.8).attr("class", "fogdot");
  const landClip = defs.append("clipPath").attr("id", "m-land-clip");
  // Everything drawn lives in one layer. During a gesture that layer is only
  // moved and scaled (cheap for the GPU); the full redraw, which places routes
  // and labels, happens when the gesture pauses, ends or has changed a lot.
  const world = svg.append("g").attr("class", "m-world");
  const gLand = world.append("g").attr("class", "m-land");
  const gTerrain = world.append("g").attr("class", "m-terrain").attr("clip-path", "url(#m-land-clip)");
  const gRegions = world.append("g");
  // Routes are drawn twice when a folder is in focus: faded everywhere, and at
  // full strength clipped to the focused folder, so the detail you are looking
  // at is clear while routes still show where they lead.
  const clip = defs.append("clipPath").attr("id", "m-focus-clip").append("circle");
  const gLinks = world.append("g").attr("class", "m-routes");
  const gFocus = world.append("g").attr("class", "m-routes m-focus").attr("clip-path", "url(#m-focus-clip)");
  const gImplied = world.append("g").attr("class", "m-implied-links");
  const gCounts = world.append("g").attr("class", "m-counts");
  const gNotes = world.append("g");
  const gSteps = world.append("g").attr("class", "m-steps");
  const gLabels = world.append("g").attr("class", "m-labels");
  const gLeader = world.append("g").attr("class", "m-leader");

  let model = timed("map-model", buildModel);
  // The map is placed at once: from this browser's cache when it has laid out
  // the same contents with the same settings before, otherwise in the quick
  // starting arrangement while the full layout is worked out in a worker
  // (layout.js); then it settles. Positions are updated in place, so the
  // hierarchy (L) changes only when the contents do.
  let L = timed("map-place", () => start(model.root));
  let placedKey = null, wantedKey = null; // the layout L shows, and the one asked for
  let warmFrom = null; // where things sat before the contents changed
  let settled = false, viewed = false, userMoved = false, left = false, markSettled = false;
  let cache = null; // routes for the current set of open folders
  let w = 800, hgt = 600;
  let focus = L.root;
  let hovered = null;
  let selected = null; // the note whose links are shown, and whose card is open
  let current = null; // screen helpers from the last render, for hover
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function arrange() {
    const plain = plainModel(model);
    const key = layoutKey(plain, o);
    if (key === wantedKey) return;
    wantedKey = key;
    if (key === placedKey) { status.hidden = true; return; } // back to what is shown
    const hit = cached(key, L.root.descendants().length);
    if (hit) return settle(key, hit);
    status.hidden = false;
    const t0 = performance.now();
    // After a change of contents, start from where things were (the layout
    // shown, or on opening, the last one kept), so the rest stays in place. A
    // change of settings lays out afresh, to show what the setting does.
    const prev = warmFrom || (placedKey ? null : previous());
    warmFrom = null;
    computeLayout(plain, o, prev).then((xyr) => {
      if (left || key !== wantedKey) return; // left the map, or the settings moved on
      measure("map-layout", t0);
      remember(key, xyr, L.root);
      settle(key, xyr);
    });
  }

  function settle(key, xyr) {
    applyPositions(L.root, xyr);
    placedKey = key;
    status.hidden = true;
    cache = null;
    markSettled = true;
    if (!settled) {
      settled = true;
      if (viewed && !userMoved) initialView(); // fit the settled map, unless the reader has moved it
    }
    schedule();
  }

  // After a change of contents: a new hierarchy, then a layout for it.
  function rebuild() {
    const was = placedKey ? relative(L.root) : null;
    L = timed("map-place", () => start(model.root));
    placedKey = wantedKey = null;
    if (was) warmFrom = was;
    settled = false;
    cache = null;
    focus = L.root;
    arrange();
    schedule();
  }

  let drawnAt = null, drawnWhen = 0; // the transform and time of the last full redraw
  let moving = false;
  // The extent from the measured size: d3 would otherwise read the svg's
  // width ("100%"), which fails once the map has left the page.
  const zoom = d3.zoom().scaleExtent([0.2, 80]).extent(() => [[0, 0], [w || 800, hgt || 600]])
    .on("start", (event) => { if (event.sourceEvent) userMoved = true; moving = true; svg.classed("moving", true); })
    .on("zoom", (event) => {
      const t = event.transform;
      M.transform = t;
      const s = drawnAt ? t.k / drawnAt.k : 0;
      if (moving && drawnAt && s > 0.67 && s < 1.5 && performance.now() - drawnWhen < 350) {
        world.attr("transform", `translate(${t.x - drawnAt.x * s},${t.y - drawnAt.y * s}) scale(${s})`);
      } else schedule();
    })
    .on("end", () => { moving = false; svg.classed("moving", false); schedule(); persist(); });
  svg.call(zoom).on("dblclick.zoom", null);

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      timed("map-render", render);
      if (markSettled) { markSettled = false; measure("map-settled", 0); } // since the page opened
    });
  }

  function fitTransform(n) {
    const k = (Math.min(w, hgt) / (2 * n.r)) * 0.92;
    return d3.zoomIdentity.translate(w / 2 - k * n.x, hgt / 2 - k * n.y).scale(k);
  }

  function zoomTo(n) {
    const t = fitTransform(n);
    if (reduceMotion) svg.call(zoom.transform, t);
    else svg.transition().duration(550).call(zoom.transform, t);
  }

  back.on("click", () => { if (selected) select(null); else if (focus.parent) zoomTo(focus.parent); });
  wrap.addEventListener("keydown", (e) => { if (e.key === "Escape" && selected) { e.preventDefault(); select(null); } });

  const fadeIn = (enter) => {
    if (!reduceMotion) enter.style("opacity", 0).transition().duration(220).style("opacity", null);
    return enter;
  };

  // What you have not reached, hidden when you choose (understanding.svelte.ts):
  // a note, unless it is reached or on the frontier; a folder holding none.
  function shownOnMap(n) {
    if (!understanding.hiding || step.has(n.data.ref)) return true;
    return n.data.kind === "concept" ? understanding.visible(n.data.ref) : understanding.folderVisible(n.data.ref);
  }
  const hiddenCount = () => { let k = 0; for (const c of store.concepts.values()) if (!understanding.visible(c.id)) k++; return k; };
  // Classes for where a note stands for you: its title's weight and the place's ink.
  const reach = (n) => (n.data.kind !== "concept" ? ""
    : heightLens(o) !== "understanding" ? LEVEL_CLASS[lensValue(heightLens(o), n.data.c)]
    : understanding.cls(n.data.ref) + (understanding.frontier(n.data.ref) ? " frontier" : ""));

  // What links are drawn, as routes between shown items (merged per pair):
  // a tour's or study path's own; a selected note's own links, in the blue
  // pen; with the Links lens, one trunk per pair of top-level folders (its
  // requires-links, implied ones hidden) plus the links inside the folder in
  // focus; or, if chosen, every link at the shown scale, filtered. Recomputed
  // only when the set of open folders, the focus or a setting changes, so
  // zooming stays cheap.
  function routesFor(open) {
    const mode = tour || trail ? "trail" : selected ? "selected" : !o.showLinks ? "none" : o.allLinks ? "all" : "trunks";
    const filters = mode === "all" ? ["distMeasure", "distMin", "distMax", "rateMin", "rateMax", "hideImplied", "focusOnly", "lanes"].map((k) => o[k]).join(",") : "";
    const signature = [...open].map((n) => n.data.id).sort().join(",") + "|" + mode + "|" + filters + "|" + o.hideImplied
      + (mode === "trunks" || (mode === "all" && o.focusOnly) ? "|" + focus.data.id : "") + (mode === "selected" ? "|" + selected.data.id : "")
      + (trail ? "|" + (tour ? tour.key : path) : "") + (understanding.hiding ? "|hiding:" + understanding.states.size + ":" + hiddenCount() : "");
    if (cache?.signature === signature) return cache;
    const start = performance.now();
    const shownRep = (leaf) => {
      for (const a of leaf.ancestors().reverse()) if (!(a.data.kind === "dir" && open.has(a))) return a;
      return leaf;
    };
    const topOf = (n) => n.ancestors().find((a) => a.depth === 1) || n;
    const merged = new Map();
    const inFocus = (n) => n.ancestors().includes(focus);
    let hidden = 0, counted = 0;
    // (m.dir: 1 if every link in a route runs p → q, -1 if q → p, 0 if both ways.)
    const add = (ra, rb, [a, b, s], cls = "", lane = 0) => {
      if (ra === rb) return;
      const [p, q] = ra.data.id < rb.data.id ? [ra, rb] : [rb, ra];
      const pair = p.data.id + "|" + q.data.id;
      const key = pair + (cls ? "|" + cls : "") + (o.lanes && mode === "all" ? "|" + lane : "");
      const m = merged.get(key) || { key, pair, lane, cls, p, q, count: 0, strength: 0, links: [] };
      m.count += 1;
      m.strength = Math.max(m.strength, s);
      m.links.push([a, b, s]);
      const way = ra === p ? 1 : -1; // this link runs p → q (1) or q → p (-1)
      m.dir = m.count === 1 ? way : m.dir === way ? way : 0;
      merged.set(key, m);
    };
    const ends = (a, b) => [L.byId.get("c:" + a), L.byId.get("c:" + b)];
    const hiddenImplied = (a, b) => o.hideImplied && model.hasRatings && model.implied.has(a + "\n" + b);
    if (tour) {
      // From each stop to the next, whether or not the notes link.
      const ids = tour.stops.map((st) => st.id).filter((id) => onMap(id) && L.byId.has("c:" + id));
      const pairs = new Set();
      for (let i = 1; i < ids.length; i++) {
        const a = ids[i - 1], b = ids[i];
        if (a === b || pairs.has(a + "\n" + b)) continue;
        pairs.add(a + "\n" + b);
        const [na, nb] = ends(a, b);
        add(shownRep(na), shownRep(nb), [a, b, 3], "trail");
      }
    } else if (trail) {
      for (const [a, b, s] of model.edges) {
        if (s !== 3 || !step.has(a) || !step.has(b)) continue;
        if (o.hideImplied && model.implied.has(a + "\n" + b)) { hidden++; continue; }
        const [na, nb] = ends(a, b);
        if (na && nb) add(shownRep(na), shownRep(nb), [a, b, s], "trail");
      }
    } else if (mode === "selected") {
      // Large dots for what it requires or uses, small for what builds on it.
      const me = selected.data.ref;
      for (const [a, b, s] of model.edges) {
        if (s < 2 || (a !== me && b !== me)) continue;
        const [na, nb] = ends(a, b);
        if (na && nb) add(shownRep(na), shownRep(nb), [a, b, s], a === me ? "req" : "dep");
      }
    } else if (mode === "trunks") {
      const least = model.hasRatings ? 3 : 2; // requires-links, where links are rated
      for (const [a, b, s] of model.edges) {
        if (s < least) continue;
        const [na, nb] = ends(a, b);
        if (!na || !nb || !shownOnMap(na) || !shownOnMap(nb)) continue;
        if (hiddenImplied(a, b)) { hidden++; continue; }
        counted++;
        if (focus !== L.root && inFocus(na) && inFocus(nb)) { add(shownRep(na), shownRep(nb), [a, b, s]); continue; }
        const ta = topOf(na), tb = topOf(nb);
        // Trunks of the folder in focus keep their strength; the rest fade.
        const mine = focus === L.root || ta === topOf(focus) || tb === topOf(focus);
        add(ta, tb, [a, b, s], mine ? "trunk" : "trunk quiet");
      }
    } else if (mode === "all") {
      const kept = [];
      for (const [a, b, s] of model.edges) {
        if (s < o.rateMin || s > o.rateMax) continue;
        if (hiddenImplied(a, b)) { hidden++; continue; }
        const [na, nb] = ends(a, b);
        if (!na || !nb || !shownOnMap(na) || !shownOnMap(nb)) continue;
        const d = wallsBetween(na, nb, o.distMeasure);
        if (d < o.distMin || d > o.distMax) continue;
        if (o.focusOnly && focus !== L.root && !inFocus(na) && !inFocus(nb)) continue;
        kept.push([a, b, s, na, nb]);
      }
      const keptKeys = new Set(kept.map(([a, b]) => a + "\n" + b));
      for (const [a, b, s, na, nb] of kept) {
        const ra = shownRep(na), rb = shownRep(nb);
        // With lanes on, one-way links travel apart from two-way ones.
        const lane = !o.lanes || keptKeys.has(b + "\n" + a) ? 0 : ra.data.id < rb.data.id ? 1 : -1;
        counted++;
        add(ra, rb, [a, b, s], "", lane);
      }
    }
    // Heavier bundles first, so lighter ones follow their corridors.
    const router = makeRouter(o);
    const routes = [...merged.values()].sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1));
    if (o.routing === "downhill" && placedKey) {
      // Solved in the worker and kept per pair; a route not back yet is not drawn.
      const key = downhillKey();
      if (downhill.key !== key) downhill = { key, routes: new Map(), pending: new Set(), angles: [] };
      const asks = [];
      const dirOf = (e) => (e.data.kind === "dir" ? e.data.id : null);
      for (const m of routes) {
        const got = downhill.routes.get(m.pair);
        m.org = true;
        m.pts = got ? got.pts : null;
        m.mid = got ? got.mid : null;
        if (got || downhill.pending.has(m.pair)) continue;
        downhill.pending.add(m.pair);
        asks.push({ key: m.pair, a: [m.p.x, m.p.y], b: [m.q.x, m.q.y], ends: [dirOf(m.p), dirOf(m.q)],
          allowed: [...new Set([...m.p.ancestors(), ...m.q.ancestors()].filter((a) => a.data.kind === "dir" && a.parent).map((a) => a.data.id))] });
      }
      if (asks.length) requestRoutes(key, asks);
    } else {
      const byPair = new Map(); // lanes (and the two pens) of the same pair share one route
      for (const m of routes) {
        if (!byPair.has(m.pair)) byPair.set(m.pair, router.route(m.p, m.q));
        m.pts = byPair.get(m.pair);
      }
    }
    const shown = [];
    L.root.each((n) => { if (n.parent && open.has(n.parent)) shown.push(n); });
    // Measure each physical route once, however many lanes share it.
    const physical = [...new Map(routes.filter((m) => m.pts).map((m) => [m.pair, m])).values()];
    const count = crossings(physical, shown, router.itemRadius);
    // Stretch: how much longer routes are than straight lines, on average.
    const len = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    const stretch = physical.length ? physical.reduce((s, r) => s + len(r.pts) / Math.max(1, Math.hypot(r.p.x - r.q.x, r.p.y - r.q.y)), 0) / physical.length : 1;
    readout.textContent = `${routes.length} routes · ${hidden} implied links hidden · ${count.bubbles} through bubbles · ${count.lines} route crossings · ${stretch.toFixed(2)}× stretch`;
    Object.assign(readout.dataset, { bubbles: count.bubbles, lines: count.lines, stretch: stretch.toFixed(3), routes: routes.length, hidden });
    const trunks = routes.filter((m) => m.cls.startsWith("trunk")).length;
    const kind = model.hasRatings ? "requires-links" : "links";
    summary.textContent = mode === "trunks"
      ? `${counted} ${kind} between and inside folders${hidden ? ` (${hidden} implied ones hidden)` : ""}; ${trunks} trunk${trunks === 1 ? "" : "s"} drawn${focus !== L.root ? `, and the links inside ${focus.data.label}` : ""}.`
      : mode === "all" ? `${counted} links drawn${hidden ? ` (${hidden} implied ones hidden)` : ""}, merged into ${routes.length} routes.`
      : mode === "selected" ? `${selected.data.label} selected. Its links show whether or not the Links lens is on.`
      : mode === "none" ? "Links are off: the terrain and the folders alone." : "";
    if (o.routing === "downhill" && downhill.angles.length && mode !== "none") {
      const a = downhill.angles.slice().sort((x, y) => x - y);
      summary.textContent += ` Routes meet folder outlines a median ${Math.round(a[a.length >> 1])}° off a right angle (${a.length} crossing${a.length === 1 ? "" : "s"}; 9 in 10 within ${Math.round(a[Math.floor(a.length * 0.9)])}°).`;
    }
    cache = { signature, routes, shownRep };
    measure("map-routes", start);
    return cache;
  }

  // ------------------------------------------------------------ folder shapes

  // Each folder's field (contours.js), for this layout.
  let specs = null, specsFor = null;
  function specOf(n) {
    if (specsFor !== L || specs?.at !== placedKey) { specs = new Map(folderSpecs(L.root).map((sp) => [sp.id, sp])); specs.at = placedKey; specsFor = L; }
    return specs.get(n.data.id);
  }
  // Contour outlines, worked out once per settled layout; circles until then.
  let outlines = null, outlinesAt = null;
  function outlineOf(n) {
    if (o.folders !== "contour" || !placedKey) return null;
    if (outlinesAt !== placedKey) {
      outlinesAt = placedKey;
      outlines = null;
      const at = placedKey, t0 = performance.now();
      specOf(L.root);
      computeOutlines([...specs.values()]).then((res) => {
        if (left || at !== placedKey) return;
        measure("map-outlines", t0);
        outlines = new Map(res.map((r) => [r.id, r]));
        cache = null;
        schedule();
      });
    }
    return outlines?.get(n.data.id) || null;
  }
  // A folder's shape on screen: its outline, or its circle.
  function shapePath(n, t) {
    const out = outlineOf(n);
    if (!out) {
      const x = t.applyX(n.x), y = t.applyY(n.y), r = n.r * t.k;
      return `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0Z`;
    }
    return out.shape.map((poly) => poly.map((ring) => "M" + ring.map(([x, y]) => t.applyX(x).toFixed(1) + " " + t.applyY(y).toFixed(1)).join("L") + "Z").join("")).join("");
  }

  // ------------------------------------------------------------ terrain

  // Height under the Understanding lens: not reached 0 to understood 3.
  const lens = () => heightLens(o);
  const levelOf = (n) => lensValue(lens(), n.data.c);
  const baked = new Map(); // top-level folder id → its terrain, kept while a newer one is baked
  const asked = new Set();
  function terrainOf(top) {
    const pts = [];
    for (const n of top.leaves()) if (n.data.kind === "concept") pts.push(n.x, n.y, levelOf(n), widthOf(n));
    const mask = o.folders === "contour" ? specOf(top) : null;
    const key = top.data.id + ":" + top.r.toFixed(2) + (mask ? ":contour" : "") + ":" + pts.map((v) => v.toFixed(2)).join(",");
    const hit = baked.get(top.data.id);
    if (hit?.key === key) return hit;
    if (!asked.has(key)) {
      asked.add(key);
      const t0 = performance.now();
      computeTerrain([{ key, cx: top.x, cy: top.y, r: top.r, pts, mask }]).then(([res]) => {
        asked.delete(key);
        if (left) return;
        measure("map-terrain", t0);
        baked.set(top.data.id, res);
        schedule();
      });
    }
    return hit || null;
  }

  // full: tints, every contour, the frontier and its hachures. overview: one
  // contour. reduced: the fog and a thin frontier, so routes carry the detail.
  function drawTerrain(tops, t, mode) {
    const on = !!o.terrain;
    gTerrain.attr("display", on ? null : "none");
    svg.classed("terrain", on);
    if (!on) return;
    const X = (x) => x * t.k + t.x, Y = (y) => y * t.k + t.y;
    const ring = (r) => "M" + r.map(([x, y]) => X(x).toFixed(1) + " " + Y(y).toFixed(1)).join("L") + "Z";
    const multi = (polys) => polys.map((poly) => poly.map(ring).join("")).join("");
    const ts = tops.map(terrainOf).filter(Boolean);
    const lv = [0, 1, 2, 3].map((i) => ts.map((T) => multi(T.levels[i])).join(""));
    const steps = mode === "full" ? [1, 2, 3] : mode === "overview" ? [1] : [];
    const data = [
      ...steps.map((i) => ({ id: "tint" + i, cls: `a-tint t${i}`, d: lv[i] })),
      { id: "fog", cls: "a-fog", d: `M${-w} ${-hgt}H${2 * w}V${2 * hgt}H${-w}Z` + lv[0] },
      ...steps.map((i) => ({ id: "c" + i, cls: `a-contour c${i}`, d: lv[i] })),
      { id: "front", cls: "a-front" + (mode === "reduced" ? " thin" : ""), d: lv[0] },
      { id: "hach", cls: "a-hach", d: mode === "reduced" ? "" : hachures(ts, X, Y) },
    ];
    gTerrain.selectAll("path").data(data, (d) => d.id).join("path").attr("class", (d) => d.cls).attr("d", (d) => d.d);
  }

  // Ticks along the frontier every 11px on screen, long and short in turn,
  // on the side facing the fog.
  function hachures(ts, X, Y) {
    const out = [];
    let tick = 0;
    for (const T of ts) for (const r of T.front) {
      let acc = 0;
      for (let i = 4; i < r.length; i += 4) {
        const x0 = X(r[i - 4]), y0 = Y(r[i - 3]), x1 = X(r[i]), y1 = Y(r[i + 1]);
        const seg = Math.hypot(x1 - x0, y1 - y0);
        if (!seg) continue;
        let d = 0;
        while (acc + (seg - d) >= 11) {
          d += 11 - acc; acc = 0;
          const f = d / seg, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
          if (x < -20 || y < -20 || x > w + 20 || y > hgt + 20) continue;
          const nx = r[i - 2] + (r[i + 2] - r[i - 2]) * f, ny = r[i - 1] + (r[i + 3] - r[i - 1]) * f, l = Math.hypot(nx, ny) || 1;
          const len = tick++ % 2 ? 4 : 8;
          out.push(`M${x.toFixed(1)} ${y.toFixed(1)}l${((nx / l) * len).toFixed(1)} ${((ny / l) * len).toFixed(1)}`);
        }
        acc += seg - d;
      }
    }
    return out.join("");
  }

  // Notes an exercise testing them was missed on: the teacher says they need work.
  let needsAt = null, needsSet = new Set();
  function needsWork() {
    if (lens() !== "understanding") return new Set();
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

  // ------------------------------------------------------------ selection

  function select(n) {
    selected = n;
    hover(null);
    tip.hidden = true;
    fillCard();
    schedule();
  }
  function openNote(n) {
    persist();
    location.hash = conceptHref(n.data.ref);
  }
  const plural = (k, one, many = one + "s") => `${k} ${k === 1 ? one : many}`;
  function fillCard() {
    card.hidden = !selected;
    if (!selected) return;
    const n = selected, ref = n.data.ref;
    const st = understanding.state(ref)?.state;
    const reqs = model.edges.filter(([a, , s]) => a === ref && s >= 2).length;
    const builds = model.edges.filter(([, b, s]) => b === ref && s >= 2).length;
    const needs = needsWork().has(ref);
    const where = needs ? "Needs work." : st ? `${STATE_LABEL[st]}.` : "";
    const exercises = exerciseNotes().filter((e) => testsOf(e).includes(ref));
    const open = h("a", { class: "toggle primary", href: conceptHref(ref) }, "Open the note");
    open.addEventListener("click", () => persist());
    const close = h("button", { class: "atlas-card-close", type: "button", "aria-label": "Close" }, "×");
    close.addEventListener("click", () => select(null));
    card.className = `atlas-card ${needs ? "card-red" : st === "understood" ? "card-green" : ""}`;
    card.setAttribute("aria-label", n.data.label);
    card.replaceChildren(
      h("h3", {}, n.data.label), close,
      h("p", {}, `${where} Requires ${plural(reqs, "note")}; ${plural(builds, "note")} ${builds === 1 ? "builds" : "build"} on it.`),
      h("div", { class: "atlas-card-actions" }, open,
        exercises.length ? h("a", { class: "toggle", href: conceptHref(exercises[0].id) }, exercises.length === 1 ? "Exercise" : `Exercises (${exercises.length})`) : "",
        reqs ? h("a", { class: "toggle", href: "#/path/" + ref, title: "This note and everything it requires, in reading order" }, "Study path") : ""));
  }

  // The card's leader: from the selected note's marker to the card, in its pen.
  function drawLeader(sx, sy, radius) {
    const n = selected;
    // Beside the note, where there is room: level with it, within the map.
    if (n && !card.hidden && getComputedStyle(card).position === "absolute" && card.offsetWidth < w / 2) {
      card.style.top = `${Math.round(Math.max(64, Math.min(hgt - card.offsetHeight - 64, sy(n) - 22)))}px`;
    } else card.style.top = "";
    const box = !card.hidden && n && card.getBoundingClientRect(), at = wrap.getBoundingClientRect();
    if (!box || !box.width || getComputedStyle(card).position !== "absolute" || box.left - at.left < sx(n) + 30) { gLeader.selectAll("*").remove(); return; }
    const x0 = sx(n) + radius(n) + 4, y0 = sy(n), x1 = box.left - at.left, y1 = Math.max(box.top - at.top + 18, Math.min(y0, box.bottom - at.top - 18));
    const xm = Math.max(x0, x1 - 36 - Math.abs(y1 - y0));
    gLeader.selectAll("path").data([0]).join("path").attr("class", "leader " + card.className.replace("atlas-card", "").trim())
      .attr("d", `M${x0} ${y0}H${xm}L${Math.min(x1, xm + Math.abs(y1 - y0))} ${y1}H${x1}`);
    gLeader.selectAll("circle").data([0]).join("circle").attr("class", "leader-dot " + card.className.replace("atlas-card", "").trim()).attr("cx", x1).attr("cy", y1).attr("r", 3);
  }

  // ------------------------------------------------------------ downhill routes

  let downhill = { key: null, routes: new Map(), pending: new Set(), angles: [] };
  // Routes depend on the layout and, through the slope, on where you stand.
  const downhillKey = () => placedKey + ":" + (understanding.on ? L.root.leaves().map(levelOf).join("") : "");
  function requestRoutes(key, asks) {
    const t0 = performance.now();
    const notes = [];
    L.root.each((n) => { if (n.data.kind === "concept") notes.push(n.x, n.y, understanding.on ? levelOf(n) : 0, widthOf(n)); });
    specOf(L.root);
    computeRoutes(key, { specs: [...specs.values()], notes }, asks).then((res) => {
      if (left || downhill.key !== key) return;
      measure("map-downhill", t0);
      for (const r of res.routes) { downhill.routes.set(r.key, r); downhill.pending.delete(r.key); }
      downhill.angles.push(...res.angles);
      cache = null;
      schedule();
    });
  }

  function render() {
    const t = M.transform || d3.zoomIdentity;
    drawnAt = t; drawnWhen = performance.now();
    world.attr("transform", null);
    const sx = (n) => t.applyX(n.x), sy = (n) => t.applyY(n.y), sr = (n) => n.r * t.k;
    const needs = needsWork();
    // Notes are drawn as places of bounded size; one not reached a little smaller.
    const dot = (n) => {
      const r = Math.max(2.5, Math.min(n.data.landmark ? o.dotMax + 2.5 : o.dotMax, n.r * o.dot * t.k));
      return (lens() !== "understanding" || understanding.on) && !levelOf(n) && !needs.has(n.data.ref) ? r * 0.8 : r;
    };
    const ringed = (n) => needs.has(n.data.ref) || levelOf(n) === 3;
    const radius = (n) => (n.data.kind === "concept" ? dot(n) + (ringed(n) ? 5 : 0) : sr(n));
    const onScreen = (n) => sx(n) + sr(n) > 0 && sx(n) - sr(n) < w && sy(n) + sr(n) > 0 && sy(n) - sr(n) < hgt;

    // What is open: the root, and any folder big enough on screen whose parent is open.
    const open = new Set();
    L.root.each((n) => {
      if (n.data.kind !== "dir") return;
      if (!n.parent || (open.has(n.parent) && sr(n) >= o.detail)) open.add(n);
    });
    const visible = [];
    L.root.each((n) => { if (n.parent && open.has(n.parent) && onScreen(n) && shownOnMap(n)) visible.push(n); });

    // Focus: the deepest open folder under the centre of the view.
    focus = L.root;
    for (const n of open) {
      const d = Math.hypot(sx(n) - w / 2, sy(n) - hgt / 2);
      if (d < sr(n) && sr(n) >= Math.min(w, hgt) * 0.3 && n.depth > focus.depth) focus = n;
    }
    drawCrumbs();
    // The selected note, in this layout (a change of contents makes new nodes).
    if (selected && L.byId.get(selected.data.id) !== selected) { selected = L.byId.get(selected.data.id) || null; fillCard(); }

    // The land: open top-level folders, which the terrain is clipped to.
    const tops = visible.filter((n) => n.depth === 1 && n.data.kind === "dir" && open.has(n));
    const shape = (sel) => sel.attr("d", (n) => shapePath(n, t));
    gLand.selectAll("path").data(tops, (n) => n.data.id).join("path").attr("class", "m-landfill").call(shape);
    landClip.selectAll("path").data(tops, (n) => n.data.id).join("path").call(shape);
    const quiet = o.showLinks && !o.allLinks && !selected && !trail;
    drawTerrain(tops, t, focus !== L.root ? (quiet ? "overview" : "full") : quiet ? "reduced" : "overview");

    // Territories (folders), outermost first so inner ones sit on top.
    const regions = visible.filter((n) => n.data.kind === "dir").sort((a, b) => a.depth - b.depth);
    gRegions.selectAll("path").data(regions, (n) => n.data.id).join((enter) => fadeIn(enter.append("path")))
      .attr("class", (n) => `m-dir ${open.has(n) ? "open" : "closed"} depth-${Math.min(n.depth, 3)}`)
      .call(shape)
      .on("click", (event, n) => { event.stopPropagation(); zoomTo(n === focus && n.parent ? n.parent : n); })
      .on("pointerenter", (event, n) => showTip(event, n))
      .on("pointerleave", () => { tip.hidden = true; });

    // Routes: neutral lines, wider with more links; a selected note's own in the blue pen.
    const { routes } = routesFor(open);
    const toScreen = (pts) => pts.map(([x, y]) => [t.applyX(x), t.applyY(y)]);
    const trim = (from, toward, r) => {
      const dx = toward[0] - from[0], dy = toward[1] - from[1], d = Math.hypot(dx, dy) || 1;
      return [from[0] + (dx / d) * (r + 2), from[1] + (dy / d) * (r + 2)];
    };
    // Shift a polyline sideways (for lanes): each point moves along the average
    // of its segments' normals.
    const shift = (pts, by) => {
      if (!by) return pts;
      return pts.map((pt, i) => {
        let nx = 0, ny = 0;
        for (const [u, v] of [[pts[i - 1], pt], [pt, pts[i + 1]]]) {
          if (!u || !v) continue;
          const dx = v[0] - u[0], dy = v[1] - u[1], d = Math.hypot(dx, dy) || 1;
          nx += -dy / d; ny += dx / d;
        }
        const n = Math.hypot(nx, ny) || 1;
        return [pt[0] + (nx / n) * by, pt[1] + (ny / n) * by];
      });
    };
    const screenPts = (m) => {
      let s = toScreen(m.pts);
      const near = (pt, n) => Math.hypot(pt[0] - sx(n), pt[1] - sy(n)) < radius(n) + 14;
      return [s[0], ...s.slice(1, -1).filter((pt) => !near(pt, m.p) && !near(pt, m.q)), s[s.length - 1]];
    };
    const pathFor = (m) => {
      if (m.org) {
        // A dense, already smooth line: drop what lies under a note's marker,
        // then draw it as it is. A folder end already stops on the outline.
        const s = toScreen(m.pts);
        for (const [e, end] of [[m.p, 0], [m.q, 1]]) {
          if (e.data.kind !== "concept") continue;
          const r = radius(e) + 3;
          while (s.length > 2 && Math.hypot(s[end ? s.length - 1 : 0][0] - sx(e), s[end ? s.length - 1 : 0][1] - sy(e)) < r) end ? s.pop() : s.shift();
        }
        return "M" + s.map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L");
      }
      const s = screenPts(m);
      const offset = (m.lane || 0) * o.laneGap;
      if (s.length === 2) {
        if (Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) < radius(m.p) + radius(m.q) + 4) return "";
        let f = trim(s[0], s[1], radius(m.p)), g = trim(s[1], s[0], radius(m.q));
        const dx = g[0] - f[0], dy = g[1] - f[1], d = Math.hypot(dx, dy) || 1;
        const bow = Math.min(d * o.bow, 36);
        let c = [(f[0] + g[0]) / 2 - (dy / d) * bow, (f[1] + g[1]) / 2 + (dx / d) * bow];
        [f, c, g] = [f, c, g].map((pt) => [pt[0] - (dy / d) * offset, pt[1] + (dx / d) * offset]);
        return `M${f[0]},${f[1]} Q${c[0]},${c[1]} ${g[0]},${g[1]}`;
      }
      s[0] = trim(s[0], s[1], radius(m.p));
      s[s.length - 1] = trim(s[s.length - 1], s[s.length - 2], radius(m.q));
      return curve(shift(s, offset));
    };
    const focused = focus !== L.root && o.showLinks && o.allLinks && !selected && !trail;
    const inFocus = (n) => n.ancestors().includes(focus);
    const own = (m) => m.cls === "req" || m.cls === "dep";
    const drawRoutes = (group, list) => group.selectAll("path").data(list.filter((m) => m.pts), (m) => m.key).join((enter) => fadeIn(enter.append("path")))
      .attr("class", (m) => `m-link s${m.strength} ${m.cls}`)
      .attr("stroke-width", (m) => (own(m) ? null : o.width * (1 + 0.9 * Math.log2(m.count))))
      .attr("d", pathFor)
      .selectAll("title").data((m) => [m]).join("title")
      .text((m) => `${m.count} link${m.count > 1 ? "s" : ""} between ${m.p.data.label} and ${m.q.data.label}${m.strength ? ` (strongest: ${STRENGTH_LABEL[m.strength]})` : ""}`);
    gLinks.classed("context", focused);
    drawRoutes(gLinks, routes);
    clip.attr("cx", sx(focus)).attr("cy", sy(focus)).attr("r", focused ? sr(focus) : 0);
    drawRoutes(gFocus, focused ? routes.filter((m) => inFocus(m.p) || inFocus(m.q)) : []);
    // A trunk's count: half way along the part of it outside both folders.
    const taken = [];
    const counts = routes.filter((m) => m.pts && m.cls.startsWith("trunk") && m.p.depth === 1 && m.q.depth === 1).map((m) => {
      if (m.org) {
        // Half way along the part outside both folders (found in the worker), or near it.
        const P = toScreen(m.pts), mid = m.mid ?? P.length >> 1;
        const tries = [0, -6, 6, -12, 12, -18, 18].map((d) => P[Math.max(0, Math.min(P.length - 1, mid + d))]);
        const at = tries.find((c) => taken.every(([x, y]) => Math.hypot(c[0] - x, c[1] - y) > 20)) || tries[0];
        taken.push(at);
        return { key: m.key, x: at[0], y: at[1], text: String(m.count), quiet: m.cls.includes("quiet") };
      }
      const P = screenPts(m), out = [];
      for (let i = 0; i < P.length - 1; i++) for (let f = 0; f < 1; f += 0.05) {
        const x = P[i][0] + (P[i + 1][0] - P[i][0]) * f, y = P[i][1] + (P[i + 1][1] - P[i][1]) * f;
        if ([m.p, m.q].every((e) => Math.hypot(x - sx(e), y - sy(e)) > radius(e) + 8)) out.push([x, y]);
      }
      // Half way along, or the nearest place to it clear of the other counts.
      const tries = out.length ? [0.5, 0.38, 0.62, 0.27, 0.73, 0.16, 0.84].map((f) => out[Math.floor(out.length * f)]) : [P[Math.floor(P.length / 2)]];
      const at = tries.find((c) => taken.every(([x, y]) => Math.hypot(c[0] - x, c[1] - y) > 20)) || tries[0];
      taken.push(at);
      return { key: m.key, x: at[0], y: at[1], text: String(m.count), quiet: m.cls.includes("quiet") };
    });
    gCounts.selectAll("text").data(counts, (d) => d.key).join("text")
      .attr("class", (d) => "m-count" + (d.quiet ? " quiet" : "")).attr("x", (d) => d.x).attr("y", (d) => d.y + 4).text((d) => d.text);

    // Places (notes): the shape is the kind of note; fill and ring are where
    // you stand: a faint outline not reached, an outline opened, filled worked
    // through, filled with a double green ring understood; a solid red ring
    // when the teacher says it needs work. A landmark is drawn larger.
    const notes = visible.filter((n) => n.data.kind === "concept");
    gNotes.selectAll("g.m-place").data(notes, (n) => n.data.id).join((enter) => {
      const g = enter.append("g").attr("tabindex", 0).attr("role", "link");
      g.append("circle").attr("class", "sel");
      g.append("circle").attr("class", "ring-a");
      g.append("circle").attr("class", "ring-b");
      g.append("path").attr("class", "mark");
      g.append("path").attr("class", "bar");
      return fadeIn(g);
    })
      .attr("class", (n) => `m-place ${n.data.marker}${n.data.landmark ? " landmark" : ""} ${trustState(n.data.c)}${step.has(n.data.ref) ? " on-trail" : ""} ${reach(n)}${needs.has(n.data.ref) ? " needs" : ""}${n === selected ? " selected" : ""}`)
      .attr("data-ref", (n) => n.data.ref)
      .attr("aria-label", (n) => n.data.label + (needs.has(n.data.ref) ? ", needs work" : understanding.state(n.data.ref) ? `, ${STATE_LABEL[understanding.state(n.data.ref).state].toLowerCase()}` : ""))
      .attr("transform", (n) => `translate(${sx(n)},${sy(n)})`)
      .on("click", (event, n) => { event.stopPropagation(); if (n === selected) openNote(n); else select(n); })
      .on("dblclick", (event, n) => { event.stopPropagation(); openNote(n); })
      .on("keydown", (event, n) => {
        if (event.key === "Enter") openNote(n);
        else if (event.key === " ") { event.preventDefault(); select(n === selected ? null : n); }
      })
      .on("pointerenter", (event, n) => { showTip(event, n); hover(n); })
      .on("pointerleave", () => { tip.hidden = true; hover(null); })
      .each(function (n) {
        const r = dot(n), g = d3.select(this);
        // On the Activity lens the top state is a plain ring: recent is not right.
        const red = needs.has(n.data.ref), top = !red && levelOf(n) === 3 && (lens() !== "understanding" || understanding.on);
        const green = top && lens() !== "activity";
        g.classed("plain", top && !green);
        g.select(".sel").attr("r", n === selected ? r + (red || top ? 10 : 7) : 0);
        g.select(".ring-a").attr("r", red || top ? r + 5 : 0);
        g.select(".ring-b").attr("r", green ? r + 2.5 : 0);
        g.select(".mark").attr("d", d3.symbol(SYMBOLS[n.data.marker], Math.PI * r * r)());
        g.select(".bar").attr("d", n.data.marker === "ring" ? `M${-r} 0H${r}` : null);
      });

    current = { sx, sy, radius };
    svg.classed("trail", !!trail);
    svg.classed("selecting", !!selected);
    if (trail) drawSteps(visible, open, sx, sy, sr, dot);
    drawLabels(open, visible, notes, sx, sy, sr, dot);
    drawLeader(sx, sy, radius);
    north.hidden = !(o.north > 0 && model.ordered && !trail);
    if (hovered) hover(hovered);
  }

  function drawLabels(open, visible, notes, sx, sy, sr, dot) {
    const budget = o.labels;
    const placed = [];
    // Places are obstacles too, so labels do not cover other places.
    const dots = notes.map((n) => { const r = dot(n) + (n.data.landmark ? 4 : 0); return [sx(n) - r, sy(n) - r, sx(n) + r, sy(n) + r]; });
    const clash = (box, list) => list.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
    const fits = (box, own) => box[0] > -40 && box[2] < w + 40 && box[1] > -20 && box[3] < hgt + 20 &&
      !clash(box, placed) && !clash(box, dots.filter((d) => d !== own));
    const arcs = [], texts = [], heads = [];
    const t = drawnAt || d3.zoomIdentity;
    const noteCount = (n) => n.leaves().filter((l) => l.data.kind === "concept").length;

    // Open territories: name along the top of the region, outermost first.
    for (const n of [...open].filter((n) => n.parent).sort((a, b) => a.depth - b.depth)) {
      if (arcs.length + texts.length + heads.length >= budget) break;
      const out = outlineOf(n);
      if (out) {
        // A contour has no arc to follow: the name sits above the outline.
        const x = t.applyX((out.box[0] + out.box[2]) / 2), y = t.applyY(out.box[1]) - 7;
        const width = (n.data.label.length + 3) * 7.8;
        const box = [x - width / 2, y - 12, x + width / 2, y + 3];
        if (!fits(box)) continue;
        placed.push(box);
        heads.push({ n, x, y, count: noteCount(n) });
        continue;
      }
      const R = sr(n) + 6; // just outside the wall
      const width = (n.data.label.length + 3) * 7.6;
      if (R < 30 || width > R * 2.2) continue;
      const box = [sx(n) - width / 2, sy(n) - R - 12, sx(n) + width / 2, sy(n) - R + 4];
      if (!fits(box)) continue;
      placed.push(box);
      arcs.push({ n, R });
    }
    // Closed territories: name and size in the middle.
    const closed = visible.filter((n) => n.data.kind === "dir" && !open.has(n)).sort((a, b) => sr(b) - sr(a));
    for (const n of closed) {
      if (arcs.length + texts.length + heads.length >= budget) break;
      const count = noteCount(n);
      const lines = [n.data.label, `${count} note${count === 1 ? "" : "s"}`];
      const width = n.data.label.length * 7.8;
      if (sr(n) < 14) continue;
      const out = outlineOf(n); // in the middle of its outline, or of its circle
      const cx = out ? t.applyX((out.box[0] + out.box[2]) / 2) : sx(n), cy = out ? t.applyY((out.box[1] + out.box[3]) / 2) : sy(n);
      const box = [cx - width / 2, cy - 12, cx + width / 2, cy + 18];
      if (!fits(box)) continue;
      placed.push(box);
      texts.push({ n, x: cx, y: cy - 1, lines, anchor: "middle", cls: "territory" });
    }
    // Places: beside the marker, trying right, left, above and below.
    const ranked = [...notes].sort((a, b) => step.has(b.data.ref) - step.has(a.data.ref) || b.data.weight - a.data.weight || sr(b) - sr(a));
    for (const n of ranked) {
      if (arcs.length + texts.length + heads.length >= budget) break;
      const r = dot(n) + (n.data.landmark ? 4 : 0), x = sx(n), y = sy(n);
      const charW = n.data.landmark || /st-understood|changed/.test(reach(n)) ? 7.4 : 7;
      const lines = wrapWords(n.data.label, 150, charW);
      if (lines.length > 3) continue;
      const width = Math.max(...lines.map((l) => l.length)) * charW;
      const height = lines.length * 14;
      const own = dots[notes.indexOf(n)];
      const spots = [
        { box: [x + r + 4, y - height / 2, x + r + 4 + width, y + height / 2], tx: x + r + 4, anchor: "start" },
        { box: [x - r - 4 - width, y - height / 2, x - r - 4, y + height / 2], tx: x - r - 4, anchor: "end" },
        { box: [x - width / 2, y - r - 3 - height, x + width / 2, y - r - 3], tx: x, anchor: "middle" },
        { box: [x - width / 2, y + r + 3, x + width / 2, y + r + 3 + height], tx: x, anchor: "middle" },
      ];
      const spot = spots.find((s) => fits(s.box, own));
      if (!spot) continue;
      placed.push(spot.box);
      texts.push({ n, x: spot.tx, y: spot.box[1] + 11, lines, anchor: spot.anchor, cls: (n.data.landmark ? "place landmark" : "place") + (step.has(n.data.ref) ? " on-trail" : "") + " " + reach(n) });
    }

    defs.selectAll("path.m-arc-path").data(arcs, (a) => a.n.data.id).join("path").attr("class", "m-arc-path")
      .attr("id", (a) => "arc-" + a.n.data.id.replace(/[^\w-]/g, "_"))
      .attr("d", (a) => {
        const cx = sx(a.n), cy = sy(a.n), R = a.R;
        const a0 = (-160 * Math.PI) / 180, a1 = (-20 * Math.PI) / 180;
        return `M${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)} A${R},${R} 0 0 1 ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)}`;
      });
    gLabels.selectAll("text.m-arc").data(arcs, (a) => a.n.data.id).join((enter) => {
      const text = enter.append("text").attr("class", "m-arc");
      const path = text.append("textPath").attr("startOffset", "50%").attr("text-anchor", "middle");
      path.append("tspan").attr("class", "name");
      path.append("tspan").attr("class", "count");
      return text;
    })
      .classed("sub", (a) => a.n.depth > 1)
      .select("textPath")
      .attr("href", (a) => "#arc-" + a.n.data.id.replace(/[^\w-]/g, "_"))
      .call((tp) => {
        tp.select(".name").text((a) => a.n.data.label);
        tp.select(".count").text((a) => " " + a.n.leaves().filter((l) => l.data.kind === "concept").length);
      });
    gLabels.selectAll("text.m-head").data(heads, (d) => d.n.data.id).join((enter) => {
      const text = enter.append("text").attr("text-anchor", "middle");
      text.append("tspan").attr("class", "name");
      text.append("tspan").attr("class", "count");
      return text;
    })
      .attr("class", (d) => `m-text m-head territory${d.n.depth > 1 ? " sub" : ""}`)
      .attr("x", (d) => d.x).attr("y", (d) => d.y)
      .call((text) => {
        text.select(".name").text((d) => d.n.data.label);
        text.select(".count").text((d) => " " + d.count);
      });
    gLabels.selectAll("text.m-text:not(.m-head)").data(texts, (d) => d.n.data.id).join("text")
      .attr("class", (d) => `m-text ${d.cls}`)
      .attr("data-id", (d) => d.n.data.id)
      .attr("y", (d) => d.y)
      .attr("text-anchor", (d) => d.anchor)
      .selectAll("tspan").data((d) => d.lines.map((line, i) => ({ line, i, x: d.x, cls: d.cls }))).join("tspan")
      .attr("class", (s) => (s.cls === "territory" && s.i ? "count" : null))
      .attr("x", (s) => s.x).attr("dy", (s) => (s.i ? 15 : 0))
      .text((s) => s.line);
  }

  // Hover: fade what is unrelated and bring forward the note's own routes.
  function hover(n) {
    hovered = n;
    svg.classed("focusing", !!n);
    if (!n || !cache) {
      gNotes.selectAll("g.m-place").classed("related", false);
      svg.selectAll(".m-routes path").classed("hot", false).classed("needs", false).classed("needed", false);
      gLabels.selectAll("text").classed("related", false);
      gImplied.selectAll("path").remove();
      return;
    }
    const related = new Set([n.data.id]);
    for (const [a, b] of model.edges) {
      const other = a === n.data.ref ? b : b === n.data.ref ? a : null;
      const on = other && L.byId.get("c:" + other);
      if (!on) continue;
      related.add(on.data.id);
      related.add(cache.shownRep(on).data.id);
    }
    gNotes.selectAll("g.m-place").classed("related", (m) => related.has(m.data.id));
    gLabels.selectAll("text.m-text").classed("related", function () { return related.has(this.getAttribute("data-id")); });
    // Direction, by colour rather than arrows: what the note needs, and what needs it.
    const mine = (m) => m.links.filter(([a, b]) => a === n.data.ref || b === n.data.ref);
    svg.selectAll(".m-routes path")
      .classed("hot", (m) => mine(m).length > 0)
      .classed("needs", (m) => mine(m).some(([a]) => a === n.data.ref))
      .classed("needed", (m) => mine(m).length > 0 && mine(m).every(([, b]) => b === n.data.ref));
    svg.selectAll(".m-routes path.hot").raise();
    // Its implied links, hidden from the map, shown faintly.
    const { sx, sy, radius } = current;
    const hiddenEnds = [];
    if (o.hideImplied && model.hasRatings) {
      for (const [a, b] of model.edges) {
        if (!model.implied.has(a + "\n" + b) || (a !== n.data.ref && b !== n.data.ref)) continue;
        const on = L.byId.get("c:" + (a === n.data.ref ? b : a));
        const r = on && cache.shownRep(on);
        if (r && r !== n) hiddenEnds.push(r);
      }
    }
    gImplied.selectAll("path").data(hiddenEnds).join("path").attr("class", "m-implied")
      .attr("d", (r) => {
        const x1 = sx(n), y1 = sy(n), x2 = sx(r), y2 = sy(r);
        const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
        const r1 = radius(n) + 2, r2 = radius(r) + 2;
        const bow = Math.min(40, d * 0.15);
        return `M${x1 + (dx / d) * r1},${y1 + (dy / d) * r1} Q${(x1 + x2) / 2 - (dy / d) * bow},${(y1 + y2) / 2 + (dx / d) * bow} ${x2 - (dx / d) * r2},${y2 - (dy / d) * r2}`;
      });
  }

  // Step numbers: on each note of the path, and on each closed folder holding
  // some of it (as the steps inside, e.g. 3–5).
  function drawSteps(visible, open, sx, sy, sr, dot) {
    const badges = [];
    for (const n of visible) {
      if (n.data.kind === "concept") {
        if (!step.has(n.data.ref)) continue;
        const r = dot(n) + (n.data.landmark ? 3.5 : 0);
        badges.push({ id: n.data.id, x: sx(n) - r * 0.75, y: sy(n) - r * 0.75, text: String(step.get(n.data.ref)), last: n.data.ref === goalId() });
      } else if (!open.has(n)) {
        const inside = n.leaves().map((l) => step.get(l.data.ref)).filter(Boolean).sort((a, b) => a - b);
        if (!inside.length) continue;
        badges.push({ id: n.data.id, x: sx(n) + sr(n) * 0.62, y: sy(n) - sr(n) * 0.62, text: spans(inside), last: inside.includes(tour ? step.get(goalId()) : trail.length) });
      }
    }
    gSteps.selectAll("g").data(badges, (b) => b.id).join((enter) => {
      const g = enter.append("g");
      g.append("rect");
      g.append("text");
      return g;
    })
      .attr("class", (b) => `m-step${b.last ? " goal" : ""}`)
      .attr("transform", (b) => `translate(${b.x},${b.y})`)
      .each(function (b) {
        const g = d3.select(this);
        const width = Math.max(16, b.text.length * 6.6 + 8);
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

  // The list of steps beside the map; choosing one zooms to where it is.
  function trailCard() {
    const narrowNow = matchMedia("(max-width: 760px), (max-height: 560px)").matches;
    const list = h("ol", { class: "trail-steps" }, trail.map((id) => {
      const c = store.concepts.get(id);
      const b = h("button", { type: "button", title: "Show on the map" }, c.title);
      b.addEventListener("click", () => {
        const n = L.byId.get("c:" + id);
        if (!n) return;
        zoomTo(n.parent);
        hover(n);
      });
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
    const items = tour.stops.map((st, i) => {
      const b = h("button", { type: "button" }, st.title);
      b.addEventListener("click", () => go(i));
      return h("li", {}, b);
    });
    const all = h("details", { class: "tour-all" }, h("summary", {}, "All stops"), h("ol", { class: "trail-steps" }, items));
    const close = h("a", { class: "trail-close", href: tour.back || "#/learn", "aria-label": "Leave the tour" }, "×");
    prev.addEventListener("click", () => go(atStop - 1));
    next.addEventListener("click", () => (atStop === last ? tour.onFinish?.() : go(atStop + 1)));
    const show = () => {
      const st = tour.stops[atStop];
      counter.textContent = `Stop ${atStop + 1} of ${tour.stops.length}`;
      title.textContent = st.title;
      narration.innerHTML = st.text ? tour.narrate(st.text) : "";
      prev.disabled = atStop === 0;
      next.textContent = atStop === last ? "Finish" : "Next";
      open.hidden = !st.id;
      if (st.id) open.href = conceptHref(st.id);
      items.forEach((li, i) => li.classList.toggle("goal", i === atStop));
    };
    function go(i) {
      if (i < 0 || i > last) return;
      atStop = i;
      show();
      tour.onStep?.(i);
      const id = goalId();
      const n = onMap(id) && L.byId.get("c:" + id);
      if (n) { zoomTo(n.parent); hover(n); }
      schedule();
    }
    const card = h("section", { class: "trail-card tour-card", "aria-label": `Tour: ${tour.title}`, tabindex: "-1" },
      h("p", { class: "tour-name" }, tour.title), counter, title, narration, h("div", { class: "tour-nav" }, prev, next, open), all, close);
    card.addEventListener("keydown", (e) => {
      if (e.target.closest?.("summary, a")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next.click(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev.click(); }
    });
    show();
    queueMicrotask(() => tour.onStep?.(atStop));
    return card;
  }

  // A view that holds every note on the path.
  function trailTransform() {
    const nodes = trail.map((id) => L.byId.get("c:" + id)).filter(Boolean);
    if (!nodes.length) return null;
    const x0 = d3.min(nodes, (n) => n.x - n.r), x1 = d3.max(nodes, (n) => n.x + n.r);
    const y0 = d3.min(nodes, (n) => n.y - n.r), y1 = d3.max(nodes, (n) => n.y + n.r);
    const pad = 70; // screen pixels, for labels and badges
    const k = Math.min(80, (w - 2 * pad) / (x1 - x0), (hgt - 2 * pad) / (y1 - y0));
    return d3.zoomIdentity.translate(w / 2 - k * (x0 + x1) / 2, hgt / 2 - k * (y0 + y1) / 2).scale(k);
  }

  function drawCrumbs() {
    const path = focus.ancestors().reverse();
    const where = focus.data.ref ? ` in ${focus.data.label}` : "";
    newNote.title = `Write a new note${where}`;
    newFolder.title = `Start a new folder${where}, a new region on the map`;
    crumbs.replaceChildren(...path.flatMap((n, i) => {
      const b = h("button", { type: "button", "aria-current": n === focus ? "location" : null }, n.data.label);
      b.addEventListener("click", () => zoomTo(n));
      return i ? [h("span", { "aria-hidden": "true" }, "/"), b] : [b];
    }));
  }

  function showTip(event, n) {
    const d = n.data;
    const lines = [h("strong", {}, d.label)];
    if (d.kind === "concept") {
      lines.push(h("span", {}, `${d.c.type || "Concept"} · ${TRUST_LABEL[trustState(d.c)]}${d.landmark ? " · Landmark" : ""}`));
      if (d.c.description) lines.push(h("div", {}, d.c.description));
    } else {
      const count = n.leaves().filter((l) => l.data.kind === "concept").length;
      lines.push(h("span", {}, `Folder · ${count} note${count === 1 ? "" : "s"}`));
    }
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
    const target = focusRef ? L.byId.get("d:" + focusRef) : null;
    const onTrail = trail && trailTransform();
    if (onTrail) svg.call(zoom.transform, onTrail);
    else if (target) svg.call(zoom.transform, fitTransform(target));
    else svg.call(zoom.transform, M.transform || fitTransform(L.root));
  }
  arrange();
  requestAnimationFrame(() => {
    size();
    viewed = true;
    initialView();
  });
  const onResize = () => { size(); schedule(); };
  window.addEventListener("resize", onResize);
  wrap.leave = () => { left = true; svg.interrupt(); window.removeEventListener("resize", onResize); persist(); };
  wrap.refresh = () => { model = timed("map-model", buildModel); o = effective(); rebuild(); };
  M.reset = () => zoomTo(L.root);
  wrap.routes = () => cache?.routes || []; // for tests and inspection
  wrap.layout = () => L;
  wrap.model = () => model;
  return wrap;
}

// --------------------------------------------------------------- panel

function controls({ view, tune, readout, summary }) {
  const narrow = matchMedia("(max-width: 760px), (max-height: 560px)").matches; // start collapsed where space is short
  const o = effective();
  const slider = (key, text, min, max, step, onChange, help) => {
    const fmt = (v) => (step < 1 ? Number(v).toFixed(2) : String(v));
    const input = h("input", { type: "range", min, max, step, value: o[key], "aria-label": text });
    const out = h("output", {}, fmt(o[key]));
    input.addEventListener("input", () => {
      M.user[key] = Number(input.value);
      out.textContent = fmt(M.user[key]);
      persist();
      onChange();
    });
    return h("label", { class: "slider", title: help || null }, h("span", {}, text), input, out);
  };
  // Two thumbs on one track: the lowest and highest value to show. The thumb
  // nearest the pointer moves; when they sit together, the direction of the
  // drag decides which. Arrow keys move a focused thumb.
  const dual = ([kLo, kHi], text, min, max, label, help) => {
    const clamp = (v) => Math.max(min, Math.min(max, Math.round(v)));
    const now = effective();
    let lo = clamp(now[kLo]), hi = Math.max(lo, clamp(now[kHi]));
    const track = h("span", { class: "dual" });
    const fill = h("span", { class: "dual-fill" });
    const thumb = (end, cls) => h("span", { class: `dual-thumb ${cls}`, role: "slider", tabindex: 0, "aria-label": `${text}: ${end}`,
      "aria-valuemin": min, "aria-valuemax": max });
    const tLo = thumb("from", "lo"), tHi = thumb("to", "hi");
    track.append(fill, tLo, tHi);
    const out = h("output");
    const pct = (v) => (max === min ? 0 : ((v - min) / (max - min)) * 100);
    const draw = () => {
      tLo.style.left = `${pct(lo)}%`; tHi.style.left = `${pct(hi)}%`;
      fill.style.left = `${pct(lo)}%`; fill.style.width = `${pct(hi) - pct(lo)}%`;
      for (const [t, v] of [[tLo, lo], [tHi, hi]]) { t.setAttribute("aria-valuenow", v); t.setAttribute("aria-valuetext", label(v)); }
      out.textContent = lo === hi ? label(lo) : `${label(lo)} to ${label(hi)}`;
    };
    const commit = () => {
      if (M.user[kLo] === lo && M.user[kHi] === hi) return;
      M.user[kLo] = lo; M.user[kHi] = hi; persist(); view();
    };
    const valueAt = (x) => { const r = track.getBoundingClientRect(); return clamp(min + Math.max(0, Math.min(1, (x - r.left) / r.width)) * (max - min)); };
    let active = null, startX = 0;
    const move = (v) => { if (active === "lo") lo = Math.min(v, hi); else if (active === "hi") hi = Math.max(v, lo); draw(); commit(); };
    track.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      track.setPointerCapture(e.pointerId);
      startX = e.clientX;
      const v = valueAt(e.clientX);
      if (lo === hi) {
        // Together: the half pressed (the lower thumb sits left of the value)
        // decides, and dragging still works in either direction.
        const r = track.getBoundingClientRect(), at = r.left + (pct(lo) / 100) * r.width;
        active = v < lo ? "lo" : v > hi ? "hi" : Math.abs(e.clientX - at) > 1 ? (e.clientX < at ? "lo" : "hi") : null;
      } else active = Math.abs(v - lo) <= Math.abs(v - hi) ? "lo" : "hi";
      if (active) move(v);
    });
    track.addEventListener("pointermove", (e) => {
      if (!track.hasPointerCapture(e.pointerId)) return;
      if (!active) { if (Math.abs(e.clientX - startX) < 3) return; active = e.clientX < startX ? "lo" : "hi"; }
      move(valueAt(e.clientX));
    });
    const release = (e) => { if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId); active = null; };
    track.addEventListener("pointerup", release);
    track.addEventListener("pointercancel", release);
    for (const [t, end] of [[tLo, "lo"], [tHi, "hi"]]) {
      t.addEventListener("keydown", (e) => {
        const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
        if (!step) return;
        e.preventDefault();
        active = end;
        move(clamp((end === "lo" ? lo : hi) + step));
        active = null;
      });
    }
    draw();
    return h("div", { class: "slider dual-slider", title: help }, h("span", {}, text), track, out);
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
  const maxDepth = Math.max(0, ...Object.keys(store.tree).filter(Boolean).map((id) => id.split("/").length));
  const rated = [...store.concepts.values()].some((c) => c.links.some((l) => l.rel));
  const walls = (v) => (v === 0 ? "same folder" : `${v} bubble${v === 1 ? "" : "s"}`);
  // The distance slider's range depends on how distance is counted.
  const distance = h("div", { class: "dist" });
  const drawDistance = () => {
    const e = effective();
    const max = e.distMeasure === "path" ? 2 * maxDepth : maxDepth;
    const measure = h("div", { class: "row seg" }, h("span", {}, "Count"),
      ...[["out", "Steps out", "The larger of the two ends' distances out to the lowest folder they share."],
          ["path", "Path length", "All bubble walls crossed, out from one end and in to the other."]].map(([key, text, help]) => {
        const b = h("button", { class: "toggle", type: "button", "aria-pressed": String(e.distMeasure === key), title: help }, text);
        b.addEventListener("click", () => {
          if (effective().distMeasure === key) return;
          M.user.distMeasure = key;
          M.user.distMin = 0; M.user.distMax = key === "path" ? 2 * maxDepth : maxDepth;
          persist(); drawDistance(); view();
        });
        return b;
      }));
    distance.replaceChildren(
      dual(["distMin", "distMax"], "Distance", 0, max, walls,
        "Which links to show by how many bubble walls separate their ends; 0 is links within one folder."),
      measure);
  };
  drawDistance();
  const button = (text, fn) => { const b = h("button", { class: "toggle", type: "button" }, text); b.addEventListener("click", fn); return b; };
  // One of a few values, as pressed buttons.
  const choice = (key, text, options) => {
    const buttons = options.map(([value, label, help]) => {
      const b = h("button", { class: "toggle", type: "button", "aria-pressed": String(effective()[key] === value), title: help }, label);
      b.addEventListener("click", () => {
        M.user[key] = value;
        buttons.forEach((x, i) => x.setAttribute("aria-pressed", String(options[i][0] === value)));
        persist(); view();
      });
      return b;
    });
    return h("div", { class: "row seg", role: "group", "aria-label": text }, h("span", {}, text), ...buttons);
  };

  // Tuning: every layout and routing parameter, with a way to keep the result.
  const snippet = h("pre", { class: "map-snippet", hidden: true });
  const showSnippet = () => {
    const e = effective();
    const toml = (v) => (typeof v === "string" ? JSON.stringify(v) : String(v));
    const lines = ["[map]", ...Object.keys(VIEW_DEFAULTS).map((k) => `${k} = ${toml(e[k])}`), ...TUNING.map(([k]) => `${k} = ${toml(e[k])}`)];
    snippet.textContent = lines.join("\n");
    snippet.hidden = !snippet.hidden;
  };
  const tuning = h("details", { class: "graph-options map-tuning" },
    h("summary", {}, "Tuning"),
    h("div", { class: "sliders" }, TUNING.map(([key, text, min, max, step, , help]) => slider(key, text, min, max, step, tune, help))),
    readout,
    h("div", { class: "row" },
      button("Reset tuning", () => { for (const [k] of TUNING) delete M.user[k]; persist(); location.reload(); }),
      button("Show as rdstudio.toml", showSnippet)),
    snippet);

  // The key: the kinds of note on this map, where you stand, and the lines.
  const svgKey = (inner, box = "-11 -11 22 22") => {
    const icon = h("svg:svg", { width: 22, height: 22, viewBox: box, class: "m-key", "aria-hidden": "true" });
    icon.innerHTML = inner;
    return icon;
  };
  const kinds = h("div", { class: "legend map-legend kinds" });
  const types = new Map();
  for (const c of store.concepts.values()) if (c.type && isStudyNote(c) && !types.has(c.type)) types.set(c.type, markerFor(c.type));
  for (const [type, shape] of [...types].sort()) {
    const d = d3.symbol(SYMBOLS[shape], 30)();
    kinds.append(h("span", {}, svgKey(`<path d="${d}" class="key-shape"/>${shape === "ring" ? '<path d="M-3.1 0H3.1" class="key-shape bar"/>' : ""}`, "-7 -7 14 14"), titleCase(type)));
  }
  const dotAt = (r) => d3.symbol(d3.symbolCircle, Math.PI * r * r)();
  const place = (cls, r, rings = "") => `<g class="m-place circle ${cls}">${rings}<path class="mark" d="${dotAt(r)}"/></g>`;
  const item = (icon, text) => h("li", {}, icon, h("span", {}, text));
  // Where each note stands under the height lens, and the frontier.
  const states = (lens) => {
    const ring2 = '<circle class="ring-a" r="8.5"/><circle class="ring-b" r="6"/>', ring1 = '<circle class="ring-a" r="8.5"/>';
    const words = {
      understanding: ["Understood: filled, double green ring", "Worked through: filled", "Opened: outline", "Not reached: faint, in fog"],
      activity: ["Changed this week: filled, ringed", "This month: filled", "This quarter: outline", "90 days untouched: faint, in fog"],
      health: ["Reviewed, tested and current: double green ring", "Two of the three: filled", "One: outline", "None: faint, in fog"],
    }[lens];
    return [
      item(svgKey(place("st-understood" + (lens === "activity" ? " plain" : ""), 3.5, lens === "activity" ? ring1 : ring2)), words[0]),
      item(svgKey(place("st-processed", 4.5)), words[1]),
      item(svgKey(place("st-discovered", 4.5)), words[2]),
      item(svgKey(place("st-undiscovered", 3.5)), words[3]),
      ...(lens === "understanding" ? [item(svgKey(place("needs st-discovered", 4, ring1)), "The teacher says: needs work")] : []),
      item(svgKey('<path d="M2 12H20" class="a-front"/><path d="M4 12v-6M8 12v-3M12 12v-6M16 12v-3M20 12v-6" class="a-hach"/>', "0 0 22 22"), "Frontier: hachures face the fog"),
    ];
  };
  const lines = [
    item(svgKey('<path d="M2 11H20" class="m-link trunk" stroke-width="2"/>', "0 0 22 22"), "Trunk: the links between two folders, with their count"),
    item(svgKey('<circle r="8" class="m-dir open depth-1"/>'), "A folder's wall: trunks leave by gates on it"),
    item(svgKey('<path d="M2 11H20" class="m-link req"/>', "0 0 22 22"), "What the selected note requires or uses"),
    item(svgKey('<path d="M2 11H20" class="m-link dep"/>', "0 0 22 22"), "What builds on the selected note"),
    item(svgKey(place("landmark", 6)), "Landmark: drawn larger"),
  ];
  const key = h("ul", { class: "legend map-key" });
  const drawKey = () => { const e = effective(); key.replaceChildren(...(e.terrain ? states(heightLens(e)) : []), ...lines); };
  drawKey();
  // The height lenses: one at a time; choosing the one shown again puts the terrain away.
  const heights = Object.entries(LENSES).filter(([k]) => k !== "understanding" || understanding.on).map(([value, label]) => {
    const b = h("button", { class: "toggle", type: "button", title: {
      understanding: "The terrain of where you stand: reached ground is clear, the rest is fog.",
      activity: "High ground is recent work: changed this week, this month, this quarter; 90 days untouched is fog.",
      health: "High ground is settled: one step each for reviewed by a person, tested by an exercise, and current.",
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

  return h("div", { class: "graph-panel map-panel" },
    h("details", { class: "graph-options", open: !narrow },
      h("summary", {}, h("span", { class: "lens-label" }, "Lenses"), lensNames, h("span", { class: "lens-change" }, "Change")),
      h("h2", { class: "lens-title" }, "Lenses"),
      h("div", { class: "row lenses" },
        toggle("showLinks", "Links", "Trunks between folders, with their counts, and the links inside the folder in focus."),
        ...heights.map(([, b]) => b)),
      understanding.on ? h("label", { class: "hide-undiscovered" }, (() => {
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
        choice("folders", "Folders", [["contour", "Contours", "Each folder's outline follows where its contents sit."],
          ["circle", "Circles", "Each folder is the layout's own circle, its name along the arc."]]),
        choice("routing", "Routes", [["downhill", "Downhill", "Routes cross folder outlines at right angles and gather in the flats between folders."],
          ["gates", "Gates", "Routes leave each folder by a gate on its wall and follow corridors between its contents."]]),
        h("div", { class: "row" },
          toggle("allLinks", "Every link", "Draw every link at the shown scale instead of trunks, filtered by the settings below."),
          rated ? toggle("hideImplied", "Hide implied", "Hide a link when a chain of links at least as strong already connects its ends.") : "",
          toggle("focusOnly", "Focused folder only", "With every link drawn, show only links with an end inside the folder in focus."),
          toggle("lanes", "Lanes", "With every link drawn, one-way links keep to one side of their route and two-way links take the middle.")),
        h("div", { class: "sliders" },
          distance,
          rated ? dual(["rateMin", "rateMax"], "Importance", 1, 3, (v) => STRENGTH_LABEL[v],
            "With every link drawn, which links to show by rating: see also, uses (and unrated links), requires.") : "",
          slider("labels", "Labels", 5, 120, 1, view, "Most labels shown at once, most important first."),
          slider("detail", "Open folders at", 40, 400, 10, view, "A folder opens when its radius on screen passes this many pixels.")),
        h("div", { class: "row" },
          button("Show everything", () => M.reset?.()),
          button("Default view", () => { for (const k of Object.keys(VIEW_DEFAULTS)) delete M.user[k]; persist(); location.reload(); })))),
    tuning);
}
