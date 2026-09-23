// Procedures tab: procedural graphs drawn as layered flows, with inspectable steps and transitions.

import { store, body } from "./data.js";
import { render } from "./markdown.js";
import { h, conceptHref, timeEl, fmtDateTime } from "./util.js";

export const RELATIONS = {
  LEADS_TO: { label: "leads to", color: "var(--ink-soft)" },
  TRIGGERS: { label: "triggers", color: "var(--accent)" },
  PROVIDES_INPUT_FOR: { label: "provides input for", color: "var(--cat-code)" },
  CONVERGES_TO: { label: "converges to", color: "var(--reviewed)" },
};

export function procedures() {
  return [...store.concepts.values()].filter((c) => (c.type || "").toLowerCase() === "procedure");
}

export function pendingProposals() {
  return procedures().flatMap((c) => (c.meta.proposals || []).filter((p) => p.state === "pending").map((p) => ({ c, p })));
}

function graphOf(c) {
  const nodes = new Map();
  for (const raw of c.meta.nodes || []) {
    const n = typeof raw === "string" ? { id: raw } : raw;
    if (n && n.id != null) nodes.set(String(n.id), { ...n, id: String(n.id), label: String(n.label || n.id) });
  }
  const edges = (c.meta.edges || []).filter((e) => e && nodes.has(String(e.from)) && nodes.has(String(e.to)))
    .map((e) => ({ ...e, from: String(e.from), to: String(e.to), relation: e.relation || "LEADS_TO" }));
  const start = c.meta.start != null && nodes.has(String(c.meta.start)) ? String(c.meta.start) : nodes.keys().next().value;
  return { nodes, edges, start };
}

// Longest-path layering: depth is the longest route from the start, ignoring
// edges that loop back; nodes unreachable from the start follow at the end.
export function layers(g) {
  const back = new Set();
  const state = new Map(); // 1 = on stack, 2 = done
  const visit = (id) => {
    state.set(id, 1);
    for (const e of g.edges) {
      if (e.from !== id) continue;
      if (state.get(e.to) === 1) back.add(e);
      else if (!state.has(e.to)) visit(e.to);
    }
    state.set(id, 2);
  };
  if (g.start) visit(g.start);
  for (const id of g.nodes.keys()) if (!state.has(id)) visit(id);
  const forward = g.edges.filter((e) => !back.has(e));
  const indeg = new Map([...g.nodes.keys()].map((id) => [id, 0]));
  for (const e of forward) indeg.set(e.to, indeg.get(e.to) + 1);
  const depth = new Map();
  const queue = [...g.nodes.keys()].filter((id) => indeg.get(id) === 0).sort((a, b) => (a === g.start ? -1 : b === g.start ? 1 : 0));
  for (const id of queue) depth.set(id, 0);
  const order = [];
  while (queue.length) {
    const cur = queue.shift();
    order.push(cur);
    for (const e of forward) {
      if (e.from !== cur) continue;
      depth.set(e.to, Math.max(depth.get(e.to) ?? 0, depth.get(cur) + 1));
      indeg.set(e.to, indeg.get(e.to) - 1);
      if (indeg.get(e.to) === 0) queue.push(e.to);
    }
  }
  const cols = [];
  for (const id of order) (cols[depth.get(id)] ||= []).push(id);
  return cols.filter(Boolean);
}

function wrap(text, width = 20) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width && line) { lines.push(line); line = w; } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function flow(g, onSelect, vertical) {
  const NODE_W = 168, LINE = 17, PAD = 12, GAP_MAIN = vertical ? 64 : 92, GAP_CROSS = 22;
  const cols = layers(g);
  const box = new Map();
  for (const [id, n] of g.nodes) {
    const lines = wrap(n.label);
    box.set(id, { lines, w: NODE_W, h: lines.length * LINE + PAD * 2 });
  }
  // Position columns (main axis) and stack nodes (cross axis), centred.
  const colSize = cols.map((col) => col.reduce((s, id) => s + (vertical ? NODE_W : box.get(id).h) + GAP_CROSS, -GAP_CROSS));
  const cross = Math.max(...colSize, 0);
  let main = 0;
  cols.forEach((col, i) => {
    const thick = Math.max(...col.map((id) => (vertical ? box.get(id).h : NODE_W)));
    let pos = (cross - colSize[i]) / 2;
    for (const id of col) {
      const b = box.get(id);
      b.layer = i;
      if (vertical) { b.x = pos; b.y = main + (thick - b.h) / 2; pos += NODE_W + GAP_CROSS; }
      else { b.x = main; b.y = pos; pos += b.h + GAP_CROSS; }
    }
    main += thick + GAP_MAIN;
  });
  const W = vertical ? cross : main - GAP_MAIN, H = vertical ? main - GAP_MAIN : cross;
  const M = 64;
  const svg = h("svg:svg", { class: `flow${vertical ? " vertical" : ""}`, viewBox: `${-M} ${-M} ${W + 2 * M} ${H + 2 * M}`, width: W + 2 * M, role: "img", "aria-label": "Procedure graph" });
  const defs = h("svg:defs");
  for (const [rel, { color }] of Object.entries(RELATIONS)) {
    defs.append(h("svg:marker", { id: `pa-${rel}`, viewBox: "0 -4 8 8", refX: 8, refY: 0, markerWidth: 11, markerHeight: 11, markerUnits: "userSpaceOnUse", orient: "auto" },
      h("svg:path", { d: "M0,-3.5L8,0L0,3.5", fill: color })));
  }
  svg.append(defs);

  const anchor = (b, side) => {
    if (vertical) return side === "out" ? [b.x + b.w / 2, b.y + b.h] : [b.x + b.w / 2, b.y];
    return side === "out" ? [b.x + b.w, b.y + b.h / 2] : [b.x, b.y + b.h / 2];
  };
  const edgeLayer = h("svg:g");
  g.edges.forEach((e, i) => {
    const a = box.get(e.from), b = box.get(e.to);
    const forward = b.layer > a.layer;
    const span = b.layer - a.layer;
    let d;
    if (forward && span > 1) {
      // Skips layers: bow out to the side so it does not cross intermediate steps.
      const [x1, y1] = vertical ? [a.x, a.y + a.h / 2] : [a.x + a.w / 2, a.y + a.h];
      const [x2, y2] = vertical ? [b.x, b.y + b.h / 2] : [b.x + b.w / 2, b.y + b.h];
      const off = 46 + 10 * (i % 3);
      d = vertical ? `M${x1},${y1} C${x1 - off},${y1} ${x2 - off},${y2} ${x2},${y2}`
        : `M${x1},${y1} C${x1},${y1 + off} ${x2},${y2 + off} ${x2},${y2}`;
    } else if (forward) {
      const [x1, y1] = anchor(a, "out"), [x2, y2] = anchor(b, "in");
      d = vertical ? `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`
        : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
    } else {
      // Loop back around the outside of the flow.
      const [x1, y1] = vertical ? [a.x + a.w, a.y + a.h / 2] : [a.x + a.w / 2, a.y];
      const [x2, y2] = vertical ? [b.x + b.w, b.y + b.h / 2] : [b.x + b.w / 2, b.y];
      const off = 40 + 12 * (i % 3);
      d = vertical ? `M${x1},${y1} C${x1 + off},${y1} ${x2 + off},${y2} ${x2},${y2}`
        : `M${x1},${y1} C${x1},${y1 - off} ${x2},${y2 - off} ${x2},${y2}`;
    }
    const rel = RELATIONS[e.relation] || RELATIONS.LEADS_TO;
    const hasNotes = e.condition || e.guidance || e.pitfalls;
    const grp = h("svg:g", { class: "flow-edge", tabindex: 0, role: "button", "aria-label": `${g.nodes.get(e.from).label} ${rel.label} ${g.nodes.get(e.to).label}` },
      h("svg:path", { d, class: "flow-hit" }),
      h("svg:path", { d, class: "flow-line", stroke: rel.color, "stroke-dasharray": e.relation === "TRIGGERS" ? "5 4" : null, "marker-end": `url(#pa-${e.relation in RELATIONS ? e.relation : "LEADS_TO"})` }),
      hasNotes ? h("svg:circle", { class: "flow-note", r: 4.5, fill: e.pitfalls ? "var(--stale)" : rel.color }) : "");
    grp.addEventListener("click", () => onSelect({ edge: e }, grp));
    grp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") onSelect({ edge: e }, grp); });
    edgeLayer.append(grp);
  });
  svg.append(edgeLayer);
  // Place note dots at path midpoints once in the DOM.
  requestAnimationFrame(() => {
    for (const grp of edgeLayer.children) {
      const path = grp.querySelector(".flow-line"), dot = grp.querySelector(".flow-note");
      if (path && dot && path.getTotalLength) {
        const p = path.getPointAtLength(path.getTotalLength() / 2);
        dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y);
      }
    }
  });

  for (const [id, n] of g.nodes) {
    const b = box.get(id);
    const grp = h("svg:g", { class: `flow-node${id === g.start ? " start" : ""}`, tabindex: 0, role: "button", "aria-label": n.label },
      h("svg:rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8 }),
      h("svg:text", { x: b.x + PAD, y: b.y + PAD + 12 }, b.lines.map((l, i) => h("svg:tspan", { x: b.x + PAD, dy: i ? LINE : 0 }, l))));
    grp.addEventListener("click", () => onSelect({ node: id }, grp));
    grp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") onSelect({ node: id }, grp); });
    svg.append(grp);
  }
  return svg;
}

function inspector(g, sel) {
  if (!sel) return h("div", { class: "inspector empty" }, "Select a step or a transition to see its details.");
  if (sel.edge) {
    const e = sel.edge, rel = RELATIONS[e.relation] || RELATIONS.LEADS_TO;
    return h("div", { class: "inspector" },
      h("p", { class: "doc-kind" }, "Transition"),
      h("h3", {}, g.nodes.get(e.from).label, h("span", { class: "rel", style: `color:${rel.color}` }, ` ${rel.label} `), g.nodes.get(e.to).label),
      ["condition", "guidance", "pitfalls"].map((k) => e[k] ? h("div", { class: `attr ${k}` }, h("strong", {}, k === "condition" ? "When" : k === "guidance" ? "How" : "Avoid"), h("p", {}, String(e[k]))) : ""),
      !(e.condition || e.guidance || e.pitfalls) ? h("p", { class: "empty" }, "No notes on this transition.") : "");
  }
  const n = g.nodes.get(sel.node);
  const out = g.edges.filter((e) => e.from === sel.node);
  const into = g.edges.filter((e) => e.to === sel.node);
  return h("div", { class: "inspector" },
    h("p", { class: "doc-kind" }, sel.node === g.start ? "Step (start)" : "Step", h("code", {}, sel.node)),
    h("h3", {}, n.label),
    n.description ? h("p", {}, String(n.description)) : "",
    into.length ? h("p", { class: "section-note" }, "After: " + into.map((e) => g.nodes.get(e.from).label).join(", ")) : "",
    out.length ? h("ul", { class: "rows" }, out.map((e) => h("li", {},
      h("div", {}, h("span", { style: `color:${(RELATIONS[e.relation] || RELATIONS.LEADS_TO).color}` }, (RELATIONS[e.relation] || RELATIONS.LEADS_TO).label), " ", h("strong", {}, g.nodes.get(e.to).label)),
      e.condition ? h("div", { class: "desc" }, "When: " + e.condition) : "",
      e.pitfalls ? h("div", { class: "desc" }, "Avoid: " + e.pitfalls) : ""))) : h("p", { class: "empty" }, "End of the procedure."));
}

function legend() {
  return h("div", { class: "legend" }, Object.entries(RELATIONS).map(([k, v]) =>
    h("span", {}, h("i", { style: `background:${v.color};height:3px;border-radius:0;width:16px` }), v.label)),
    h("span", {}, h("i", { style: "background:var(--stale)" }), "has pitfalls"));
}

function proposalsView(c) {
  const list = c.meta.proposals || [];
  if (!list.length) return "";
  return [h("h2", { class: "section-h" }, "Proposed changes", h("span", { class: "count" }, list.filter((p) => p.state === "pending").length)),
    h("p", { class: "section-note" }, "Agents propose edits; you apply or reject them with ", h("code", {}, `rdstudio procedure apply|reject ${c.id} <n>`), ". Rejected proposals stay as a record so they are not proposed again."),
    h("ul", { class: "rows" }, [...list].reverse().map((p) => h("li", {},
      h("div", {}, h("strong", {}, `#${p.id} `), h("span", { class: `chip state-${p.state}` }, p.state), " ", p.rationale || ""),
      h("div", { class: "sub" }, h("span", {}, p.by || ""), p.at ? h("span", {}, fmtDateTime(p.at)) : ""),
      h("ul", { class: "files" }, (p.edits || []).map((e) => h("li", {}, Object.entries(e).map(([k, v]) => `${k}: ${v}`).join(", ")))))))];
}

export function proceduresView() {
  document.title = `Procedures · ${store.site.title}`;
  const list = procedures();
  return h("div", { class: "page" },
    h("h1", {}, "Procedures"),
    h("p", { class: "lede" }, "Repeated processes recorded as graphs of steps. Agents follow them one step at a time and propose improvements."),
    list.length ? h("ul", { class: "rows" }, list.map((c) => {
      const g = graphOf(c);
      const pending = (c.meta.proposals || []).filter((p) => p.state === "pending").length;
      return h("li", {},
        h("a", { class: "title", href: "#/p/" + c.id.split("/").map(encodeURIComponent).join("/") }, c.title),
        h("div", { class: "sub" }, h("span", {}, `${g.nodes.size} steps`), h("span", {}, `${g.edges.length} transitions`), pending ? h("span", {}, `${pending} proposed change${pending > 1 ? "s" : ""}`) : "", c.generated_at ? h("span", {}, "updated ", timeEl(c.generated_at)) : ""),
        c.description ? h("div", { class: "desc" }, c.description) : "");
    })) : h("p", { class: "empty" }, "No procedures recorded yet. Record one as a concept with type: Procedure."));
}

export async function procedureView(id) {
  const c = store.concepts.get(id);
  if (!c) return h("div", { class: "page" }, h("h1", {}, "Not found"), h("p", {}, h("a", { href: "#/procedures" }, "All procedures")));
  document.title = `${c.title} · ${store.site.title}`;
  const g = graphOf(c);
  const text = await body(id);
  const panel = h("div", { class: "inspector-wrap" }, inspector(g, null));
  let selected = null;
  // Left-to-right when it fits beside the inspector, otherwise top-to-bottom.
  const available = Math.min(window.innerWidth, 1320) - (window.innerWidth > 1000 ? 420 : 40);
  const vertical = layers(g).length * 260 > available;
  const svg = flow(g, (sel, el) => {
    selected?.classList.remove("selected");
    el.classList.add("selected");
    selected = el;
    panel.replaceChildren(inspector(g, sel));
    if (vertical) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, vertical);
  return h("div", { class: "page wide" },
    h("p", { class: "doc-kind" }, h("a", { href: "#/procedures" }, "Procedures"), h("a", { href: conceptHref(id) }, "Open as concept")),
    h("h1", {}, c.title),
    c.description ? h("p", { class: "lede" }, c.description) : "",
    legend(),
    h("div", { class: "flow-layout" }, h("div", { class: "flow-scroll" }, svg), panel),
    proposalsView(c),
    text.trim() ? [h("h2", { class: "section-h" }, "Notes"), h("div", { class: "prose", html: render(text, { dir: c.directory }) })] : "");
}
