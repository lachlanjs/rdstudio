// The understanding layer's rules, as pure functions over a learner record:
// where each note stands for the reader (discovery), when it is due for
// recall (spaced review), how much was studied today (load), and the stops of
// a tour. Shared by the dashboard, the command line and the MCP tools, so all
// read the record the same way. See knowledge/design/understanding-layer.md.
//
// The events read here (all carry `concept` and the note's `hash` when about
// a note):
//   seen            the note was opened
//   mark            the reader marked it: state discovered, processed or understood
//   exercise        an interactive exercise: exercise, result got | partly | missed
//                   (recall and gap are evidence of understanding; placement
//                   and landmarks are practice, recorded but not evidence)
//   explain         an explain-back answer, waiting to be marked: answer, question?
//   explain_marked  an agent marked one: ref (the explain event's id), result, feedback
//   question        an agent set an explain-back question: question
//   tour_step       a stop of a tour was reached: tour, stop

import MarkdownIt from "markdown-it";
import { strip } from "./text.ts";

export const STATES = ["undiscovered", "discovered", "processed", "understood"] as const;
export type Discovery = (typeof STATES)[number];
export const RESULTS = ["missed", "partly", "got"] as const;
export type Result = (typeof RESULTS)[number];

export interface NoteRef {
  id: string;
  hash: string;
}

export interface NoteState {
  state: Discovery;
  /** The version of the note the state was reached on. */
  hash: string | null;
  /** Processed or understood, but the note has changed meaningfully since. */
  changed: boolean;
  /** How the state was reached: autodidactic (marked), interactive or ai (evidence). */
  kind: string | null;
  at: string | null;
}

/** An event as read from a record (its id is not needed here). */
type LearnerEvent = Record<string, unknown>;

const rank = (s: Discovery): number => STATES.indexOf(s);
/** Exercises whose right answer counts as evidence that a note is understood,
 *  and that schedule its next review. */
export const EVIDENCE = new Set(["recall", "gap"]);
const evidence = (e: LearnerEvent): boolean => e.event === "explain_marked" || (e.event === "exercise" && EVIDENCE.has(String(e.exercise)));
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Each note's discovery state. Opening a note discovers it; marking sets the
 *  state (down as well as up); a passed exercise or explain-back makes it
 *  understood. Events are read in the order written. */
export function discoveryStates(events: readonly LearnerEvent[], notes: Iterable<NoteRef>): Map<string, NoteState> {
  const out = new Map<string, NoteState>();
  for (const n of notes) out.set(n.id, { state: "undiscovered", hash: null, changed: false, kind: null, at: null });
  for (const e of events) {
    const id = str(e.concept);
    const s = id === null ? undefined : out.get(id);
    if (!s) continue;
    const hash = str(e.hash), at = str(e.at);
    const reach = (state: Discovery, kind: string | null, force = false) => {
      if (!force && rank(state) < rank(s.state)) return;
      s.state = state; s.hash = hash; s.kind = kind; s.at = at;
    };
    if (e.event === "seen") reach("discovered", null);
    else if (e.event === "mark" && (STATES as readonly unknown[]).includes(e.state)) reach(e.state as Discovery, "autodidactic", true);
    else if (evidence(e) && e.result === "got") reach("understood", e.event === "exercise" ? "interactive" : "ai");
    else if (s.state === "undiscovered" && (e.event === "exercise" || e.event === "explain" || e.event === "tour_step")) reach("discovered", null);
  }
  const current = new Map([...notes].map((n) => [n.id, n.hash]));
  for (const [id, s] of out) s.changed = rank(s.state) >= rank("processed") && s.hash !== null && s.hash !== current.get(id);
  return out;
}

/** A folder's notes by state, for a coverage bar: never one score. */
export function coverage(states: Map<string, NoteState>, ids: Iterable<string>): Record<Discovery, number> & { total: number } {
  const out = { undiscovered: 0, discovered: 0, processed: 0, understood: 0, total: 0 };
  for (const id of ids) {
    const s = states.get(id);
    if (!s) continue;
    out[s.state]++;
    out.total++;
  }
  return out;
}

// ------------------------------------------------------------------ spaced review

const DAY = 86_400_000;
/** Days until the next recall, by box: a right answer moves a note up a box,
 *  "partly" keeps it there, a miss sends it back to the first. */
export const INTERVALS = [1, 3, 7, 16, 35, 80] as const;
/** At most this many reviews are offered at once, so a backlog never piles up
 *  (anti-windup); the rest wait, oldest first. */
export const REVIEW_CAP = 8;

export interface Review {
  id: string;
  box: number;
  due: number; // ms
  last: string | null; // the last recall's time
}

/** Notes in review: every note you marked processed or understood, or have
 *  been tested on. Each is due a box's interval after its last recall (or
 *  after being marked, a day). */
export function reviewSchedule(events: readonly LearnerEvent[], notes: Iterable<NoteRef>): Map<string, Review> {
  const known = new Set([...notes].map((n) => n.id));
  const out = new Map<string, Review>();
  for (const e of events) {
    const id = str(e.concept);
    const at = Date.parse(str(e.at) ?? "");
    if (id === null || !known.has(id) || Number.isNaN(at)) continue;
    const r = out.get(id);
    if (e.event === "mark") {
      if (e.state === "processed" || e.state === "understood") { if (!r) out.set(id, { id, box: 0, due: at + DAY, last: null }); }
      else out.delete(id); // marked back down: out of review
    } else if (evidence(e) && (RESULTS as readonly unknown[]).includes(e.result)) {
      const box = e.result === "got" ? Math.min((r?.box ?? -1) + 1, INTERVALS.length - 1) : e.result === "partly" ? Math.max(r?.box ?? 0, 0) : 0;
      out.set(id, { id, box, due: at + INTERVALS[box]! * DAY, last: str(e.at) });
    }
  }
  return out;
}

/** What is due now, oldest first, at most REVIEW_CAP; and how many more are due. */
export function dueReviews(schedule: Map<string, Review>, now: number, cap = REVIEW_CAP): { due: Review[]; more: number } {
  const all = [...schedule.values()].filter((r) => r.due <= now).sort((a, b) => a.due - b.due || (a.id < b.id ? -1 : 1));
  return { due: all.slice(0, cap), more: Math.max(0, all.length - cap) };
}

// ------------------------------------------------------------------ load

const STUDY = new Set(["seen", "mark", "exercise", "explain", "tour_step"]);

/** Distinct notes studied today, against the median of the days you studied
 *  in the four weeks before (null until there are five such days). `day`
 *  gives a time's calendar day where the reader is. */
export function studyLoad(events: readonly LearnerEvent[], now: number, day: (ms: number) => string): { today: number; usual: number | null } {
  const byDay = new Map<string, Set<string>>();
  const since = now - 28 * DAY;
  for (const e of events) {
    const at = Date.parse(str(e.at) ?? "");
    const id = str(e.concept);
    if (!STUDY.has(String(e.event)) || id === null || Number.isNaN(at) || at < since || at > now) continue;
    const d = day(at);
    if (!byDay.has(d)) byDay.set(d, new Set());
    byDay.get(d)!.add(id);
  }
  const today = byDay.get(day(now))?.size ?? 0;
  byDay.delete(day(now));
  const counts = [...byDay.values()].map((s) => s.size).sort((a, b) => a - b);
  if (counts.length < 5) return { today, usual: null };
  const mid = counts.length >> 1;
  return { today, usual: counts.length % 2 ? counts[mid]! : Math.round((counts[mid - 1]! + counts[mid]!) / 2) };
}

/** The one sentence the load indicator says, or null when there is nothing worth saying. */
export function loadNote({ today, usual }: { today: number; usual: number | null }): string | null {
  if (usual === null || today < 8 || today < 2 * Math.max(usual, 1)) return null;
  return `${today} notes today against your usual ${usual}; consolidation tends to work better after a break.`;
}

// ------------------------------------------------------------------ tours

export interface TourStop {
  href: string; // the link as written
  label: string; // the link's text
  text: string; // the narration, Markdown
}

const md = new MarkdownIt("commonmark");
const LEAD_LINK = /^\s*\[(?:[^\]\\]|\\.)*\]\((?:[^()\\]|\\.|\([^()]*\))*\)\s*(?:[:—–-]\s*)?/;

/** A tour's stops: each item of the note's lists (outermost only) whose text
 *  holds a link, the first link being the stop, the rest of the item its
 *  narration. `1. [Tangent space](/manifolds/tangent-space.md): where vectors live.` */
export function tourStops(body: string): TourStop[] {
  const tokens = md.parse(body, {});
  const stops: TourStop[] = [];
  let depth = 0; // list nesting
  let itemStart = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.type === "bullet_list_open" || t.type === "ordered_list_open") depth++;
    else if (t.type === "bullet_list_close" || t.type === "ordered_list_close") depth--;
    else if (t.type === "list_item_open" && depth === 1) itemStart = i;
    else if (t.type === "inline" && itemStart >= 0 && depth === 1) {
      itemStart = -1; // the item's first paragraph only
      const children = t.children ?? [];
      const open = children.findIndex((c) => c.type === "link_open");
      if (open < 0) continue;
      const close = children.findIndex((c, j) => j > open && c.type === "link_close");
      const label = children.slice(open + 1, close < 0 ? undefined : close).map((c) => c.content).join("");
      const content = t.content;
      const text = open === 0 || (open === 1 && !strip(children[0]!.content)) ? content.replace(LEAD_LINK, "") : content;
      stops.push({ href: children[open]!.attrGet("href") ?? "", label: strip(label), text: strip(text) });
    }
  }
  return stops;
}

/** A tour's body from its stops, in the form tourStops reads. */
export function tourBody(stops: readonly { title: string; href: string; text: string }[], intro = ""): string {
  const items = stops.map((s, i) => {
    const narration = strip(s.text).replace(/\n+/g, " ");
    return `${i + 1}. [${s.title.replace(/[[\]]/g, "\\$&")}](${s.href})${narration ? `: ${narration}` : ""}`;
  });
  return `${strip(intro) ? strip(intro) + "\n\n" : ""}${items.join("\n")}\n`;
}
