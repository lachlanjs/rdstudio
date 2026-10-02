// Catching up on change (T29): which notes changed since you last looked
// (the note's version in your record against its version now), what changed
// (the commits and a diff, from the server's git history), and notes you
// understood whose prerequisites have changed since.

import type { ConceptRecord } from "@rdstudio/core";
import { isStudyNote } from "@rdstudio/core/learning";
import { getApiHistoryById } from "./api/sdk.gen.ts";
import type { NoteHistory } from "./api/types.gen.ts";
import { learner, store } from "./data.svelte.ts";
import { understanding } from "./understanding.svelte.ts";

type Event = Record<string, unknown>;
const LOOKS = new Set(["seen", "mark", "exercise", "explain", "tour_step"]);

export interface Look {
  at: string;
  hash: string;
}

/** The last time you looked at each note, and the version you saw. */
export function lastLooks(events: readonly Event[] = learner.events): Map<string, Look> {
  const out = new Map<string, Look>();
  for (const e of events) {
    if (LOOKS.has(String(e.event)) && typeof e.concept === "string" && typeof e.hash === "string" && typeof e.at === "string") {
      out.set(e.concept, { at: e.at, hash: e.hash });
    }
  }
  return out;
}

/** Notes you have looked at that have changed meaningfully since: the ones
 *  you worked through or understood first, then the most recently seen. */
export function changedSince(): { c: ConceptRecord; look: Look }[] {
  if (!understanding.on) return [];
  const rank = (id: string) => ({ understood: 0, processed: 1 } as Record<string, number>)[understanding.state(id)?.state ?? ""] ?? 2;
  const out: { c: ConceptRecord; look: Look }[] = [];
  for (const [id, look] of lastLooks()) {
    const c = store.concepts.get(id);
    if (c && isStudyNote(c) && c.hash !== look.hash) out.push({ c, look });
  }
  return out.sort((a, b) => rank(a.c.id) - rank(b.c.id) || (a.look.at < b.look.at ? 1 : -1));
}

/** The notes a note requires that were meaningfully edited after you worked
 *  through or understood it: what you know may rest on something that moved. */
export function prerequisitesChanged(id: string): ConceptRecord[] {
  const s = understanding.state(id);
  const c = store.concepts.get(id);
  if (!c || !s || (s.state !== "processed" && s.state !== "understood") || !s.at) return [];
  const since = Date.parse(s.at);
  return c.requires.map((r) => store.concepts.get(r)).filter((p): p is ConceptRecord =>
    !!p && !!p.generated_at && Date.parse(p.generated_at) > since);
}

export function allPrerequisitesChanged(): { c: ConceptRecord; changed: ConceptRecord[] }[] {
  if (!understanding.on) return [];
  const out = [];
  for (const c of store.concepts.values()) {
    const changed = prerequisitesChanged(c.id);
    if (changed.length) out.push({ c, changed });
  }
  return out;
}

export async function historyOf(id: string, since: string): Promise<NoteHistory | null> {
  try {
    const { data } = await getApiHistoryById({ path: { id }, query: { since } });
    return data ?? null;
  } catch {
    return null;
  }
}

/** A unified diff as lines to show: hunks, additions, removals and context
 *  (git's own headers left out). */
export function diffLines(diff: string): { kind: "hunk" | "add" | "del" | "same"; text: string }[] {
  const out: { kind: "hunk" | "add" | "del" | "same"; text: string }[] = [];
  let inHunk = false;
  for (const line of diff.split("\n")) {
    if (line.startsWith("@@")) { inHunk = true; out.push({ kind: "hunk", text: line.replace(/^@@[^@]*@@\s?/, "") }); continue; }
    if (!inHunk || line.startsWith("\\ No newline")) continue;
    if (line.startsWith("diff --git")) { inHunk = false; continue; }
    if (line.startsWith("+")) out.push({ kind: "add", text: line.slice(1) });
    else if (line.startsWith("-")) out.push({ kind: "del", text: line.slice(1) });
    else out.push({ kind: "same", text: line.slice(1) });
  }
  while (out.length && out.at(-1)!.kind === "same" && !out.at(-1)!.text) out.pop();
  return out;
}
