// A procedure's graph laid out as a layered flow: steps in columns by their
// longest path from the start (loops drawn around the outside), left to right
// or top to bottom. Pure geometry; FlowGraph.svelte draws it.

import type { ConceptRecord } from "@rdstudio/core";

export const RELATIONS: Record<string, { label: string; color: string }> = {
  LEADS_TO: { label: "leads to", color: "var(--ink-soft)" },
  TRIGGERS: { label: "triggers", color: "var(--accent)" },
  PROVIDES_INPUT_FOR: { label: "provides input for", color: "var(--cat-code)" },
  CONVERGES_TO: { label: "converges to", color: "var(--reviewed)" },
};
export const relation = (r: string) => RELATIONS[r] ?? RELATIONS.LEADS_TO!;

export interface Step { id: string; label: string; description?: unknown; [k: string]: unknown }
export interface Transition { from: string; to: string; relation: string; condition?: string; guidance?: string; pitfalls?: string }
export interface Graph { nodes: Map<string, Step>; edges: Transition[]; start: string | undefined }

export function graphOf(c: ConceptRecord): Graph {
  const nodes = new Map<string, Step>();
  for (const raw of (c.meta.nodes as unknown[] | undefined) ?? []) {
    const n = (typeof raw === "string" ? { id: raw } : raw) as Record<string, unknown> | null;
    if (n && n.id != null) nodes.set(String(n.id), { ...n, id: String(n.id), label: String(n.label || n.id) });
  }
  const edges = ((c.meta.edges as Record<string, unknown>[] | undefined) ?? [])
    .filter((e) => e && nodes.has(String(e.from)) && nodes.has(String(e.to)))
    .map((e) => ({ ...e, from: String(e.from), to: String(e.to), relation: String(e.relation || "LEADS_TO") }) as Transition);
  const start = c.meta.start != null && nodes.has(String(c.meta.start)) ? String(c.meta.start) : nodes.keys().next().value;
  return { nodes, edges, start };
}

/** Longest-path layering: depth is the longest route from the start, ignoring
 *  edges that loop back; steps unreachable from the start follow at the end. */
export function layers(g: Graph): string[][] {
  const back = new Set<Transition>();
  const state = new Map<string, 1 | 2>(); // 1 = on the stack, 2 = done
  const visit = (id: string): void => {
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
  for (const e of forward) indeg.set(e.to, indeg.get(e.to)! + 1);
  const depth = new Map<string, number>();
  const queue = [...g.nodes.keys()].filter((id) => indeg.get(id) === 0).sort((a, b) => (a === g.start ? -1 : b === g.start ? 1 : 0));
  for (const id of queue) depth.set(id, 0);
  const order: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    order.push(cur);
    for (const e of forward) {
      if (e.from !== cur) continue;
      depth.set(e.to, Math.max(depth.get(e.to) ?? 0, depth.get(cur)! + 1));
      indeg.set(e.to, indeg.get(e.to)! - 1);
      if (indeg.get(e.to) === 0) queue.push(e.to);
    }
  }
  const cols: string[][] = [];
  for (const id of order) (cols[depth.get(id)!] ??= []).push(id);
  return cols.filter(Boolean);
}

function wrap(text: string, width = 20): string[] {
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if ((line + " " + w).trim().length > width && line) { lines.push(line); line = w; } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

export interface Box { lines: string[]; x: number; y: number; w: number; h: number; layer: number }
export interface Layout { boxes: Map<string, Box>; paths: string[]; viewBox: string; width: number; line: number; pad: number }

export function layout(g: Graph, vertical: boolean): Layout {
  const NODE_W = 168, LINE = 17, PAD = 12, GAP_MAIN = vertical ? 64 : 92, GAP_CROSS = 22, M = 64;
  const cols = layers(g);
  const boxes = new Map<string, Box>();
  for (const [id, n] of g.nodes) {
    const lines = wrap(n.label);
    boxes.set(id, { lines, w: NODE_W, h: lines.length * LINE + PAD * 2, x: 0, y: 0, layer: 0 });
  }
  // Position columns (main axis) and stack steps (cross axis), centred.
  const colSize = cols.map((col) => col.reduce((s, id) => s + (vertical ? NODE_W : boxes.get(id)!.h) + GAP_CROSS, -GAP_CROSS));
  const cross = Math.max(...colSize, 0);
  let main = 0;
  cols.forEach((col, i) => {
    const thick = Math.max(...col.map((id) => (vertical ? boxes.get(id)!.h : NODE_W)));
    let pos = (cross - colSize[i]!) / 2;
    for (const id of col) {
      const b = boxes.get(id)!;
      b.layer = i;
      if (vertical) { b.x = pos; b.y = main + (thick - b.h) / 2; pos += NODE_W + GAP_CROSS; }
      else { b.x = main; b.y = pos; pos += b.h + GAP_CROSS; }
    }
    main += thick + GAP_MAIN;
  });
  const W = vertical ? cross : main - GAP_MAIN, H = vertical ? main - GAP_MAIN : cross;
  const anchor = (b: Box, side: "in" | "out") => {
    if (vertical) return side === "out" ? [b.x + b.w / 2, b.y + b.h] : [b.x + b.w / 2, b.y];
    return side === "out" ? [b.x + b.w, b.y + b.h / 2] : [b.x, b.y + b.h / 2];
  };
  const paths = g.edges.map((e, i) => {
    const a = boxes.get(e.from)!, b = boxes.get(e.to)!;
    const forward = b.layer > a.layer, span = b.layer - a.layer;
    if (forward && span > 1) {
      // Skips layers: bow out to the side so it does not cross intermediate steps.
      const [x1, y1] = vertical ? [a.x, a.y + a.h / 2] : [a.x + a.w / 2, a.y + a.h];
      const [x2, y2] = vertical ? [b.x, b.y + b.h / 2] : [b.x + b.w / 2, b.y + b.h];
      const off = 46 + 10 * (i % 3);
      return vertical ? `M${x1},${y1} C${x1! - off},${y1} ${x2! - off},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1},${y1! + off} ${x2},${y2! + off} ${x2},${y2}`;
    }
    if (forward) {
      const [x1, y1] = anchor(a, "out"), [x2, y2] = anchor(b, "in");
      return vertical ? `M${x1},${y1} C${x1},${(y1! + y2!) / 2} ${x2},${(y1! + y2!) / 2} ${x2},${y2}`
        : `M${x1},${y1} C${(x1! + x2!) / 2},${y1} ${(x1! + x2!) / 2},${y2} ${x2},${y2}`;
    }
    // Loop back around the outside of the flow.
    const [x1, y1] = vertical ? [a.x + a.w, a.y + a.h / 2] : [a.x + a.w / 2, a.y];
    const [x2, y2] = vertical ? [b.x + b.w, b.y + b.h / 2] : [b.x + b.w / 2, b.y];
    const off = 40 + 12 * (i % 3);
    return vertical ? `M${x1},${y1} C${x1! + off},${y1} ${x2! + off},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1},${y1! - off} ${x2},${y2! - off} ${x2},${y2}`;
  });
  return { boxes, paths, viewBox: `${-M} ${-M} ${W + 2 * M} ${H + 2 * M}`, width: W + 2 * M, line: LINE, pad: PAD };
}
