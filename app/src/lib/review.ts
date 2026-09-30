// What needs the developer's attention (the Review tab and its count).

import type { ConceptRecord } from "@rdstudio/core";
import { store } from "./data.svelte.ts";

export interface Proposal {
  id: number;
  by: string;
  at: string;
  state: string;
  rationale: string;
  edits: Record<string, unknown>[];
}

export const procedures = (): ConceptRecord[] =>
  [...store.concepts.values()].filter((c) => (c.type || "").toLowerCase() === "procedure");

export function pendingProposals(): { c: ConceptRecord; p: Proposal }[] {
  return procedures().flatMap((c) =>
    ((c.meta.proposals as Proposal[] | undefined) ?? []).filter((p) => p.state === "pending").map((p) => ({ c, p })));
}

export function reviewItems() {
  const all = [...store.concepts.values()];
  const byGenerated = (a: ConceptRecord, b: ConceptRecord) => String(b.generated_at ?? "").localeCompare(String(a.generated_at ?? ""));
  const issues = store.site.issues ?? [];
  return {
    stale: all.filter((c) => c.verification_stale).sort(byGenerated),
    unverified: all.filter((c) => c.trust === "unverified").sort(byGenerated),
    questions: all.filter((c) => c.type.toLowerCase() === "question" && !(c.tags ?? []).includes("answered") && c.status !== "deprecated"),
    drafts: all.filter((c) => c.status === "draft"),
    expired: all.filter((c) => c.content_stale),
    errors: issues.filter((i) => i.level === "error"),
    broken: issues.filter((i) => i.code === "broken-link"),
    cycles: issues.filter((i) => i.code === "requires-cycle"),
    proposals: pendingProposals(),
  };
}

export function reviewCount(): number {
  const r = reviewItems();
  return r.stale.length + r.unverified.length + r.questions.length + r.errors.length + r.proposals.length + r.cycles.length;
}
