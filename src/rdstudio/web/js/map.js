// Map tab: the folder tree as nested regions (circle packing), with each link
// drawn at the scale where it lives. See knowledge/design/map-view.md.
//
// Everything is drawn in screen coordinates on every zoom frame: the packed
// layout is fixed, and what is open, which links are merged and which labels
// fit all depend on the current zoom.

import { store } from "./data.js";
import { h, conceptHref, trustState, TRUST_LABEL, titleCase } from "./util.js";

/* global d3 */

const KEY = "rdstudio.map";
const SIZE = 1000; // layout units
export const MAP_DEFAULTS = { labels: 30, detail: 140, links: "all" };
const LINK_MODES = [["all", "All"], ["within", "Within folders"], ["across", "Across folders"], ["none", "None"]];
const PALETTE = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `var(--g${i})`);

const saved = (() => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
})();

const M = {
  opts: Object.assign({}, MAP_DEFAULTS, saved.opts || {}),
  transform: saved.transform ? d3.zoomIdentity.translate(saved.transform.x, saved.transform.y).scale(saved.transform.k) : null,
};

function persist() {
  const t = M.transform;
  try {
    localStorage.setItem(KEY, JSON.stringify({ opts: M.opts, transform: t ? { x: t.x, y: t.y, k: t.k } : null }));
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
  const edges = [];
  const seen = new Set();
  const adjacent = new Map(ids.map((id) => [id, new Set()]));
  for (const c of concepts) {
    for (const l of c.links) {
      if (l.broken || l.kind !== "concept" || !known.has(l.target) || l.target === c.id) continue;
      const key = c.id + "\n" + l.target;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([c.id, l.target]);
      adjacent.get(c.id).add(l.target);
      adjacent.get(l.target).add(c.id);
    }
  }
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
    const leaf = {
      kind: "concept", id: "c:" + c.id, ref: c.id, label: c.title, c, landmark,
      weight: 1 + 2.5 * (rank.get(c.id) / top) + (landmark ? 1.5 : 0),
    };
    leaves.set(c.id, leaf);
  }
  for (const d of Object.values(store.tree)) {
    const node = dirs.get(d.id);
    const subdirs = d.children.map((id) => dirs.get(id)).filter(Boolean);
    const notes = d.concepts.map((id) => leaves.get(id)).filter(Boolean);
    node.subdirs = subdirs;
    node.notes = chainOrder(notes, adjacent);
  }
  // Larger folders first packs more tidily; notes follow in link order.
  const size = (d) => d.notes.length + d.subdirs.reduce((s, x) => s + size(x), 0);
  for (const node of dirs.values()) {
    node.children = [...node.subdirs.sort((a, b) => size(b) - size(a)), ...node.notes];
  }
  return { root: dirs.get(""), edges, leaves };
}

function layout(model) {
  const root = d3.hierarchy(model.root, (d) => (d.kind === "dir" ? d.children : null))
    .sum((d) => (d.kind === "concept" ? d.weight : d.children.length ? 0 : 1));
  d3.pack().size([SIZE, SIZE]).padding((d) => (d.depth === 0 ? 30 : 16))(root);
  const byId = new Map();
  const groups = [...new Set((root.children || []).map((c) => c.data.ref))].sort();
  root.each((n) => {
    byId.set(n.data.id, n);
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

function lowestCommon(a, b) {
  const up = new Set(a.ancestors());
  for (const n of b.ancestors()) if (up.has(n)) return n;
  return null;
}

// --------------------------------------------------------------- routing
//
// Links run through the gaps between the items of the folder they belong to.
// The items' centres are triangulated (Delaunay); each triangle edge between two
// items has a waypoint in the middle of the gap between them, and the
// waypoints of one triangle are joined to each other. That network of
// corridors is routed with shortest paths, and corridors already used get a
// little cheaper, so links heading the same way bundle together.

const DOT = 0.55; // a note's dot, as a fraction of the space the packing gives it

function itemRadius(n) {
  return n.data.kind === "concept" ? n.r * DOT : n.r;
}

// Does the segment p–q pass through circle c (shrunk by a small margin)?
function crosses(p, q, c, r) {
  const dx = q.x - p.x, dy = q.y - p.y, len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / len2));
  return Math.hypot(p.x + t * dx - c.x, p.y + t * dy - c.y) < r * 0.98;
}

function corridors(folder) {
  const items = folder.children || [];
  const nodes = []; // waypoints: { x, y }
  const adj = []; // waypoint index -> [{ to, w, key }]
  const touching = new Map(); // item index -> [waypoint index]
  if (items.length < 2) return { items, nodes, adj, touching };
  const index = new Map(items.map((n, i) => [n, i]));
  const add = (i, wp) => { if (!touching.has(i)) touching.set(i, []); touching.get(i).push(wp); };
  const edgeWaypoint = new Map();
  const waypoint = (i, j) => {
    const key = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (edgeWaypoint.has(key)) return edgeWaypoint.get(key);
    const a = items[i], b = items[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const gap = d - itemRadius(a) - itemRadius(b);
    let id = -1;
    if (gap > 1) {
      const t = (itemRadius(a) + gap / 2) / d;
      id = nodes.push({ x: a.x + dx * t, y: a.y + dy * t }) - 1;
      adj.push([]);
      add(i, id); add(j, id);
    }
    edgeWaypoint.set(key, id);
    return id;
  };
  if (items.length === 2) {
    waypoint(0, 1);
    return { items, nodes, adj, touching, index };
  }
  const delaunay = d3.Delaunay.from(items, (n) => n.x, (n) => n.y);
  const tri = delaunay.triangles;
  const link = (u, v) => {
    const p = nodes[u], q = nodes[v];
    // A corridor through an item is a last resort.
    const blocked = items.some((m) => crosses(p, q, m, itemRadius(m)));
    const w = Math.hypot(p.x - q.x, p.y - q.y) * (blocked ? 20 : 1);
    const key = u < v ? `${u}-${v}` : `${v}-${u}`;
    adj[u].push({ to: v, w, key });
    adj[v].push({ to: u, w, key });
  };
  for (let t = 0; t < tri.length; t += 3) {
    const [i, j, k] = [tri[t], tri[t + 1], tri[t + 2]];
    const ws = [waypoint(i, j), waypoint(j, k), waypoint(k, i)].filter((x) => x >= 0);
    if (ws.length < 2) continue;
    // The open space in the middle of the triangle joins its gaps, so routes
    // bend around the items instead of cutting across them.
    const mid = nodes.push({
      x: ws.reduce((sum, x) => sum + nodes[x].x, 0) / ws.length,
      y: ws.reduce((sum, x) => sum + nodes[x].y, 0) / ws.length,
    }) - 1;
    adj.push([]);
    for (const x of ws) link(x, mid);
  }
  return { items, nodes, adj, touching, index };
}

// Shortest path from item a to item b through the corridors (Dijkstra; the
// networks are small). Returns layout-space points from a's centre to b's.
function route(net, a, b, discount) {
  const ia = net.index?.get(a), ib = net.index?.get(b);
  const straight = [[a.x, a.y], [b.x, b.y]];
  if (ia === undefined || ib === undefined) return straight;
  const starts = net.touching.get(ia) || [], ends = new Set(net.touching.get(ib) || []);
  if (!starts.length || !ends.size) return straight;
  const dist = new Map(), prev = new Map(), done = new Set();
  for (const s of starts) dist.set(s, Math.hypot(net.nodes[s].x - a.x, net.nodes[s].y - a.y));
  let best = null, bestCost = Infinity;
  while (true) {
    let u = -1, du = Infinity;
    for (const [k, v] of dist) if (!done.has(k) && v < du) { u = k; du = v; }
    if (u < 0 || du >= bestCost) break;
    done.add(u);
    if (ends.has(u)) {
      const total = du + Math.hypot(net.nodes[u].x - b.x, net.nodes[u].y - b.y);
      if (total < bestCost) { best = u; bestCost = total; }
    }
    for (const e of net.adj[u]) {
      const nd = du + e.w * (discount.get(e.key) || 1);
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: u, key: e.key }); }
    }
  }
  if (best === null) return straight;
  const path = [];
  for (let u = best; u !== undefined; u = prev.get(u)?.from) {
    path.push(u);
    const step = prev.get(u);
    if (step) discount.set(step.key, Math.max(0.5, (discount.get(step.key) || 1) * 0.85));
  }
  path.reverse();
  return pull([{ x: a.x, y: a.y }, ...path.map((i) => net.nodes[i]), { x: b.x, y: b.y }],
    net.items.filter((n) => n !== a && n !== b));
}

// Straighten a route: keep only the waypoints needed to get around obstacles.
function pull(points, obstacles) {
  const clear = (p, q) => !obstacles.some((o) => crosses(p, q, o, itemRadius(o)));
  const out = [points[0]];
  let i = 0;
  while (i < points.length - 1) {
    let j = points.length - 1;
    while (j > i + 1 && !clear(points[i], points[j])) j--;
    out.push(points[j]);
    i = j;
  }
  return out.map((p) => [p.x, p.y]);
}

// --------------------------------------------------------------- view

const curve = d3.line().curve(d3.curveBasis); // stays within its waypoints: no loops

export function mapView(focusRef = "") {
  document.title = `Map · ${store.site.title}`;
  const wrap = h("div", { class: "graph-wrap map-wrap" });
  const svg = d3.select(wrap).append("svg").attr("role", "img").attr("aria-label", "Knowledge map");
  const tip = h("div", { class: "graph-tip", hidden: true });
  const crumbs = h("nav", { class: "map-crumbs", "aria-label": "Current folder" });
  const panel = controls(() => { routes.clear(); schedule(); });
  wrap.append(panel, crumbs, tip, h("div", { class: "graph-hint" }, "Click a note to open it, a region to zoom in, empty space to step out."));

  const defs = svg.append("defs");
  const back = svg.append("rect").attr("class", "m-back");
  const gRegions = svg.append("g");
  const gLinks = svg.append("g").attr("class", "m-routes");
  const gDetail = svg.append("g").attr("class", "m-detail");
  const gNotes = svg.append("g");
  const gLabels = svg.append("g").attr("class", "m-labels");

  let model = buildModel();
  let L = layout(model);
  let w = 800, hgt = 600;
  let focus = L.root;
  let current = null; // state from the last render, for hover
  let hovered = null;
  const nets = new Map(); // folder id -> corridor network (layout space)
  const routes = new Map(); // merged-line key -> layout-space points
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  function netFor(folder) {
    if (!nets.has(folder.data.id)) nets.set(folder.data.id, corridors(folder));
    return nets.get(folder.data.id);
  }

  function render() {
    const t = M.transform || d3.zoomIdentity;
    const o = M.opts;
    const sx = (n) => t.applyX(n.x), sy = (n) => t.applyY(n.y), sr = (n) => n.r * t.k;
    // Notes are drawn as dots of bounded size, like places on a map.
    const dot = (n) => Math.max(2.5, Math.min(n.data.landmark ? 13 : 10, n.r * DOT * t.k));
    const radius = (n) => (n.data.kind === "concept" ? dot(n) : sr(n));
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

    // Places (notes).
    const notes = visible.filter((n) => n.data.kind === "concept");
    gNotes.selectAll("circle").data(notes, (n) => n.data.id).join(
      (enter) => fadeIn(enter.append("circle").attr("tabindex", 0).attr("role", "link")),
    )
      .attr("class", (n) => `m-note${n.data.landmark ? " landmark" : ""} ${trustState(n.data.c)}`)
      .attr("aria-label", (n) => n.data.label)
      .attr("cx", sx).attr("cy", sy).attr("r", dot)
      .style("--c", (n) => (n.group >= 0 ? PALETTE[n.group % PALETTE.length] : "var(--ink-soft)"))
      .on("click", (event, n) => { event.stopPropagation(); persist(); location.hash = conceptHref(n.data.ref); })
      .on("keydown", (event, n) => { if (event.key === "Enter") { persist(); location.hash = conceptHref(n.data.ref); } })
      .on("pointerenter", (event, n) => { showTip(event, n); hover(n); })
      .on("pointerleave", () => { tip.hidden = true; hover(null); });

    // Links at their scale: each end attaches to the child of the lowest folder
    // containing both ends (or to a closed folder hiding it); equal pairs merge.
    const visibleRep = (leaf) => {
      for (const a of leaf.ancestors().reverse()) if (!(a.data.kind === "dir" && open.has(a))) return a;
      return leaf;
    };
    const scaleRep = (leaf, lca) => {
      for (const a of leaf.ancestors().reverse()) {
        if (a.depth === lca.depth + 1 || !(a.data.kind === "dir" && open.has(a))) return a;
      }
      return leaf;
    };
    const merged = new Map();
    if (o.links !== "none") {
      for (const [a, b] of model.edges) {
        const na = L.byId.get("c:" + a), nb = L.byId.get("c:" + b);
        if (!na || !nb) continue;
        const within = na.parent === nb.parent;
        if ((o.links === "within" && !within) || (o.links === "across" && within)) continue;
        const lca = within ? na.parent : lowestCommon(na, nb);
        const ra = scaleRep(na, lca), rb = scaleRep(nb, lca);
        if (ra === rb) continue;
        const [p, q] = ra.data.id < rb.data.id ? [ra, rb] : [rb, ra];
        const key = p.data.id + "|" + q.data.id;
        const m = merged.get(key) || { key, p, q, lca, count: 0, across: 0, ends: new Set() };
        m.count += 1;
        if (!within) m.across += 1;
        m.ends.add(na.data.id); m.ends.add(nb.data.id);
        merged.set(key, m);
      }
    }
    // Route heavier bundles first so lighter ones follow their corridors.
    const lines = [...merged.values()].filter((m) => onScreen(m.lca) && (onScreen(m.p) || onScreen(m.q)))
      .sort((a, b) => b.count - a.count);
    const discounts = new Map();
    for (const m of lines) {
      if (routes.has(m.key)) continue;
      const net = netFor(m.lca);
      if (!discounts.has(m.lca)) discounts.set(m.lca, new Map());
      routes.set(m.key, route(net, m.p, m.q, discounts.get(m.lca)));
    }
    const screenPath = (pts, a, b) => {
      let s = pts.map(([x, y]) => [t.applyX(x), t.applyY(y)]);
      // Waypoints just outside an end make the curve hook; drop them.
      const near = (pt, n, r) => Math.hypot(pt[0] - sx(n), pt[1] - sy(n)) < r + 14;
      s = [s[0], ...s.slice(1, -1).filter((pt) => !near(pt, a, radius(a)) && !near(pt, b, radius(b))), s[s.length - 1]];
      // Trim the ends to the edges of what they connect.
      const trim = (from, toward, r) => {
        const dx = toward[0] - from[0], dy = toward[1] - from[1], d = Math.hypot(dx, dy) || 1;
        return [from[0] + (dx / d) * (r + 2), from[1] + (dy / d) * (r + 2)];
      };
      if (s.length === 2) {
        // Nothing in the way: a gentle bow, always to the same side, so
        // parallel links stay apart and the map does not read as a wiring diagram.
        // The bow is sized from the visible part of the link, not the centres.
        const f = trim(s[0], s[1], radius(a)), g = trim(s[1], s[0], radius(b));
        const dx = g[0] - f[0], dy = g[1] - f[1], d = Math.hypot(dx, dy) || 1;
        if (Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) < radius(a) + radius(b) + 4) return "";
        const bow = Math.min(d * 0.12, 36);
        const c = [(f[0] + g[0]) / 2 - (dy / d) * bow, (f[1] + g[1]) / 2 + (dx / d) * bow];
        return `M${f[0]},${f[1]} Q${c[0]},${c[1]} ${g[0]},${g[1]}`;
      }
      s[0] = trim(s[0], s[1], radius(a));
      s[s.length - 1] = trim(s[s.length - 1], s[s.length - 2], radius(b));
      return curve(s);
    };
    gLinks.selectAll("path").data(lines, (m) => m.key).join((enter) => fadeIn(enter.append("path")))
      .attr("class", (m) => `m-link${m.across === m.count ? " across" : m.across ? " mixed" : ""}`)
      .attr("stroke-width", (m) => 1 + 1.4 * Math.log2(m.count))
      .attr("d", (m) => screenPath(routes.get(m.key), m.p, m.q))
      .selectAll("title").data((m) => [m]).join("title")
      .text((m) => `${m.count} link${m.count > 1 ? "s" : ""} between ${m.p.data.label} and ${m.q.data.label}` +
        (m.across ? ` (${m.across} across folders)` : ""));

    current = { visibleRep, sx, sy, dot, radius, notes, lines };
    drawLabels(open, visible, notes, sx, sy, sr, dot);
    if (hovered) hover(hovered);
  }

  function drawLabels(open, visible, notes, sx, sy, sr, dot) {
    const budget = M.opts.labels;
    const placed = [];
    // Dots are obstacles too, so labels do not cover other places.
    const dots = notes.map((n) => [sx(n) - dot(n), sy(n) - dot(n), sx(n) + dot(n), sy(n) + dot(n)]);
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
    // Places: beside the dot, trying right, left, above and below.
    const ranked = [...notes].sort((a, b) => b.data.weight - a.data.weight || sr(b) - sr(a));
    for (const n of ranked) {
      if (arcs.length + texts.length >= budget) break;
      const r = dot(n), x = sx(n), y = sy(n);
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

  // Hover: fade what is unrelated, show the note's routes and its own links.
  function hover(n) {
    hovered = n;
    svg.classed("focusing", !!n);
    if (!n || !current) {
      gDetail.selectAll("path").remove();
      gNotes.selectAll("circle").classed("related", false);
      gLinks.selectAll("path").classed("hot", false);
      gLabels.selectAll("text").classed("related", false);
      return;
    }
    const { visibleRep, sx, sy, radius } = current;
    const related = new Set([n.data.id]);
    const ends = [];
    for (const [a, b] of model.edges) {
      const other = a === n.data.ref ? b : b === n.data.ref ? a : null;
      if (!other) continue;
      const on = L.byId.get("c:" + other);
      if (!on) continue;
      related.add(on.data.id);
      const r = visibleRep(on);
      related.add(r.data.id);
      if (r !== n) ends.push({ r, out: a === n.data.ref });
    }
    gNotes.selectAll("circle").classed("related", (m) => related.has(m.data.id));
    gLabels.selectAll("text.m-text").classed("related", function () { return related.has(this.getAttribute("data-id")); });
    gLinks.selectAll("path").classed("hot", (m) => m.ends.has(n.data.id));
    // Its own links, as gentle arcs from the note to wherever the other end is shown.
    gDetail.selectAll("path").data(ends).join("path")
      .attr("class", (e) => `m-link hot${e.out ? "" : " in"}`)
      .attr("d", (e) => {
        const x1 = sx(n), y1 = sy(n), x2 = sx(e.r), y2 = sy(e.r);
        const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
        const bow = Math.min(60, d * 0.18);
        const cx = (x1 + x2) / 2 - (dy / d) * bow, cy = (y1 + y2) / 2 + (dx / d) * bow;
        const r1 = radius(n) + 2, r2 = radius(e.r) + 2;
        const s = [x1 + ((cx - x1) / Math.hypot(cx - x1, cy - y1)) * r1, y1 + ((cy - y1) / Math.hypot(cx - x1, cy - y1)) * r1];
        const f = [x2 + ((cx - x2) / Math.hypot(cx - x2, cy - y2)) * r2, y2 + ((cy - y2) / Math.hypot(cx - x2, cy - y2)) * r2];
        return `M${s[0]},${s[1]} Q${cx},${cy} ${f[0]},${f[1]}`;
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
  wrap.refresh = () => { model = buildModel(); L = layout(model); nets.clear(); routes.clear(); schedule(); };
  M.reset = () => zoomTo(L.root);
  return wrap;
}

function controls(redraw) {
  const narrow = matchMedia("(max-width: 760px)").matches;
  const slider = (key, text, min, max, step, fmt) => {
    const input = h("input", { type: "range", min, max, step, value: M.opts[key], "aria-label": text });
    const out = h("output", {}, fmt(M.opts[key]));
    input.addEventListener("input", () => {
      M.opts[key] = Number(input.value);
      out.textContent = fmt(M.opts[key]);
      persist();
      redraw();
    });
    return h("label", { class: "slider" }, h("span", {}, text), input, out);
  };
  const modes = LINK_MODES.map(([key, text]) => {
    const b = h("button", { class: "toggle", type: "button", "aria-pressed": String(M.opts.links === key) }, text);
    b.addEventListener("click", () => {
      M.opts.links = key;
      for (const other of modes) other.setAttribute("aria-pressed", String(other === b));
      persist();
      redraw();
    });
    return b;
  });
  const reset = h("button", { class: "toggle", type: "button" }, "Show everything");
  reset.addEventListener("click", () => M.reset?.());
  const defaults = h("button", { class: "toggle", type: "button" }, "Default settings");
  defaults.addEventListener("click", () => { Object.assign(M.opts, MAP_DEFAULTS); persist(); location.reload(); });
  return h("div", { class: "graph-panel" },
    h("details", { class: "graph-options", open: !narrow },
      h("summary", {}, "Options"),
      h("div", { class: "legend" }, h("span", {}, "Links"), modes),
      h("div", { class: "sliders" },
        slider("labels", "Labels", 5, 120, 1, (v) => String(v)),
        slider("detail", "Open folders at", 60, 400, 10, (v) => `${v}px`)),
      h("div", { class: "legend" },
        h("span", {}, h("i", { class: "key-landmark" }), "Landmark"),
        h("span", {}, h("i", { class: "key-across" }), "Across folders"),
        h("span", {}, "Thicker: more links")),
      h("div", { class: "row" }, reset, defaults)));
}
