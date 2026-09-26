// Map tab: the folder tree as nested territories (circle packing), notes as
// places, and links as routes that travel through the hierarchy: out of each
// folder by a gate on its edge, across the lowest folder containing both ends,
// and in again. See knowledge/design/map-view.md.
//
// Layout and routes are computed in layout units and cached; every zoom frame
// only transforms them to the screen and decides what is open and labelled.

import { store } from "./data.js";
import { h, conceptHref, trustState, TRUST_LABEL, titleCase } from "./util.js";

/* global d3 */

const KEY = "rdstudio.map";
const SIZE = 1000; // layout units

// View settings, shown in the Options panel.
export const VIEW_DEFAULTS = {
  labels: 30, detail: 140, showLinks: true,
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
  ["dot", "Dot size", 0.25, 0.9, 0.05, 0.6, "A note's dot as a fraction of the space the layout gives it."],
  ["dotMax", "Largest dot", 5, 24, 1, 10, "Cap on a dot's radius on screen, in pixels."],
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
  return Object.assign({}, VIEW_DEFAULTS, TUNING_DEFAULTS, project, M.user);
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
  const concepts = [...store.concepts.values()];
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
      weight: 1 + 2.5 * (rank.get(c.id) / top) + (landmark ? 1.5 : 0),
    });
  }
  for (const d of Object.values(store.tree)) {
    const node = dirs.get(d.id);
    node.subdirs = d.children.map((id) => dirs.get(id)).filter(Boolean);
    node.notes = chainOrder(d.concepts.map((id) => leaves.get(id)).filter(Boolean), adjacent);
  }
  // Larger folders first packs more tidily; notes follow in link order.
  const size = (d) => d.notes.length + d.subdirs.reduce((s, x) => s + size(x), 0);
  for (const node of dirs.values()) {
    node.children = [...node.subdirs.sort((a, b) => size(b) - size(a)), ...node.notes];
  }
  const maxDepth = Math.max(0, ...Object.keys(store.tree).filter(Boolean).map((id) => id.split("/").length));
  return { root: dirs.get(""), edges, implied: impliedLinks(ids, edges), hasRatings, maxDepth };
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

function layout(model, o) {
  const root = d3.hierarchy(model.root, (d) => (d.kind === "dir" ? d.children : null))
    .sum((d) => (d.kind === "concept" ? d.weight : d.children.length ? 0 : 1));
  d3.pack().size([SIZE, SIZE]).padding((d) => (d.depth === 0 ? 10 : 6))(root); // a starting arrangement
  const byId = new Map();
  root.each((n) => byId.set(n.data.id, n));
  const leafEdges = model.edges.map(([a, b]) => [byId.get("c:" + a), byId.get("c:" + b)]).filter(([a, b]) => a && b);

  const moveTree = (n, dx, dy) => n.each((d) => { d.x += dx; d.y += dy; });
  const scaleTree = (n, k) => n.each((d) => { d.x = n.x + (d.x - n.x) * k; d.y = n.y + (d.y - n.y) * k; d.r *= k; });
  const childOf = (folder, n) => n.ancestors().find((a) => a.parent === folder);

  // Top down: give each folder's contents room, then spread them out evenly
  // inside its wall, keeping linked items near each other and drawing items
  // towards the side where their links leave the folder.
  function arrange(folder) {
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
      const nodes = kids.map((c) => ({ c, x: c.x - folder.x, y: c.y - folder.y, r: c.r, pull: [0, 0, 0] }));
      const index = new Map(kids.map((c, i) => [c, i]));
      const links = [];
      for (const [u, v] of leafEdges) {
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
        .force("y", d3.forceY((d) => d.ty ?? 0).strength((d) => (d.ty !== undefined ? 0.04 * o.outward : 0.03)));
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
    kids.forEach(arrange);
  }
  arrange(root);

  const groups = [...new Set((root.children || []).map((c) => c.data.ref))].sort();
  root.each((n) => {
    const top = n.ancestors().reverse()[1];
    n.group = top ? (top.data.kind === "dir" ? groups.indexOf(top.data.ref) : -1) : -1;
  });
  return { root, byId };
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

export function mapView(focusRef = "") {
  document.title = `Map · ${store.site.title}`;
  let o = effective();
  const wrap = h("div", { class: "graph-wrap map-wrap" });
  const svg = d3.select(wrap).append("svg").attr("role", "img").attr("aria-label", "Knowledge map");
  const tip = h("div", { class: "graph-tip", hidden: true });
  const crumbs = h("nav", { class: "map-crumbs", "aria-label": "Current folder" });
  const readout = h("p", { class: "map-readout" });
  const panel = controls({
    view: () => { o = effective(); cache = null; schedule(); },
    tune: () => { o = effective(); rebuild(); },
    readout,
  });
  wrap.append(panel, crumbs, tip, h("div", { class: "graph-hint" }, "Click a note to open it, a region to zoom in, empty space to step out."));

  const defs = svg.append("defs");
  const back = svg.append("rect").attr("class", "m-back");
  const gRegions = svg.append("g");
  // Routes are drawn twice when a folder is in focus: faded everywhere, and at
  // full strength clipped to the focused folder, so the detail you are looking
  // at is clear while routes still show where they lead.
  const clip = defs.append("clipPath").attr("id", "m-focus-clip").append("circle");
  const gLinks = svg.append("g").attr("class", "m-routes");
  const gFocus = svg.append("g").attr("class", "m-routes m-focus").attr("clip-path", "url(#m-focus-clip)");
  const gImplied = svg.append("g").attr("class", "m-implied-links");
  const gNotes = svg.append("g");
  const gLabels = svg.append("g").attr("class", "m-labels");

  let model = buildModel();
  let L = layout(model, o);
  let cache = null; // routes for the current set of open folders
  let w = 800, hgt = 600;
  let focus = L.root;
  let hovered = null;
  let current = null; // screen helpers from the last render, for hover
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rebuild() {
    L = layout(model, o);
    cache = null;
    focus = L.root;
    schedule();
  }

  const zoom = d3.zoom().scaleExtent([0.2, 80]).on("zoom", (event) => {
    M.transform = event.transform;
    schedule();
  }).on("end", persist);
  svg.call(zoom).on("dblclick.zoom", null);

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(); });
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

  back.on("click", () => { if (focus.parent) zoomTo(focus.parent); });

  const fadeIn = (enter) => {
    if (!reduceMotion) enter.style("opacity", 0).transition().duration(220).style("opacity", null);
    return enter;
  };

  // Routes for every link between shown items; recomputed only when the set of
  // open folders (or a setting) changes, so zooming stays cheap.
  function routesFor(open) {
    const filters = ["showLinks", "distMeasure", "distMin", "distMax", "rateMin", "rateMax", "hideImplied", "focusOnly", "lanes"].map((k) => o[k]).join(",");
    const signature = [...open].map((n) => n.data.id).sort().join(",") + "|" + filters + (o.focusOnly ? "|" + focus.data.id : "");
    if (cache?.signature === signature) return cache;
    const shownRep = (leaf) => {
      for (const a of leaf.ancestors().reverse()) if (!(a.data.kind === "dir" && open.has(a))) return a;
      return leaf;
    };
    const merged = new Map();
    const inFocus = (n) => n.ancestors().includes(focus);
    let hidden = 0;
    const kept = [];
    if (o.showLinks) {
      for (const [a, b, s] of model.edges) {
        if (s < o.rateMin || s > o.rateMax) continue;
        if (o.hideImplied && model.hasRatings && model.implied.has(a + "\n" + b)) { hidden++; continue; }
        const na = L.byId.get("c:" + a), nb = L.byId.get("c:" + b);
        if (!na || !nb) continue;
        const d = wallsBetween(na, nb, o.distMeasure);
        if (d < o.distMin || d > o.distMax) continue;
        if (o.focusOnly && focus !== L.root && !inFocus(na) && !inFocus(nb)) continue;
        kept.push([a, b, s, na, nb]);
      }
    }
    const keptKeys = new Set(kept.map(([a, b]) => a + "\n" + b));
    for (const [a, b, s, na, nb] of kept) {
      {
        const within = na.parent === nb.parent;
        const ra = shownRep(na), rb = shownRep(nb);
        if (ra === rb) continue;
        const [p, q] = ra.data.id < rb.data.id ? [ra, rb] : [rb, ra];
        // With lanes on, one-way links travel apart from two-way ones: +1 from p
        // to q, -1 from q to p, 0 both ways.
        const lane = !o.lanes || keptKeys.has(b + "\n" + a) ? 0 : ra === p ? 1 : -1;
        const key = p.data.id + "|" + q.data.id + (o.lanes ? "|" + lane : "");
        const m = merged.get(key) || { key, pair: p.data.id + "|" + q.data.id, lane, p, q, count: 0, across: 0, strength: 0, ends: new Set(), links: [] };
        m.count += 1;
        if (!within) m.across += 1;
        m.strength = Math.max(m.strength, s);
        m.ends.add(na.data.id); m.ends.add(nb.data.id);
        m.links.push([a, b, s]);
        merged.set(key, m);
      }
    }
    // Heavier bundles first, so lighter ones follow their corridors.
    const router = makeRouter(o);
    const routes = [...merged.values()].sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1));
    const byPair = new Map(); // lanes of the same pair share one route
    for (const m of routes) {
      if (!byPair.has(m.pair)) byPair.set(m.pair, router.route(m.p, m.q));
      m.pts = byPair.get(m.pair);
    }
    const shown = [];
    L.root.each((n) => { if (n.parent && open.has(n.parent)) shown.push(n); });
    // Measure each physical route once, however many lanes share it.
    const physical = [...new Map(routes.map((m) => [m.pair, m])).values()];
    const count = crossings(physical, shown, router.itemRadius);
    // Stretch: how much longer routes are than straight lines, on average.
    const len = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    const stretch = physical.length ? physical.reduce((s, r) => s + len(r.pts) / Math.max(1, Math.hypot(r.p.x - r.q.x, r.p.y - r.q.y)), 0) / physical.length : 1;
    readout.textContent = `${routes.length} routes · ${hidden} implied links hidden · ${count.bubbles} through bubbles · ${count.lines} route crossings · ${stretch.toFixed(2)}× stretch`;
    Object.assign(readout.dataset, { bubbles: count.bubbles, lines: count.lines, stretch: stretch.toFixed(3), routes: routes.length, hidden });
    cache = { signature, routes, shownRep };
    return cache;
  }

  function render() {
    const t = M.transform || d3.zoomIdentity;
    const sx = (n) => t.applyX(n.x), sy = (n) => t.applyY(n.y), sr = (n) => n.r * t.k;
    // Notes are drawn as places of bounded size.
    const dot = (n) => Math.max(2.5, Math.min(n.data.landmark ? o.dotMax + 3 : o.dotMax, n.r * o.dot * t.k));
    const radius = (n) => (n.data.kind === "concept" ? dot(n) + (n.data.landmark ? 3 : 0) : sr(n));
    const onScreen = (n) => sx(n) + sr(n) > 0 && sx(n) - sr(n) < w && sy(n) + sr(n) > 0 && sy(n) - sr(n) < hgt;

    // What is open: the root, and any folder big enough on screen whose parent is open.
    const open = new Set();
    L.root.each((n) => {
      if (n.data.kind !== "dir") return;
      if (!n.parent || (open.has(n.parent) && sr(n) >= o.detail)) open.add(n);
    });
    const visible = [];
    L.root.each((n) => { if (n.parent && open.has(n.parent) && onScreen(n)) visible.push(n); });

    // Focus: the deepest open folder under the centre of the view.
    focus = L.root;
    for (const n of open) {
      const d = Math.hypot(sx(n) - w / 2, sy(n) - hgt / 2);
      if (d < sr(n) && sr(n) >= Math.min(w, hgt) * 0.3 && n.depth > focus.depth) focus = n;
    }
    drawCrumbs();

    // Territories (folders), outermost first so inner ones sit on top.
    const regions = visible.filter((n) => n.data.kind === "dir").sort((a, b) => a.depth - b.depth);
    gRegions.selectAll("circle").data(regions, (n) => n.data.id).join((enter) => fadeIn(enter.append("circle")))
      .attr("class", (n) => `m-dir ${open.has(n) ? "open" : "closed"} depth-${Math.min(n.depth, 3)}`)
      .attr("cx", sx).attr("cy", sy).attr("r", sr)
      .style("--c", (n) => (n.group >= 0 ? PALETTE[n.group % PALETTE.length] : "var(--ink-faint)"))
      .on("click", (event, n) => { event.stopPropagation(); zoomTo(n === focus && n.parent ? n.parent : n); })
      .on("pointerenter", (event, n) => showTip(event, n))
      .on("pointerleave", () => { tip.hidden = true; });

    // Routes.
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
    const pathFor = (m) => {
      let s = toScreen(m.pts);
      const near = (pt, n) => Math.hypot(pt[0] - sx(n), pt[1] - sy(n)) < radius(n) + 14;
      s = [s[0], ...s.slice(1, -1).filter((pt) => !near(pt, m.p) && !near(pt, m.q)), s[s.length - 1]];
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
    const focused = focus !== L.root;
    const inFocus = (n) => n.ancestors().includes(focus);
    const drawRoutes = (group, list) => group.selectAll("path").data(list, (m) => m.key).join((enter) => fadeIn(enter.append("path")))
      .attr("class", (m) => `m-link s${m.strength}${m.across === m.count ? " across" : m.across ? " mixed" : ""}`)
      .attr("stroke-width", (m) => o.width * (1 + 0.9 * Math.log2(m.count)))
      .attr("d", pathFor)
      .selectAll("title").data((m) => [m]).join("title")
      .text((m) => `${m.count} link${m.count > 1 ? "s" : ""} between ${m.p.data.label} and ${m.q.data.label} (strongest: ${STRENGTH_LABEL[m.strength]})`);
    gLinks.classed("context", focused);
    drawRoutes(gLinks, routes);
    clip.attr("cx", sx(focus)).attr("cy", sy(focus)).attr("r", focused ? sr(focus) : 0);
    drawRoutes(gFocus, focused ? routes.filter((m) => inFocus(m.p) || inFocus(m.q)) : []);

    // Places (notes): a marker shaped by type, with a ring for landmarks.
    const notes = visible.filter((n) => n.data.kind === "concept");
    gNotes.selectAll("g.m-place").data(notes, (n) => n.data.id).join((enter) => {
      const g = enter.append("g").attr("tabindex", 0).attr("role", "link");
      g.append("circle").attr("class", "ring");
      g.append("path").attr("class", "mark");
      return fadeIn(g);
    })
      .attr("class", (n) => `m-place ${n.data.marker}${n.data.landmark ? " landmark" : ""} ${trustState(n.data.c)}`)
      .attr("aria-label", (n) => n.data.label)
      .attr("transform", (n) => `translate(${sx(n)},${sy(n)})`)
      .style("--c", (n) => (n.group >= 0 ? PALETTE[n.group % PALETTE.length] : "var(--ink-soft)"))
      .on("click", (event, n) => { event.stopPropagation(); persist(); location.hash = conceptHref(n.data.ref); })
      .on("keydown", (event, n) => { if (event.key === "Enter") { persist(); location.hash = conceptHref(n.data.ref); } })
      .on("pointerenter", (event, n) => { showTip(event, n); hover(n); })
      .on("pointerleave", () => { tip.hidden = true; hover(null); })
      .each(function (n) {
        const r = dot(n);
        const g = d3.select(this);
        g.select(".ring").attr("r", n.data.landmark ? r + 3.5 : 0);
        g.select(".mark").attr("d", d3.symbol(SYMBOLS[n.data.marker], Math.PI * r * r)());
      });

    current = { sx, sy, radius };
    drawLabels(open, visible, notes, sx, sy, sr, dot);
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
    const arcs = [], texts = [];

    // Open territories: name along the top of the region, outermost first.
    for (const n of [...open].filter((n) => n.parent).sort((a, b) => a.depth - b.depth)) {
      if (arcs.length + texts.length >= budget) break;
      const R = sr(n) - 8;
      const width = n.data.label.length * 8.6;
      if (R < 30 || width > R * 2.2) continue;
      const box = [sx(n) - width / 2, sy(n) - R - 8, sx(n) + width / 2, sy(n) - R + 14];
      if (!fits(box)) continue;
      placed.push(box);
      arcs.push({ n, R });
    }
    // Closed territories: name and size in the middle.
    const closed = visible.filter((n) => n.data.kind === "dir" && !open.has(n)).sort((a, b) => sr(b) - sr(a));
    for (const n of closed) {
      if (arcs.length + texts.length >= budget) break;
      const count = n.leaves().filter((l) => l.data.kind === "concept").length;
      const lines = [n.data.label, `${count} note${count === 1 ? "" : "s"}`];
      const width = n.data.label.length * 8.2;
      if (sr(n) < 14) continue;
      const box = [sx(n) - width / 2, sy(n) - 12, sx(n) + width / 2, sy(n) + 18];
      if (!fits(box)) continue;
      placed.push(box);
      texts.push({ n, x: sx(n), y: sy(n) - 1, lines, anchor: "middle", cls: "territory" });
    }
    // Places: beside the marker, trying right, left, above and below.
    const ranked = [...notes].sort((a, b) => b.data.weight - a.data.weight || sr(b) - sr(a));
    for (const n of ranked) {
      if (arcs.length + texts.length >= budget) break;
      const r = dot(n) + (n.data.landmark ? 4 : 0), x = sx(n), y = sy(n);
      const charW = n.data.landmark ? 6.9 : 6.4;
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
      texts.push({ n, x: spot.tx, y: spot.box[1] + 11, lines, anchor: spot.anchor, cls: n.data.landmark ? "place landmark" : "place" });
    }

    defs.selectAll("path").data(arcs, (a) => a.n.data.id).join("path")
      .attr("id", (a) => "arc-" + a.n.data.id.replace(/[^\w-]/g, "_"))
      .attr("d", (a) => {
        const cx = sx(a.n), cy = sy(a.n), R = a.R;
        const a0 = (-160 * Math.PI) / 180, a1 = (-20 * Math.PI) / 180;
        return `M${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)} A${R},${R} 0 0 1 ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)}`;
      });
    gLabels.selectAll("text.m-arc").data(arcs, (a) => a.n.data.id).join((enter) => {
      const text = enter.append("text").attr("class", "m-arc");
      text.append("textPath").attr("startOffset", "50%").attr("text-anchor", "middle");
      return text;
    })
      .select("textPath")
      .attr("href", (a) => "#arc-" + a.n.data.id.replace(/[^\w-]/g, "_"))
      .text((a) => a.n.data.label);
    gLabels.selectAll("text.m-text").data(texts, (d) => d.n.data.id).join("text")
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

  function drawCrumbs() {
    const path = focus.ancestors().reverse();
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

  requestAnimationFrame(() => {
    size();
    const target = focusRef ? L.byId.get("d:" + focusRef) : null;
    if (target) svg.call(zoom.transform, fitTransform(target));
    else svg.call(zoom.transform, M.transform || fitTransform(L.root));
  });
  const onResize = () => { size(); schedule(); };
  window.addEventListener("resize", onResize);
  wrap.leave = () => { window.removeEventListener("resize", onResize); persist(); };
  wrap.refresh = () => { model = buildModel(); o = effective(); rebuild(); };
  M.reset = () => zoomTo(L.root);
  wrap.routes = () => cache?.routes || []; // for tests and inspection
  wrap.layout = () => L;
  return wrap;
}

// --------------------------------------------------------------- panel

function controls({ view, tune, readout }) {
  const narrow = matchMedia("(max-width: 760px)").matches;
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
    const thumb = (end) => h("span", { class: "dual-thumb", role: "slider", tabindex: 0, "aria-label": `${text}: ${end}`,
      "aria-valuemin": min, "aria-valuemax": max });
    const tLo = thumb("from"), tHi = thumb("to");
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
      if (lo === hi) active = v < lo ? "lo" : v > hi ? "hi" : null; // together: wait for the drag direction
      else active = Math.abs(v - lo) <= Math.abs(v - hi) ? "lo" : "hi";
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
  const toggle = (key, text, help) => {
    const b = h("button", { class: "toggle", type: "button", "aria-pressed": String(!!o[key]), title: help }, text);
    b.addEventListener("click", () => { M.user[key] = !effective()[key]; b.setAttribute("aria-pressed", String(M.user[key])); persist(); view(); });
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

  // Tuning: every layout and routing parameter, with a way to keep the result.
  const snippet = h("pre", { class: "map-snippet", hidden: true });
  const showSnippet = () => {
    const e = effective();
    const lines = ["[map]", ...Object.keys(VIEW_DEFAULTS).map((k) => `${k} = ${e[k]}`), ...TUNING.map(([k]) => `${k} = ${e[k]}`)];
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

  const legend = h("div", { class: "legend map-legend" });
  const types = new Map();
  for (const c of store.concepts.values()) if (c.type && !types.has(c.type)) types.set(c.type, markerFor(c.type));
  for (const [type, shape] of [...types].sort()) {
    const icon = d3.select(h("svg:svg", { width: 14, height: 14, viewBox: "-7 -7 14 14", class: `m-key ${shape}` }));
    icon.append("path").attr("d", d3.symbol(SYMBOLS[shape], 36)());
    legend.append(h("span", {}, icon.node(), type));
  }
  legend.append(h("span", {}, h("i", { class: "key-landmark" }), "Landmark"));

  return h("div", { class: "graph-panel map-panel" },
    h("details", { class: "graph-options", open: !narrow },
      h("summary", {}, "Options"),
      h("div", { class: "row" },
        toggle("showLinks", "Links", "Show links at all."),
        rated ? toggle("hideImplied", "Hide implied", "Hide a link when a chain of links at least as strong already connects its ends.") : "",
        toggle("focusOnly", "Focused folder only", "When zoomed into a folder, show only links with an end inside it."),
        toggle("lanes", "Lanes", "One-way links keep to one side of their route and two-way links take the middle, so opposite directions separate.")),
      h("div", { class: "sliders" },
        distance,
        rated ? dual(["rateMin", "rateMax"], "Importance", 1, 3, (v) => STRENGTH_LABEL[v],
          "Which links to show by rating: see also, uses (and unrated links), requires.") : "",
        slider("labels", "Labels", 5, 120, 1, view, "Most labels shown at once, most important first."),
        slider("detail", "Open folders at", 60, 400, 10, view, "A folder opens when its radius on screen passes this many pixels.")),
      legend,
      rated ? h("p", { class: "map-hint" }, "On hover: dark routes lead to what a note needs, coloured routes to what needs it.") : "",
      h("div", { class: "row" },
        button("Show everything", () => M.reset?.()),
        button("Default view", () => { for (const k of Object.keys(VIEW_DEFAULTS)) delete M.user[k]; persist(); location.reload(); }))),
    tuning);
}
