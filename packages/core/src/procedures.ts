// Procedural graphs stored in OKF concepts (a port of src/rdstudio/procedures.py).
// A `type: Procedure` concept carries, in frontmatter:
//
//   start: <node id>                       # optional; default: first node
//   nodes: [{id, label, description?}]
//   edges: [{from, to, relation, condition?, guidance?, pitfalls?}]
//   proposals: [{id, by, at, rationale, edits: [...], state}]   # pending, applied or rejected
//
// Agents retrieve only the neighbourhood of their current step; edits to a
// graph are proposed by agents and applied or rejected by the developer.

import type { Concept } from "./bundle.ts";
import { pyRepr, text } from "./text.ts";

export const RELATIONS = ["LEADS_TO", "TRIGGERS", "PROVIDES_INPUT_FOR", "CONVERGES_TO"] as const;
export const ATTRIBUTES = ["condition", "guidance", "pitfalls"] as const;
export const EDIT_OPS = ["add_node", "update_node", "delete_node", "add_edge", "update_edge", "delete_edge"] as const;

export class ProcedureError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
// Values in messages are shown as the Python core shows them.
const show = pyRepr;

export function isProcedure(c: Concept): boolean {
  return c.type.toLowerCase() === "procedure";
}

export interface Edge extends Obj {
  from: string;
  to: string;
  relation: string;
}

export class Graph {
  readonly nodes: Map<string, Obj>;
  readonly edges: Edge[];
  readonly start: string | null;
  readonly issues: string[];

  constructor(nodes: Map<string, Obj>, edges: Edge[], start: string | null, issues: string[] = []) {
    this.nodes = nodes;
    this.edges = edges;
    this.start = start;
    this.issues = issues;
  }

  static fromMeta(meta: Obj): Graph {
    const issues: string[] = [];
    const nodes = new Map<string, Obj>();
    for (let raw of (Array.isArray(meta.nodes) ? meta.nodes : [])) {
      if (typeof raw === "string") raw = { id: raw };
      if (!isObj(raw) || !raw.id) { issues.push(`node without id: ${show(raw)}`); continue; }
      const nid = text(raw.id);
      if (nodes.has(nid)) issues.push(`duplicate node ${show(nid)}`);
      const { id: _id, label, ...rest } = raw;
      nodes.set(nid, { label: text(label || nid), ...rest });
    }
    const edges: Edge[] = [];
    for (const raw of (Array.isArray(meta.edges) ? meta.edges : [])) {
      if (!isObj(raw)) { issues.push(`edge is not a mapping: ${show(raw)}`); continue; }
      const src = text(raw.from ?? ""), dst = text(raw.to ?? "");
      const relation = text(raw.relation || "LEADS_TO");
      for (const end of [src, dst]) {
        if (!nodes.has(end)) issues.push(`edge ${show(src)} -> ${show(dst)} references unknown node ${show(end)}`);
      }
      if (!(RELATIONS as readonly string[]).includes(relation)) issues.push(`edge ${show(src)} -> ${show(dst)} has unknown relation ${show(relation)}`);
      edges.push({ ...raw, from: src, to: dst, relation });
    }
    const start = meta.start;
    if (start !== null && start !== undefined && !nodes.has(text(start))) issues.push(`start node ${show(start)} does not exist`);
    const first = nodes.keys().next();
    return new Graph(nodes, edges, start !== null && start !== undefined ? text(start) : first.done ? null : first.value, issues);
  }

  toMeta(): Obj {
    return { nodes: [...this.nodes].map(([id, attrs]) => ({ id, ...attrs })), edges: this.edges };
  }

  /** Localise the current step: exact id, then case-insensitive id or label. */
  match(step: string | null | undefined): string | null {
    if (!step) return this.start;
    if (this.nodes.has(step)) return step;
    const wanted = step.trim().toLowerCase();
    for (const [nid, attrs] of this.nodes) {
      if (nid.toLowerCase() === wanted || text(attrs.label ?? "").toLowerCase() === wanted) return nid;
    }
    return null;
  }

  /** `node` and everything reachable within `hops` outgoing transitions. */
  neighbourhood(node: string, hops = 2): Graph {
    const seen = new Map([[node, 0]]);
    const queue = [node];
    while (queue.length) {
      const current = queue.shift()!;
      if (seen.get(current)! >= hops) continue;
      for (const e of this.edges) {
        if (e.from === current && !seen.has(e.to)) { seen.set(e.to, seen.get(current)! + 1); queue.push(e.to); }
      }
    }
    const nodes = new Map([...seen.keys()].filter((n) => this.nodes.has(n)).map((n) => [n, this.nodes.get(n)!]));
    const edges = this.edges.filter((e) => seen.has(e.from) && seen.has(e.to) && seen.get(e.from)! < hops);
    return new Graph(nodes, edges, node);
  }
}

export function graphOf(c: Concept): Graph {
  return Graph.fromMeta(c.meta);
}

/** Every procedure's structural problems, as [path, message]. */
export function lintProcedures(concepts: Iterable<Concept>): [string, string][] {
  const out: [string, string][] = [];
  for (const c of concepts) if (isProcedure(c)) for (const msg of graphOf(c).issues) out.push([c.path, msg]);
  return out;
}

/** A compact, agent-facing description of a (sub)graph. */
export function describe(proc: Concept, graph: Graph, current: string | null): Obj {
  return {
    procedure: proc.id,
    title: proc.title,
    current,
    steps: Object.fromEntries([...graph.nodes].map(([nid, attrs]) => [nid, attrs.label ?? nid])),
    transitions: graph.edges.map((e) => {
      const out: Obj = { from: e.from, to: e.to, relation: e.relation };
      for (const k of ATTRIBUTES) if (e[k]) out[k] = e[k];
      return out;
    }),
  };
}

export function validateEdits(edits: unknown): asserts edits is Obj[] {
  if (!Array.isArray(edits) || !edits.length) throw new ProcedureError("a proposal needs at least one edit");
  for (const e of edits) {
    const op = isObj(e) ? e.op : undefined;
    if (!(EDIT_OPS as readonly unknown[]).includes(op)) throw new ProcedureError(`unknown edit op ${show(op)}; use one of ${EDIT_OPS.join(", ")}`);
    if (String(op).endsWith("_node") && !(e as Obj).id) throw new ProcedureError(`${op} needs an 'id'`);
    if (String(op).endsWith("_edge") && !((e as Obj).from && (e as Obj).to)) throw new ProcedureError(`${op} needs 'from' and 'to'`);
  }
}

export function applyEdits(graph: Graph, edits: Obj[]): Graph {
  const nodes = new Map([...graph.nodes].map(([k, v]) => [k, { ...v }]));
  let edges: Edge[] = graph.edges.map((e) => ({ ...e }));
  const sameEnds = (x: Edge, e: Obj) => x.from === e.from && x.to === e.to && (!e.relation || x.relation === e.relation);
  for (const e of edits) {
    const { op, ...attrs } = e;
    const id = text(e.id);
    if (op === "add_node") {
      const { id: _i, label, ...rest } = attrs;
      nodes.set(id, { label: text(label || e.id), ...rest });
    } else if (op === "update_node") {
      const { id: _i, ...rest } = attrs;
      nodes.set(id, { ...(nodes.get(id) ?? {}), ...rest });
    } else if (op === "delete_node") {
      nodes.delete(id);
      edges = edges.filter((x) => x.from !== id && x.to !== id);
    } else if (op === "add_edge") {
      const edge: Edge = { from: e.from as string, to: e.to as string, relation: (e.relation as string) ?? "LEADS_TO" };
      for (const k of ATTRIBUTES) if (e[k]) edge[k] = e[k];
      edges.push(edge);
    } else if (op === "update_edge") {
      for (const x of edges) if (sameEnds(x, e)) for (const k of [...ATTRIBUTES, "relation"]) if (k in e) x[k] = e[k];
    } else if (op === "delete_edge") {
      edges = edges.filter((x) => !sameEnds(x, e));
    }
  }
  const meta: Obj = { nodes: [...nodes].map(([k, v]) => ({ id: k, ...v })), edges };
  if (graph.start !== null && nodes.has(graph.start)) meta.start = graph.start;
  return Graph.fromMeta(meta);
}
