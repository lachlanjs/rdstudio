// Proposing and resolving edits to a procedure's graph, written to its note.
// The graph logic is in @rdstudio/core (procedures.ts); a port of the write
// side of src/rdstudio/procedures.py.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Graph, ProcedureError, applyEdits, text, validateEdits } from "@rdstudio/core";
import { conceptPath, now, parsed, spliceText } from "./store.ts";

// Only the fields that change are rewritten (proposals, and on acceptance the
// graph and provenance); the rest of the note keeps its lines.

function load(root: string, cid: string): { path: string; file: string; meta: Record<string, unknown> } {
  const path = conceptPath(root, cid);
  if (!existsSync(path)) throw new ProcedureError(`no such procedure: ${cid}`);
  const file = readFileSync(path, "utf8");
  const [meta] = parsed(file);
  if (text(meta.type ?? "").toLowerCase() !== "procedure") throw new ProcedureError(`${cid} is not a Procedure concept`);
  return { path, file, meta };
}

const proposalId = (p: unknown): number => Number.parseInt(text((p as Record<string, unknown>)?.id ?? 0), 10) || 0;

export function propose(root: string, cid: string, { edits, rationale, actor }: { edits: unknown; rationale: string; actor: string }) {
  validateEdits(edits);
  const { path, file, meta } = load(root, cid);
  const proposals = Array.isArray(meta.proposals) ? meta.proposals : [];
  const pid = Math.max(0, ...proposals.map(proposalId)) + 1;
  // Try it first, so structurally invalid proposals are refused up front.
  const trial = applyEdits(Graph.fromMeta(meta), edits);
  if (trial.issues.length) throw new ProcedureError(`proposal would leave the graph invalid: ${trial.issues.join("; ")}`);
  const proposal = { id: pid, by: actor, at: now(), state: "pending", rationale, edits };
  writeFileSync(path, spliceText(file, { proposals: [...proposals, proposal] }, null), "utf8");
  return { procedure: cid, proposal: pid, state: "pending" };
}

export function resolve(root: string, cid: string, pid: number, { accept, actor }: { accept: boolean; actor: string }) {
  const { path, file, meta } = load(root, cid);
  const proposals = Array.isArray(meta.proposals) ? (meta.proposals as Record<string, unknown>[]) : [];
  const index = proposals.findIndex((p) => proposalId(p) === pid);
  if (index < 0) throw new ProcedureError(`no proposal ${pid} on ${cid}`);
  const match = proposals[index]!;
  if (match.state !== "pending") throw new ProcedureError(`proposal ${pid} is already ${text(match.state ?? "None")}`);
  const changes: Record<string, unknown> = {};
  if (accept) {
    const graph = applyEdits(Graph.fromMeta(meta), (match.edits ?? []) as Record<string, unknown>[]);
    if (graph.issues.length) throw new ProcedureError(`cannot apply: ${graph.issues.join("; ")}`);
    const { nodes, edges } = graph.toMeta();
    Object.assign(changes, { nodes, edges, generated: { by: actor, at: now() } });
  }
  const state = accept ? "applied" : "rejected";
  changes.proposals = proposals.map((p, i) => (i === index ? { ...p, state, resolved: { by: actor, at: now() } } : p));
  writeFileSync(path, spliceText(file, changes, null), "utf8");
  return { procedure: cid, proposal: pid, state };
}
