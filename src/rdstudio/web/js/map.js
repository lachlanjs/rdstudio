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
      weight: 1 + 5 * (rank.get(c.id) / top) + (landmark ? 3 : 0),
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
  d3.pack().size([SIZE, SIZE]).padding((d) => (d.depth === 0 ? 18 : 10))(root);
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

// --------------------------------------------------------------- view

export function mapView(focusRef = "") {
  document.title = `Map · ${store.site.title}`;
  const wrap = h("div", { class: "graph-wrap map-wrap" });
  const svg = d3.select(wrap).append("svg").attr("role", "img").attr("aria-label", "Knowledge map");
  const tip = h("div", { class: "graph-tip", hidden: true });
  const crumbs = h("nav", { class: "map-crumbs", "aria-label": "Current folder" });
  const panel = controls(() => schedule());
  wrap.append(panel, crumbs, tip, h("div", { class: "graph-hint" }, "Click a note to open it, a region to zoom in, empty space to step out."));

  const defs = svg.append("defs");
  const back = svg.append("rect").attr("class", "m-back");
  const gRegions = svg.append("g");
  const gLinks = svg.append("g");
  const gNotes = svg.append("g");
  const gLabels = svg.append("g").attr("class", "m-labels");

  let model = buildModel();
  let L = layout(model);
  let w = 800, hgt = 600;
  let focus = L.root;
  let current = null; // helpers from the last render, for hover detail
  const gDetail = svg.insert("g", ".m-labels").attr("class", "m-detail");

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
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = fitTransform(n);
    if (reduce) svg.call(zoom.transform, t);
    else svg.transition().duration(550).call(zoom.transform, t);
  }

  back.on("click", () => { if (focus.parent) zoomTo(focus.parent); });

  function render() {
    const t = M.transform || d3.zoomIdentity;
    const o = M.opts;
    const sx = (n) => t.applyX(n.x), sy = (n) => t.applyY(n.y), sr = (n) => n.r * t.k;
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

    // Regions (folders), outermost first so inner ones sit on top.
    const regions = visible.filter((n) => n.data.kind === "dir").sort((a, b) => a.depth - b.depth);
    gRegions.selectAll("circle").data(regions, (n) => n.data.id).join("circle")
      .attr("class", (n) => `m-dir ${open.has(n) ? "open" : "closed"}`)
      .attr("cx", sx).attr("cy", sy).attr("r", sr)
      .style("--c", (n) => (n.group >= 0 ? PALETTE[n.group % PALETTE.length] : "var(--ink-faint)"))
      .on("click", (event, n) => { event.stopPropagation(); zoomTo(n === focus && n.parent ? n.parent : n); })
      .on("pointerenter", (event, n) => showTip(event, n))
      .on("pointerleave", () => { tip.hidden = true; });

    // Notes.
    const notes = visible.filter((n) => n.data.kind === "concept");
    gNotes.selectAll("circle").data(notes, (n) => n.data.id).join(
      (enter) => enter.append("circle").attr("tabindex", 0).attr("role", "link"),
    )
      .attr("class", (n) => `m-note${n.data.landmark ? " landmark" : ""} ${trustState(n.data.c)}`)
      .attr("aria-label", (n) => n.data.label)
      .attr("cx", sx).attr("cy", sy).attr("r", (n) => Math.max(2, sr(n)))
      .style("--c", (n) => (n.group >= 0 ? PALETTE[n.group % PALETTE.length] : "var(--ink-soft)"))
      .on("click", (event, n) => { event.stopPropagation(); persist(); location.hash = conceptHref(n.data.ref); })
      .on("keydown", (event, n) => { if (event.key === "Enter") { persist(); location.hash = conceptHref(n.data.ref); } })
      .on("pointerenter", (event, n) => { showTip(event, n); highlight(n); })
      .on("pointerleave", () => { tip.hidden = true; highlight(null); });

    // Links at their scale. A link belongs to the lowest folder containing both
    // ends, so each end is drawn at the level just inside that folder (or at a
    // closed folder, if one hides it). Equal pairs are merged into one line.
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
        const lca = na.parent === nb.parent ? na.parent : lowestCommon(na, nb);
        const ra = scaleRep(na, lca), rb = scaleRep(nb, lca);
        if (ra === rb) continue;
        const [p, q] = ra.data.id < rb.data.id ? [ra, rb] : [rb, ra];
        const key = p.data.id + "|" + q.data.id;
        const m = merged.get(key) || { key, p, q, count: 0, across: 0, ends: new Set() };
        m.count += 1;
        if (!within) m.across += 1;
        m.ends.add(na.data.id); m.ends.add(nb.data.id);
        merged.set(key, m);
      }
    }
    current = { visibleRep, sx, sy, sr, onScreen };
    const lines = [...merged.values()].filter((m) => onScreen(m.p) || onScreen(m.q));
    gLinks.selectAll("line").data(lines, (m) => m.key).join("line")
      .attr("class", (m) => `m-link${m.across === m.count ? " across" : m.across ? " mixed" : ""}`)
      .attr("stroke-width", (m) => 1 + 1.6 * Math.log2(m.count))
      .each(function (m) {
        const x1 = sx(m.p), y1 = sy(m.p), x2 = sx(m.q), y2 = sy(m.q);
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const r1 = sr(m.p) + 2, r2 = sr(m.q) + 2;
        const el = d3.select(this);
        if (len <= r1 + r2) { el.attr("display", "none"); return; }
        el.attr("display", null)
          .attr("x1", x1 + ((x2 - x1) / len) * r1).attr("y1", y1 + ((y2 - y1) / len) * r1)
          .attr("x2", x2 - ((x2 - x1) / len) * r2).attr("y2", y2 - ((y2 - y1) / len) * r2);
      })
      .select(function () { return this; })
      .selectAll("title").data((m) => [m]).join("title")
      .text((m) => `${m.count} link${m.count > 1 ? "s" : ""} between ${m.p.data.label} and ${m.q.data.label}` +
        (m.across ? ` (${m.across} across folders)` : ""));

    drawLabels(open, visible, notes, sx, sy, sr);
  }

  function drawLabels(open, visible, notes, sx, sy, sr) {
    const budget = M.opts.labels;
    const placed = [];
    const fits = (box) => box[0] > -40 && box[2] < w + 40 && box[1] > -20 && box[3] < hgt + 20 &&
      !placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
    const arcs = [], texts = [];

    // Open folders get a label along the top of their region, outermost first.
    for (const n of [...open].filter((n) => n.parent).sort((a, b) => a.depth - b.depth)) {
      if (arcs.length + texts.length >= budget) break;
      const R = sr(n) - 7;
      const width = n.data.label.length * 7.4;
      if (R < 30 || width > R * 2.0) continue;
      const box = [sx(n) - width / 2, sy(n) - R - 6, sx(n) + width / 2, sy(n) - R + 16];
      if (!fits(box)) continue;
      placed.push(box);
      arcs.push({ n, R });
    }
    // Closed folders, largest first; then notes, most important first.
    const closed = visible.filter((n) => n.data.kind === "dir" && !open.has(n));
    const candidates = [
      ...closed.map((n) => ({ n, score: 1e6 + sr(n), text: `${n.data.label}\u00a0·\u00a0${n.leaves().filter((l) => l.data.kind === "concept").length}`, cls: "dir" })),
      ...notes.map((n) => ({ n, score: n.data.weight * 10 + sr(n), text: n.data.label, cls: n.data.landmark ? "landmark" : "" })),
    ].sort((a, b) => b.score - a.score);
    for (const cand of candidates) {
      if (arcs.length + texts.length >= budget) break;
      const n = cand.n;
      if (sr(n) < 3) continue;
      const charW = cand.cls === "dir" ? 7.2 : 6.5;
      // Inside a large enough circle, wrap to its width; otherwise one line,
      // centred on the circle or just below a small one.
      const inside = sr(n) >= 16;
      const lines = inside ? wrapWords(cand.text, Math.max(sr(n) * 1.7, 60), charW) : [cand.text];
      // Too long for its circle at this zoom: zoom in to read it.
      if (inside && n.data.kind === "concept" && (lines.length > 4 || lines.length * 14 > sr(n) * 1.9)) continue;
      const width = Math.max(...lines.map((l) => l.length)) * charW;
      const lineH = 14;
      const cx = sx(n);
      const cy = inside || n.data.kind === "dir" ? sy(n) : sy(n) + sr(n) + 9;
      const top = cy - (lines.length * lineH) / 2;
      const box = [cx - width / 2, top, cx + width / 2, top + lines.length * lineH];
      if (!fits(box)) continue;
      placed.push(box);
      texts.push({ ...cand, x: cx, y: top + lineH - 3, lines });
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
      .attr("y", (d) => d.y)
      .attr("text-anchor", "middle")
      .selectAll("tspan").data((d) => d.lines.map((line, i) => ({ line, i, x: d.x }))).join("tspan")
      .attr("x", (t) => t.x).attr("dy", (t) => (t.i ? 14 : 0))
      .text((t) => t.line);
  }

  // Hovering a note shows its own links, whatever scale they belong to.
  function highlight(n) {
    gLinks.classed("muted", !!n);
    if (!n || !current) { gDetail.selectAll("line").remove(); return; }
    const { visibleRep, sx, sy, sr } = current;
    const ends = [];
    for (const [a, b] of model.edges) {
      const other = a === n.data.ref ? b : b === n.data.ref ? a : null;
      if (!other) continue;
      const on = L.byId.get("c:" + other);
      if (!on) continue;
      const r = visibleRep(on);
      if (r !== n) ends.push({ r, out: a === n.data.ref });
    }
    gDetail.selectAll("line").data(ends).join("line")
      .attr("class", (e) => `m-link hot${e.out ? "" : " in"}`)
      .each(function (e) {
        const x1 = sx(n), y1 = sy(n), x2 = sx(e.r), y2 = sy(e.r);
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const r1 = sr(n) + 2, r2 = sr(e.r) + 2;
        d3.select(this)
          .attr("x1", x1 + ((x2 - x1) / len) * r1).attr("y1", y1 + ((y2 - y1) / len) * r1)
          .attr("x2", x2 - ((x2 - x1) / len) * r2).attr("y2", y2 - ((y2 - y1) / len) * r2);
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
  wrap.refresh = () => { model = buildModel(); L = layout(model); schedule(); };
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
        h("span", {}, "Thicker line: more links")),
      h("div", { class: "row" }, reset, defaults)));
}
