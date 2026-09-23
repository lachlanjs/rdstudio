// Graph tab: force-directed view of concepts, directories and reports.
// Positions survive navigation (module state) and reloads (sessionStorage).

import { store } from "./data.js";
import { h, conceptHref, dirHref, trustState, TRUST_LABEL, titleCase } from "./util.js";

/* global d3 */

const KEY = "rdstudio.graph";
const saved = (() => {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch { return {}; }
})();

const G = {
  positions: new Map(Object.entries(saved.positions || {})), // id -> [x, y, pinned]
  transform: saved.transform ? d3.zoomIdentity.translate(saved.transform.x, saved.transform.y).scale(saved.transform.k) : null,
  opts: Object.assign({ hierarchy: true, reports: true, labels: true, color: "directory" }, saved.opts || {}),
  sim: null,
  nodes: [],
  query: "",
};

function persist() {
  for (const n of G.nodes) G.positions.set(n.id, [Math.round(n.x), Math.round(n.y), n.fx != null ? 1 : 0]);
  const t = G.transform;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      positions: Object.fromEntries(G.positions),
      transform: t ? { x: t.x, y: t.y, k: t.k } : null,
      opts: G.opts,
    }));
  } catch { /* storage unavailable */ }
}

export function leaveGraph() {
  if (!G.sim) return;
  persist();
  G.sim.stop();
  G.sim = null;
}

const TRUST_COLOR = {
  "human-reviewed": "var(--reviewed)",
  "machine-confirmed": "var(--machine)",
  unverified: "var(--unverified)",
  stale: "var(--stale)",
};
const PALETTE = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `var(--g${i})`);

function topDir(id) {
  return id.includes("/") ? id.split("/")[0] : "";
}

function buildGraph() {
  const nodes = [];
  const links = [];
  const byId = new Map();
  const add = (n) => { byId.set(n.id, n); nodes.push(n); };
  const degree = new Map();
  const bump = (id) => degree.set(id, (degree.get(id) || 0) + 1);

  for (const d of Object.values(store.tree)) {
    add({ id: "d:" + d.id, kind: "dir", ref: d.id, label: d.id ? titleCase(d.name) : store.site.title || "Knowledge", group: d.id.split("/")[0] });
  }
  for (const c of store.concepts.values()) {
    add({ id: "c:" + c.id, kind: "concept", ref: c.id, label: c.title, type: c.type, trust: trustState(c), group: topDir(c.id), c });
  }
  if (G.opts.reports) {
    for (const r of store.reports) add({ id: "r:" + r.path, kind: "report", ref: r.path, label: r.title, r });
  }
  if (G.opts.hierarchy) {
    for (const d of Object.values(store.tree)) {
      for (const child of d.children) links.push({ source: "d:" + d.id, target: "d:" + child, kind: "tree" });
      for (const cid of d.concepts) links.push({ source: "d:" + d.id, target: "c:" + cid, kind: "tree" });
    }
  }
  for (const c of store.concepts.values()) {
    const seen = new Set();
    for (const l of c.links) {
      if (l.broken) continue;
      const target = l.kind === "concept" ? "c:" + l.target : "d:" + l.target.replace(/\/$/, "");
      if (!byId.has(target) || target === "c:" + c.id || seen.has(target)) continue;
      seen.add(target);
      links.push({ source: "c:" + c.id, target, kind: "link" });
      bump("c:" + c.id); bump(target);
    }
  }
  if (G.opts.reports) {
    for (const r of store.reports) {
      for (const cid of r.links) {
        if (!byId.has("c:" + cid)) continue;
        links.push({ source: "r:" + r.path, target: "c:" + cid, kind: "link" });
        bump("r:" + r.path); bump("c:" + cid);
      }
    }
  }
  for (const n of nodes) {
    n.degree = degree.get(n.id) || 0;
    n.r = n.kind === "dir" ? (n.ref ? 8 : 11) : n.kind === "report" ? 7 : 5 + Math.min(7, Math.sqrt(n.degree) * 1.7);
  }
  return { nodes, links, byId };
}

function colorFor(n, groups) {
  if (n.kind !== "concept") return null;
  if (G.opts.color === "trust") return TRUST_COLOR[n.trust];
  return PALETTE[groups.indexOf(n.group) % PALETTE.length];
}

function navigate(n) {
  if (n.kind === "concept") location.hash = conceptHref(n.ref);
  else if (n.kind === "dir") location.hash = dirHref(n.ref);
  else location.hash = "#/r/" + n.ref.split("/").map(encodeURIComponent).join("/");
}

export function graphView() {
  document.title = `Graph · ${store.site.title}`;
  const wrap = h("div", { class: "graph-wrap" });
  const svg = d3.select(wrap).append("svg").attr("role", "img").attr("aria-label", "Knowledge graph");
  const tip = h("div", { class: "graph-tip", hidden: true });
  const panel = controls(() => { leaveGraph(); draw(); });
  wrap.append(panel, tip, h("div", { class: "graph-hint" }, "Drag to pin a node. Double-click to release it. Click to open."));

  svg.append("defs").append("marker")
    .attr("id", "arrow").attr("viewBox", "0 -4 8 8").attr("refX", 7).attr("refY", 0)
    .attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto")
    .append("path").attr("d", "M0,-3.5L8,0L0,3.5").attr("fill", "var(--ink-soft)");
  const root = svg.append("g");

  const zoom = d3.zoom().scaleExtent([0.15, 4]).on("zoom", (event) => {
    G.transform = event.transform;
    root.attr("transform", event.transform);
    root.classed("far", event.transform.k < 0.55);
  });
  svg.call(zoom).on("dblclick.zoom", null);

  function draw() {
    root.selectAll("*").remove();
    const { nodes, links } = buildGraph();
    const groups = [...new Set(nodes.filter((n) => n.kind === "concept").map((n) => n.group))].sort();
    const rect = wrap.getBoundingClientRect();
    const w = rect.width || 800, hgt = rect.height || 600;

    let fresh = 0;
    for (const n of nodes) {
      const p = G.positions.get(n.id);
      if (p) {
        n.x = p[0]; n.y = p[1];
        if (p[2]) { n.fx = p[0]; n.fy = p[1]; }
      } else {
        fresh += 1;
        const parent = G.positions.get("d:" + (n.kind === "concept" ? n.c.directory : ""));
        const [px, py] = parent || [0, 0];
        n.x = px + (Math.random() - 0.5) * 80;
        n.y = py + (Math.random() - 0.5) * 80;
      }
    }
    G.nodes = nodes;

    const link = root.append("g").selectAll("line").data(links).join("line")
      .attr("class", (d) => (d.kind === "tree" ? "g-tree" : "g-link"))
      .attr("marker-end", (d) => (d.kind === "link" ? "url(#arrow)" : null));

    const node = root.append("g").selectAll("g").data(nodes, (d) => d.id).join("g")
      .attr("class", (d) => `g-node ${d.kind}${d.fx != null ? " pinned" : ""}`)
      .attr("tabindex", 0)
      .attr("role", "link")
      .attr("aria-label", (d) => d.label);
    node.each(function (d) {
      const g = d3.select(this);
      g.append("circle").attr("class", "hit").attr("r", d.r + 9);
      if (d.kind === "report") {
        g.append("rect").attr("class", "shape").attr("x", -d.r).attr("y", -d.r).attr("width", 2 * d.r).attr("height", 2 * d.r).attr("rx", 3.5);
      } else {
        g.append("circle").attr("class", "shape").attr("r", d.r).attr("fill", colorFor(d, groups));
      }
      if (d.kind === "concept" && d.trust === "unverified" && G.opts.color === "trust") {
        g.select(".shape").attr("fill", "var(--paper)").attr("stroke", "var(--unverified)").attr("stroke-width", 2);
      }
    });
    const label = root.append("g").attr("class", "g-labels").selectAll("text").data(nodes, (d) => d.id).join("text")
      .attr("class", (d) => `g-label ${d.kind}`)
      .attr("dx", (d) => d.r + 4).attr("dy", 4)
      .text((d) => d.label)
      .on("click", (event, d) => { persist(); navigate(d); });

    node.on("click", (event, d) => { if (!event.defaultPrevented) { persist(); navigate(d); } })
      .on("keydown", (event, d) => { if (event.key === "Enter") { persist(); navigate(d); } })
      .on("dblclick", (event, d) => {
        event.stopPropagation();
        d.fx = d.fy = null;
        d3.select(event.currentTarget).classed("pinned", false);
        G.sim.alpha(0.3).restart();
      })
      .on("pointerenter", (event, d) => showTip(event, d))
      .on("pointerleave", () => { tip.hidden = true; });

    node.call(d3.drag()
      .clickDistance(4)
      .on("start", (event, d) => { d.moved = false; })
      .on("drag", (event, d) => {
        if (!d.moved) { d.moved = true; if (!event.active) G.sim.alphaTarget(0.25).restart(); }
        d.fx = event.x; d.fy = event.y; tip.hidden = true;
      })
      .on("end", function (event, d) {
        if (!d.moved) return;
        if (!event.active) G.sim.alphaTarget(0);
        d3.select(this).classed("pinned", true);
        persist();
      }));

    function showTip(event, d) {
      const lines = [h("strong", {}, d.label)];
      if (d.kind === "concept") lines.push(h("span", {}, `${d.type || "Concept"} · ${TRUST_LABEL[d.trust]}`), d.c.description ? h("div", {}, d.c.description) : "");
      else if (d.kind === "report") lines.push(h("span", {}, `Report · ${d.r.date}`));
      else lines.push(h("span", {}, "Directory"));
      tip.replaceChildren(...lines);
      const box = wrap.getBoundingClientRect();
      tip.style.left = `${Math.min(event.clientX - box.left + 14, box.width - 290)}px`;
      tip.style.top = `${event.clientY - box.top + 14}px`;
      tip.hidden = false;
    }

    // Search highlight.
    const q = G.query.toLowerCase();
    if (q) {
      const hit = new Set(nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id));
      node.classed("dim", (d) => !hit.has(d.id));
      label.classed("dim", (d) => !hit.has(d.id));
      link.classed("g-edge-dim", (d) => !(hit.has(d.source) || hit.has(d.target)));
    }
    label.attr("display", (d) => (G.opts.labels || d.kind === "dir" ? null : "none"));

    G.sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id)
        .distance((d) => (d.kind === "tree" ? 46 : 90))
        .strength((d) => (d.kind === "tree" ? 0.6 : 0.12)))
      .force("charge", d3.forceManyBody().strength((d) => (d.kind === "dir" ? -380 : -170)).distanceMax(600))
      .force("collide", d3.forceCollide((d) => d.r + 6))
      .force("x", d3.forceX(0).strength(0.035))
      .force("y", d3.forceY(0).strength(0.035))
      .alpha(fresh > nodes.length / 3 ? 1 : fresh ? 0.3 : 0)
      .on("tick", () => {
        link.each(function (d) {
          const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
          const len = Math.hypot(dx, dy) || 1;
          const pad = d.kind === "link" ? d.target.r + 3 : 0;
          d3.select(this)
            .attr("x1", d.source.x).attr("y1", d.source.y)
            .attr("x2", d.target.x - (dx / len) * pad).attr("y2", d.target.y - (dy / len) * pad);
        });
        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
        label.attr("x", (d) => d.x).attr("y", (d) => d.y);
        if (G.fitPending && G.sim && G.sim.alpha() < 0.2) { G.fitPending = false; fit(); }
      })
      .on("end", () => {
        if (G.fitPending) { G.fitPending = false; fit(); }
        persist();
      });

    function fit() {
      const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const k = Math.min(1.6, 0.8 * Math.min(w / (x1 - x0 + 160), hgt / (y1 - y0 + 80)));
      const t = d3.zoomIdentity.translate(w / 2 - k * (x0 + x1) / 2, hgt / 2 - k * (y0 + y1) / 2).scale(k);
      svg.transition().duration(450).call(zoom.transform, t);
    }

    if (!G.transform) {
      G.transform = d3.zoomIdentity.translate(w / 2, hgt / 2).scale(0.9);
      G.fitPending = nodes.length > 0;
    }
    svg.call(zoom.transform, G.transform);
  }

  requestAnimationFrame(draw);
  wrap.refresh = () => { persist(); if (G.sim) G.sim.stop(); draw(); };
  return wrap;
}

function controls(redraw) {
  const toggle = (key, label) => {
    const b = h("button", { class: "toggle", type: "button", "aria-pressed": String(!!G.opts[key]) }, label);
    b.addEventListener("click", () => { G.opts[key] = !G.opts[key]; b.setAttribute("aria-pressed", String(G.opts[key])); redraw(); });
    return b;
  };
  const colour = h("button", { class: "toggle", type: "button", "aria-pressed": "true" });
  const setColourLabel = () => { colour.textContent = G.opts.color === "trust" ? "Colour: trust" : "Colour: directory"; };
  setColourLabel();
  colour.addEventListener("click", () => { G.opts.color = G.opts.color === "trust" ? "directory" : "trust"; setColourLabel(); redraw(); legend.replaceChildren(...legendItems()); });
  const search = h("input", { type: "search", placeholder: "Highlight nodes", value: G.query, "aria-label": "Highlight nodes" });
  search.addEventListener("input", () => { G.query = search.value.trim(); redraw(); });
  const legend = h("div", { class: "legend" }, legendItems());
  const narrow = matchMedia("(max-width: 760px)").matches;
  return h("div", { class: "graph-panel" },
    h("div", { class: "row" }, search),
    h("details", { class: "graph-options", open: !narrow },
      h("summary", {}, "Options"),
      h("div", { class: "row" }, toggle("hierarchy", "Folders"), toggle("reports", "Reports"), toggle("labels", "Labels"), colour),
      legend));
}

function legendItems() {
  const items = [];
  if (G.opts.color === "trust") {
    for (const [k, v] of Object.entries(TRUST_COLOR)) items.push(h("span", {}, h("i", { style: `background:${v}` }), TRUST_LABEL[k]));
  }
  items.push(h("span", {}, h("i", { style: "border:1.6px solid var(--ink);background:var(--paper-raised)" }), "Folder"));
  items.push(h("span", {}, h("i", { style: "background:var(--cat-reports);border-radius:2px" }), "Report"));
  items.push(h("span", {}, "→ link, ┄ contains"));
  return items;
}
