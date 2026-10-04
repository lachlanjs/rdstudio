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
//   attempt         an answer to an Exercise note: exercise, tests (the notes it
//                   checks), hashes (their versions), answer; result and by
//                   (dashboard or self) when marked there and then, else it waits
//   attempt_marked  an agent marked an attempt: ref, result, feedback, gaps, by;
//                   for a checked answer whose working was reviewed, it replaces the check
//   review_requested the working behind a checked answer, sent for review after the
//                   fact: ref, working (an attempt can carry working and review: true itself)
//   assigned        an agent set exercises for the developer: exercises, note, by
//   assigned_closed the developer put a set aside: ref

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
const evidence = (e: LearnerEvent): boolean =>
  e.event === "explain_marked" || e.event === "attempt_marked" || e.event === "attempt" || (e.event === "exercise" && EVIDENCE.has(String(e.exercise)));
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Note types that are walks through the notes, or work on them, rather than
 *  places among them: kept off the map and graph, and out of coverage. */
export const OFF_MAP = new Set(["Tour", "Goal", "Exercise"]);
export const isStudyNote = (c: { type: string }): boolean => !OFF_MAP.has(c.type);

const testsOf = (e: LearnerEvent): string[] => (Array.isArray(e.tests) ? e.tests.filter((t): t is string => typeof t === "string" && !!t) : []);
const hashIn = (e: LearnerEvent, id: string): string | null => {
  const h = e.hashes;
  return h && typeof h === "object" ? str((h as Record<string, unknown>)[id]) : null;
};

/** The record with each exercise attempt (and its marking) as one event per
 *  note it tests, so the rules below read them like any other. A marking
 *  replaces an attempt's own result (a review of the working behind a checked
 *  answer can lower it as well as raise it), so a marked attempt counts once,
 *  as marked. */
function* perNote(events: readonly LearnerEvent[]): Generator<LearnerEvent> {
  const attempts = new Map<string, LearnerEvent>();
  const marked = new Set(events.filter((e) => e.event === "attempt_marked").map((e) => String(e.ref)));
  for (const e of events) {
    if (e.event === "attempt") {
      if (typeof e.id === "string") attempts.set(e.id, e);
      const { result: _r, ...unsettled } = e;
      const own = typeof e.id === "string" && marked.has(e.id) ? unsettled : e;
      for (const t of testsOf(e)) yield { ...own, concept: t, hash: hashIn(e, t) };
    } else if (e.event === "attempt_marked") {
      const a = attempts.get(String(e.ref));
      if (a) for (const t of testsOf(a)) yield { ...e, concept: t, hash: hashIn(a, t) };
    } else yield e;
  }
}

/** Each note's discovery state. Opening a note discovers it; marking sets the
 *  state (down as well as up); a passed exercise or explain-back makes it
 *  understood. Events are read in the order written. */
export function discoveryStates(events: readonly LearnerEvent[], notes: Iterable<NoteRef>): Map<string, NoteState> {
  const out = new Map<string, NoteState>();
  for (const n of notes) out.set(n.id, { state: "undiscovered", hash: null, changed: false, kind: null, at: null });
  for (const e of perNote(events)) {
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
    else if (evidence(e) && e.result === "got") reach("understood", e.event === "exercise" || e.event === "attempt" || e.by === "self" ? "interactive" : "ai");
    else if (s.state === "undiscovered" && (e.event === "exercise" || e.event === "explain" || e.event === "tour_step" || e.event === "attempt")) reach("discovered", null);
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
  for (const e of perNote(events)) {
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

const STUDY = new Set(["seen", "mark", "exercise", "explain", "tour_step", "attempt"]);

/** Distinct notes studied today, against the median of the days you studied
 *  in the four weeks before (null until there are five such days). `day`
 *  gives a time's calendar day where the reader is. */
export function studyLoad(events: readonly LearnerEvent[], now: number, day: (ms: number) => string): { today: number; usual: number | null } {
  const byDay = new Map<string, Set<string>>();
  const since = now - 28 * DAY;
  for (const e of perNote(events)) {
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

// ------------------------------------------------------------------ exercises and goals
// An Exercise note: the problem, then a "Solution" heading and the solution,
// hidden until answered. Its frontmatter names the notes it tests (`tests`),
// the goals it serves (`goals`) and how it is answered (`answer`):
//   answer: { kind: choice, choices: [..], correct: 2 }      (1-based; a list for several)
//   answer: { kind: value, value: 0.5, tolerance: 1e-3, relative: false, unit: s }
//   answer: { kind: text }                                    (the default)

export type AnswerSpec =
  | { kind: "choice"; choices: string[]; correct: number[]; multiple: boolean }
  | { kind: "value"; value: number; tolerance: number; relative: boolean; unit: string | null }
  | { kind: "text" };

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;

/** A number as people type one: 1e-3, 0.5, 1/2, −3 (a minus sign), 2×10^3, 1 000. */
export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/[\s_\u2009\u202f]/g, "").replace(/\u2212/g, "-").replace(/[\u00d7x]10\^?([-+]?\d+)$/i, "e$1");
  const parts = t.split("/");
  if (parts.length > 2 || !parts.every((p) => NUMBER.test(p))) return null;
  const n = parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : Number(parts[0]);
  return Number.isFinite(n) ? n : null;
}

/** How an exercise is answered, from its frontmatter; an error says what is wrong. */
export function answerSpec(meta: Record<string, unknown> | null | undefined): AnswerSpec | { error: string } {
  const a = meta?.answer;
  if (a === undefined || a === null) return { kind: "text" };
  if (typeof a !== "object" || Array.isArray(a)) return { error: "answer should be a table: kind, and what that kind needs" };
  const o = a as Record<string, unknown>;
  const kind = o.kind ?? "text";
  if (kind === "text") return { kind: "text" };
  if (kind === "choice") {
    const choices = Array.isArray(o.choices) ? o.choices.map((c) => String(c)) : [];
    if (choices.length < 2) return { error: "a choice exercise needs at least two choices" };
    const raw = Array.isArray(o.correct) ? o.correct : [o.correct];
    const correct = raw.map((n) => (typeof n === "number" && Number.isInteger(n) ? n - 1 : -1));
    if (!correct.length || correct.some((n) => n < 0 || n >= choices.length)) return { error: `correct should be the number of the right choice, 1 to ${choices.length}` };
    return { kind, choices, correct: [...new Set(correct)].sort((x, y) => x - y), multiple: Array.isArray(o.correct) };
  }
  if (kind === "value") {
    const value = parseNumber(o.value);
    if (value === null) return { error: "a value exercise needs a number as its value" };
    const relative = o.relative === true;
    const tol = o.tolerance === undefined ? null : parseNumber(o.tolerance);
    if (o.tolerance !== undefined && (tol === null || tol < 0)) return { error: "tolerance should be a number, zero or more" };
    // Without one: agreement to about six significant figures.
    const tolerance = tol ?? (value === 0 ? 1e-9 : 1e-6);
    return { kind, value, tolerance, relative: tol === null ? value !== 0 : relative, unit: typeof o.unit === "string" && o.unit ? o.unit : null };
  }
  return { error: `unknown answer kind ${JSON.stringify(kind)}: choice, value or text` };
}

/** Check an answer the dashboard can check: the choices picked (0-based), or
 *  a typed number. Null when it cannot be read (an unparsable number). */
export function checkAnswer(spec: AnswerSpec, input: number[] | string): Result | null {
  if (spec.kind === "choice") {
    const picked = [...new Set(Array.isArray(input) ? input : [])].sort((x, y) => x - y);
    return picked.length === spec.correct.length && picked.every((p, i) => p === spec.correct[i]) ? "got" : "missed";
  }
  if (spec.kind === "value") {
    const n = parseNumber(typeof input === "string" ? input : null);
    if (n === null) return null;
    const allowed = spec.relative ? spec.tolerance * Math.abs(spec.value) : spec.tolerance;
    return Math.abs(n - spec.value) <= allowed * (1 + 1e-12) ? "got" : "missed";
  }
  return null;
}

/** An exercise's body split at its solution: the first heading named
 *  Solution (or Worked solution, Solutions), at any level. */
export function splitSolution(body: string): { problem: string; solution: string | null } {
  const tokens = md.parse(body, {});
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.type !== "heading_open" || !t.map) continue;
    if (/^(?:worked\s+)?solutions?$/i.test(strip(tokens[i + 1]?.content ?? "").trim())) {
      const lines = body.split("\n");
      return { problem: lines.slice(0, t.map[0]).join("\n").replace(/\s+$/, "\n"), solution: lines.slice(t.map[1]).join("\n").trim() + "\n" };
    }
  }
  return { problem: body, solution: null };
}

/** A note id from a link in frontmatter (`/a/b.md`, `b.md` beside the note, or `a/b`). */
export function refId(ref: unknown, dir: string): string | null {
  if (typeof ref !== "string" || !ref.trim()) return null;
  let r = ref.trim().replace(/^<|>$/g, "").replace(/#.*$/, "").replace(/\.md$/, "");
  if (!r) return null;
  if (!r.startsWith("/")) r = (dir ? dir + "/" : "") + r;
  const out: string[] = [];
  for (const part of r.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (!out.length) return null; out.pop(); } else out.push(part);
  }
  return out.length ? out.join("/") : null;
}

export const refIds = (refs: unknown, dir: string): string[] =>
  [...new Set((Array.isArray(refs) ? refs : refs === undefined || refs === null ? [] : [refs]).map((r) => refId(r, dir)).filter((x): x is string => x !== null))];

export type ExerciseStatus = "untried" | "waiting" | "missed" | "partly" | "passed";

export interface Attempt {
  id: string;
  exercise: string;
  at: string;
  answer: string;
  /** How it was settled: there and then (dashboard, self) or by an agent; null while waiting. */
  result: Result | null;
  by: string | null;
  feedback: string | null;
  gaps: string[];
  gaveUp: boolean;
  /** Working shown alongside the answer (Markdown), if any. */
  working: string;
  /** The working was sent for review. */
  review: boolean;
  /** What the dashboard's check said, before any review of the working. */
  checked: Result | null;
  /** Marked after the fact, by an agent or by the developer. */
  marked: boolean;
  /** Written with the teacher alongside: how many hints, feedback and discussions. */
  help: { hint: number; feedback: number; discuss: number } | null;
}

const helpOf = (v: unknown): Attempt["help"] => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>, n = (k: string) => (typeof o[k] === "number" && (o[k] as number) > 0 ? (o[k] as number) : 0);
  const h = { hint: n("hint"), feedback: n("feedback"), discuss: n("discuss") };
  return h.hint + h.feedback + h.discuss ? h : null;
};

/** Waiting for someone to mark it: a written answer not yet marked, or
 *  working sent for review and not yet reviewed. */
export const needsMarking = (a: Attempt): boolean => a.result === null || (a.review && !a.marked);

/** Every attempt at each exercise, oldest first, with its marking if any. */
export function attempts(events: readonly LearnerEvent[]): Map<string, Attempt[]> {
  const out = new Map<string, Attempt[]>();
  const byId = new Map<string, Attempt>();
  for (const e of events) {
    if (e.event === "attempt" && typeof e.id === "string") {
      const ex = str(e.exercise);
      if (!ex) continue;
      const result = (RESULTS as readonly unknown[]).includes(e.result) ? (e.result as Result) : null;
      const working = typeof e.working === "string" ? e.working : "";
      const a: Attempt = { id: e.id, exercise: ex, at: String(e.at ?? ""), answer: typeof e.answer === "string" ? e.answer : "",
        result, by: result ? str(e.by) : null, feedback: null, gaps: [], gaveUp: e.gave_up === true,
        working, review: e.review === true && !!working, checked: result && e.by === "dashboard" ? result : null, marked: false,
        help: helpOf(e.help) };
      byId.set(e.id, a);
      out.set(ex, [...(out.get(ex) ?? []), a]);
    } else if (e.event === "review_requested") {
      const a = byId.get(String(e.ref));
      const working = typeof e.working === "string" ? e.working.trim() : "";
      if (!a || a.marked || (!working && !a.working)) continue;
      if (working) a.working = working;
      a.review = true;
    } else if (e.event === "attempt_marked") {
      const a = byId.get(String(e.ref));
      if (!a || !(RESULTS as readonly unknown[]).includes(e.result)) continue;
      a.marked = true;
      a.result = e.result as Result;
      a.by = str(e.by) ?? "agent";
      a.feedback = str(e.feedback);
      a.gaps = Array.isArray(e.gaps) ? e.gaps.map(String) : [];
    }
  }
  return out;
}

/** Where you stand with one exercise: its latest settled attempt decides, and
 *  a newer one still waiting for marking is said. */
export function exerciseStatus(list: readonly Attempt[] | undefined): ExerciseStatus {
  if (!list?.length) return "untried";
  const last = list[list.length - 1]!;
  if (last.result === null) return "waiting";
  return last.result === "got" ? "passed" : last.result;
}

/** Every note `ids` requires, directly or through others (not the notes themselves). */
export function requiresClosure(ids: Iterable<string>, requires: (id: string) => readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const start = new Set(ids);
  const stack = [...start];
  while (stack.length) {
    for (const r of requires(stack.pop()!) ?? []) if (!seen.has(r)) { seen.add(r); stack.push(r); }
  }
  for (const id of start) seen.delete(id);
  return [...seen];
}

export interface GoalProgress {
  /** The notes the goal needs: what it requires, and everything those require. */
  notes: string[];
  coverage: ReturnType<typeof coverage>;
  exercises: { id: string; status: ExerciseStatus }[];
  /** Met when it has exercises and every one is passed. */
  met: boolean;
}

export function goalProgress(needs: readonly string[], requires: (id: string) => readonly string[] | undefined, exerciseIds: readonly string[],
  states: Map<string, NoteState>, tried: Map<string, Attempt[]>): GoalProgress {
  const notes = [...new Set([...needs, ...requiresClosure(needs, requires)])].filter((id) => states.has(id));
  const exercises = exerciseIds.map((id) => ({ id, status: exerciseStatus(tried.get(id)) }));
  return { notes, coverage: coverage(states, notes), exercises, met: exercises.length > 0 && exercises.every((e) => e.status === "passed") };
}

// ------------------------------------------------------------------ exercises set for you
// An agent sets a batch of Exercise notes ("Diagnostic: prerequisites"), to be
// answered in the dashboard rather than in the chat. A set is done when every
// exercise in it has been attempted since it was set, or put aside.

export interface Assignment {
  id: string;
  at: string;
  by: string | null;
  note: string;
  exercises: string[];
  /** Exercises attempted since it was set (an answer waiting for marking counts). */
  done: string[];
  closed: boolean;
}

export function assignments(events: readonly LearnerEvent[], tried: Map<string, Attempt[]> = attempts(events)): Assignment[] {
  const closed = new Set(events.filter((e) => e.event === "assigned_closed").map((e) => String(e.ref)));
  const out: Assignment[] = [];
  for (const e of events) {
    if (e.event !== "assigned" || typeof e.id !== "string") continue;
    const exercises = Array.isArray(e.exercises) ? [...new Set(e.exercises.filter((x): x is string => typeof x === "string" && !!x))] : [];
    if (!exercises.length) continue;
    const at = String(e.at ?? "");
    const done = exercises.filter((x) => (tried.get(x) ?? []).some((a) => a.at >= at));
    out.push({ id: e.id, at, by: str(e.by), note: typeof e.note === "string" ? e.note : "", exercises, done, closed: closed.has(e.id) || done.length === exercises.length });
  }
  return out.reverse();
}

// ------------------------------------------------------------------ streaks
// Daily and weekly streaks (design/streaks.md), worked out from the record
// alone. Days are numbered by the caller (local time, starting at 4 a.m.), so
// the rules here are the same on every device.

export const STREAK_KINDS = ["recall", "learning", "problems", "all"] as const;
export type StreakKind = (typeof STREAK_KINDS)[number];
/** done: it counted; rest: nothing was due (recall only); reprieve: missed but
 *  saved by a banked reprieve; missed; open: today, not counted yet. */
export type DayStatus = "done" | "rest" | "reprieve" | "missed" | "open";

export interface Streak {
  kind: StreakKind;
  current: number;
  best: number;
  /** Reprieves banked: one per 7 days kept, at most REPRIEVE_BANK. */
  reprieves: number;
  today: DayStatus;
  weeks: { current: number; best: number; thisWeek: number };
  /** The last `history` days, oldest first. */
  days: { day: number; status: DayStatus }[];
}

export const REPRIEVE_EVERY = 7;
export const REPRIEVE_BANK = 2;
const RECALL_DRILLS = new Set(["recall", "gap"]);

/** Day numbers to weeks starting on Monday (day 0, 1970-01-01, was a Thursday). */
export const weekOf = (day: number): number => Math.floor((day + 3) / 7);

export function streaks(events: readonly LearnerEvent[], notes: Iterable<NoteRef>, now: number,
  { dayOf, dayStart, weekDays = 4, history = 35 }: { dayOf: (ms: number) => number; dayStart: (day: number) => number; weekDays?: number; history?: number }): Record<StreakKind, Streak> {
  const known = new Set([...notes].map((n) => n.id));
  const timed = [...perNote(events)].map((e) => ({ e, ms: Date.parse(str(e.at) ?? "") })).filter((x) => !Number.isNaN(x.ms) && x.ms <= now)
    .sort((a, b) => a.ms - b.ms);
  const today = dayOf(now);
  // From the first day anything was studied (an answer to an exercise naming no notes included).
  const times = events.filter((e) => STUDY.has(String(e.event))).map((e) => Date.parse(str(e.at) ?? "")).filter((ms) => !Number.isNaN(ms) && ms <= now);
  const first = times.length ? Math.min(dayOf(Math.min(...times)), today) : today;

  // A day's work, kind by kind, replaying the review schedule as it was.
  const schedule = new Map<string, number>(); // note -> due (ms)
  const boxes = new Map<string, number>();
  // Problem solving is any real answer, whether or not the exercise names notes.
  const solvedDays = new Set(events.filter((e) => e.event === "attempt" && e.gave_up !== true && !(typeof e.answer === "string" && !e.answer.trim()))
    .map((e) => Date.parse(str(e.at) ?? "")).filter((ms) => !Number.isNaN(ms) && ms <= now).map(dayOf));
  const reached = new Set<string>(); // notes ever worked through or understood
  const status: Record<Exclude<StreakKind, "all">, Map<number, DayStatus>> = { recall: new Map(), learning: new Map(), problems: new Map() };
  let i = 0;
  for (let d = first; d <= today; d++) {
    const start = dayStart(d);
    const required = Math.min(3, [...schedule.values()].filter((due) => due <= start).length);
    const practised = new Set<string>();
    let learnt = false;
    const solved = solvedDays.has(d);
    for (; i < timed.length && dayOf(timed[i]!.ms) === d; i++) {
      const { e, ms } = timed[i]!;
      const id = str(e.concept);
      const inReview = id !== null && schedule.has(id);
      // Practice of a note in review: a recall or gap drill, or an exercise testing it.
      if (inReview && ((e.event === "exercise" && RECALL_DRILLS.has(String(e.exercise))) || e.event === "attempt")) practised.add(id!);
      if (id !== null && known.has(id)) {
        const up = (e.event === "mark" && (e.state === "processed" || e.state === "understood")) || (evidence(e) && e.result === "got");
        if (up && !reached.has(id)) { reached.add(id); learnt = true; }
        // The review schedule, as reviewSchedule keeps it.
        if (e.event === "mark") {
          if (e.state === "processed" || e.state === "understood") { if (!schedule.has(id)) schedule.set(id, ms + DAY); }
          else schedule.delete(id);
        } else if (evidence(e) && (RESULTS as readonly unknown[]).includes(e.result)) {
          const box = boxes.get(id);
          const next = e.result === "got" ? Math.min((box ?? -1) + 1, INTERVALS.length - 1) : e.result === "partly" ? Math.max(box ?? 0, 0) : 0;
          boxes.set(id, next);
          schedule.set(id, ms + INTERVALS[next]! * DAY);
        }
      }
    }
    const open = d === today;
    status.recall.set(d, required === 0 ? "rest" : practised.size >= required ? "done" : open ? "open" : "missed");
    status.learning.set(d, learnt ? "done" : open ? "open" : "missed");
    status.problems.set(d, solved ? "done" : open ? "open" : "missed");
  }

  const kept = (s: DayStatus | undefined) => s === "done" || s === "rest";
  const allDays = new Map<number, DayStatus>();
  for (let d = first; d <= today; d++) {
    const parts = [status.recall.get(d), status.learning.get(d), status.problems.get(d)];
    allDays.set(d, parts.every(kept) ? "done" : d === today ? "open" : "missed");
  }

  const walk = (kind: StreakKind, byDay: Map<number, DayStatus>): Streak => {
    let current = 0, best = 0, bank = 0, run = 0;
    const out = new Map<number, DayStatus>();
    for (let d = first; d <= today; d++) {
      let s = byDay.get(d)!;
      if (kept(s)) {
        current++; run++;
        if (run === REPRIEVE_EVERY) { bank = Math.min(REPRIEVE_BANK, bank + 1); run = 0; }
      } else if (s === "missed") {
        if (bank > 0 && current > 0) { bank--; s = "reprieve"; } else { current = 0; run = 0; bank = 0; }
      }
      best = Math.max(best, current);
      out.set(d, s);
    }
    // Weeks: enough days kept; the week in progress never breaks the streak.
    const thisWeek = weekOf(today);
    let wCurrent = 0, wBest = 0, daysThisWeek = 0;
    for (let w = weekOf(first); w <= thisWeek; w++) {
      let n = 0;
      for (let d = Math.max(first, w * 7 - 3); d <= Math.min(today, w * 7 + 3); d++) if (kept(byDay.get(d))) n++;
      if (w === thisWeek) { daysThisWeek = n; if (n >= weekDays) wCurrent++; }
      else if (n >= weekDays) wCurrent++;
      else wCurrent = 0;
      wBest = Math.max(wBest, wCurrent);
    }
    const days: { day: number; status: DayStatus }[] = [];
    for (let d = today - history + 1; d <= today; d++) if (d >= first) days.push({ day: d, status: out.get(d)! });
    return { kind, current, best, reprieves: bank, today: out.get(today)!, weeks: { current: wCurrent, best: wBest, thisWeek: daysThisWeek }, days };
  };
  return {
    recall: walk("recall", status.recall),
    learning: walk("learning", status.learning),
    problems: walk("problems", status.problems),
    all: walk("all", allDays),
  };
}
