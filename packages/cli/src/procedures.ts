// Proposing and resolving edits to a procedure's graph, written to its note.
// The graph logic is in @rdstudio/core (procedures.ts); a port of the write
// side of src/rdstudio/procedures.py.

import { existsSync } from "node:fs";
import { isMap, isSeq, type YAMLMap } from "yaml";
import { Graph, ProcedureError, applyEdits, text, validateEdits } from "@rdstudio/core";
import { conceptPath, node, now, readNote, writeNote, type Note } from "./store.ts";

function load(root: string, cid: string): { path: string; note: Note; meta: Record<string, unknown> } {
  const path = conceptPath(root, cid);
  if (!existsSync(path)) throw new ProcedureError(`no such procedure: ${cid}`);
  const note = readNote(path);
  const meta = (note.doc.toJS() ?? {}) as Record<string, unknown>;
  if (text(meta.type ?? "").toLowerCase() !== "procedure") throw new ProcedureError(`${cid} is not a Procedure concept`);
  return { path, note, meta };
}

const proposalId = (p: unknown): number => Number.parseInt(text((p as Record<string, unknown>)?.id ?? 0), 10) || 0;

export function propose(root: string, cid: string, { edits, rationale, actor }: { edits: unknown; rationale: string; actor: string }) {
  validateEdits(edits);
  const { path, note, meta } = load(root, cid);
  const proposals = Array.isArray(meta.proposals) ? meta.proposals : [];
  const pid = Math.max(0, ...proposals.map(proposalId)) + 1;
  // Try it first, so structurally invalid proposals are refused up front.
  const trial = applyEdits(Graph.fromMeta(meta), edits);
  if (trial.issues.length) throw new ProcedureError(`proposal would leave the graph invalid: ${trial.issues.join("; ")}`);
  const proposal = node(note.doc, { id: pid, by: actor, at: now(), state: "pending", rationale, edits });
  const existing = note.doc.get("proposals", true);
  if (isSeq(existing)) existing.items.push(proposal);
  else note.doc.set("proposals", note.doc.createNode([proposal]));
  writeNote(path, note);
  return { procedure: cid, proposal: pid, state: "pending" };
}

export function resolve(root: string, cid: string, pid: number, { accept, actor }: { accept: boolean; actor: string }) {
  const { path, note, meta } = load(root, cid);
  const proposals = Array.isArray(meta.proposals) ? (meta.proposals as Record<string, unknown>[]) : [];
  const index = proposals.findIndex((p) => proposalId(p) === pid);
  if (index < 0) throw new ProcedureError(`no proposal ${pid} on ${cid}`);
  const match = proposals[index]!;
  if (match.state !== "pending") throw new ProcedureError(`proposal ${pid} is already ${text(match.state ?? "None")}`);
  const { doc } = note;
  if (accept) {
    const graph = applyEdits(Graph.fromMeta(meta), (match.edits ?? []) as Record<string, unknown>[]);
    if (graph.issues.length) throw new ProcedureError(`cannot apply: ${graph.issues.join("; ")}`);
    const { nodes, edges } = graph.toMeta();
    doc.set("nodes", node(doc, nodes));
    doc.set("edges", node(doc, edges));
    doc.set("generated", node(doc, { by: actor, at: now() }));
  }
  const state = accept ? "applied" : "rejected";
  const item = (doc.get("proposals", true) as { items: unknown[] }).items[index];
  if (isMap(item)) {
    (item as YAMLMap).set("state", state);
    (item as YAMLMap).set("resolved", node(doc, { by: actor, at: now() }));
  }
  writeNote(path, note);
  return { procedure: cid, proposal: pid, state };
}

