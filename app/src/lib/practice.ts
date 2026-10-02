// Interactive exercises (T26), checked by the dashboard, offline: recall with
// a self-grade, fill the gap, placement, and naming the landmarks. Each
// answer is an `exercise` event in the learner record (when it is on); recall
// and fill the gap count as evidence that a note is understood
// (@rdstudio/core/learning, EVIDENCE).

import type { ConceptRecord } from "@rdstudio/core";
import { learner, store } from "./data.svelte.ts";
import { titleCase } from "./format.ts";

export type Exercise = "recall" | "gap" | "placement" | "landmarks";
export type Result = "got" | "partly" | "missed";

export const EXERCISES: { kind: Exercise; name: string; what: string }[] = [
  { kind: "recall", name: "Recall", what: "See a note's title, recall what it says, then check against the note and grade yourself." },
  { kind: "gap", name: "Fill the gap", what: "A note is hidden: from its folder and the notes it links to and from, say which it is." },
  { kind: "placement", name: "Placement", what: "Given a note, choose the folder it belongs in." },
  { kind: "landmarks", name: "Landmarks", what: "Name the landmarks, the notes worth knowing by heart, from memory." },
];

/** Notes to practise on: those in `folder` (and below), tours left out. */
export function notesIn(folder: string): ConceptRecord[] {
  return [...store.concepts.values()].filter((c) => c.type !== "Tour" && (!folder || c.directory === folder || c.directory.startsWith(folder + "/")));
}

export const folderLabel = (dir: string): string =>
  dir ? dir.split("/").map((p) => titleCase(p.replace(/[-_]/g, " "))).join(" / ") : "Top level";

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const linksTo = (c: ConceptRecord): string[] =>
  [...new Set(c.links.filter((l) => l.kind === "concept" && !l.broken && l.target !== c.id && store.concepts.has(l.target)).map((l) => l.target))];

/** The landmarks among `pool`: those marked `landmark: true`; if none are,
 *  the most linked-to notes, as structural candidates. */
export function landmarks(pool: ConceptRecord[]): { notes: ConceptRecord[]; declared: boolean } {
  const declared = pool.filter((c) => c.meta?.landmark === true);
  if (declared.length) return { notes: declared, declared: true };
  const n = Math.max(3, Math.min(12, Math.round(pool.length / 8)));
  const ranked = [...pool].sort((a, b) => b.backlinks.length - a.backlinks.length || a.title.localeCompare(b.title));
  return { notes: ranked.slice(0, n).filter((c) => c.backlinks.length > 0), declared: false };
}

export interface GapItem {
  answer: ConceptRecord;
  folder: string;
  to: string[]; // titles of notes it links to
  from: string[]; // titles of notes that link to it
  options: ConceptRecord[];
}

/** A note to hide, with enough links to be found from, and three others to choose among. */
export function gapItem(pool: ConceptRecord[], used: Set<string>): GapItem | null {
  const candidates = shuffle(pool.filter((c) => !used.has(c.id) && linksTo(c).length + c.backlinks.length >= 2));
  const answer = candidates[0];
  if (!answer) return null;
  const top = answer.directory.split("/")[0];
  // Not the notes given as clues: they are plainly not the answer.
  const clues = new Set([answer.id, ...linksTo(answer), ...answer.backlinks]);
  const near = shuffle(pool.filter((c) => !clues.has(c.id) && c.directory.split("/")[0] === top));
  const far = shuffle(pool.filter((c) => !clues.has(c.id) && c.directory.split("/")[0] !== top));
  const others = [...near, ...far].slice(0, 3);
  if (others.length < 1) return null;
  const title = (id: string) => store.concepts.get(id)?.title ?? id;
  return {
    answer, folder: answer.directory,
    to: linksTo(answer).map(title).sort(), from: answer.backlinks.filter((b) => store.concepts.has(b)).map(title).sort(),
    options: shuffle([answer, ...others]),
  };
}

export interface PlaceItem {
  note: ConceptRecord;
  options: string[]; // folder ids
}

/** A note, and its folder among three others (siblings first, as they are the near misses). */
export function placementItem(pool: ConceptRecord[], used: Set<string>): PlaceItem | null {
  const folders = [...new Set(pool.map((c) => c.directory))];
  if (folders.length < 2) return null;
  const note = shuffle(pool.filter((c) => !used.has(c.id)))[0];
  if (!note) return null;
  const parent = note.directory.split("/").slice(0, -1).join("/");
  const siblings = shuffle(folders.filter((f) => f !== note.directory && f.split("/").slice(0, -1).join("/") === parent));
  const rest = shuffle(folders.filter((f) => f !== note.directory && !siblings.includes(f)));
  return { note, options: shuffle([note.directory, ...[...siblings, ...rest].slice(0, 3)]) };
}

/** A note to recall: ones due for review first (`due`), then landmarks, then any you have opened, then any. */
export function recallItem(pool: ConceptRecord[], used: Set<string>, due: string[] = []): ConceptRecord | null {
  const fresh = (c: ConceptRecord | undefined): c is ConceptRecord => !!c && !used.has(c.id) && pool.includes(c);
  const fromDue = due.map((id) => store.concepts.get(id)).find(fresh);
  if (fromDue) return fromDue;
  const seen = new Set(learner.events.filter((e) => e.event === "seen").map((e) => String(e.concept)));
  for (const group of [landmarks(pool).notes, pool.filter((c) => seen.has(c.id)), pool]) {
    const pick = shuffle(group.filter(fresh))[0];
    if (pick) return pick;
  }
  return null;
}

// ------------------------------------------------------------------ matching names

const fold = (s: string): string =>
  s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const was = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = was;
    }
  }
  return row[b.length]!;
}

/** The note a typed name means, among `notes`: the same words, allowing a
 *  slip or two in longer names, or the start of a name before a comma or "and". */
export function matchName(typed: string, notes: ConceptRecord[]): ConceptRecord | null {
  const t = fold(typed);
  if (t.length < 3) return null;
  let best: [number, ConceptRecord] | null = null;
  for (const c of notes) {
    const names = [fold(c.title), fold(c.title.split(/,| and /)[0]!)];
    for (const name of names) {
      const d = distance(t, name);
      const allowed = name.length >= 12 ? 2 : name.length >= 6 ? 1 : 0;
      if (d <= allowed && (!best || d < best[0])) best = [d, c];
    }
  }
  return best ? best[1] : null;
}

/** Record an answer, when the learner record is on. */
export function answered(exercise: Exercise, concept: string, result: Result): void {
  void learner.record({ event: "exercise", exercise, concept, result, kind: "interactive" });
}
