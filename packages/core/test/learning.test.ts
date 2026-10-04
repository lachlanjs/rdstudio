import { describe, expect, test } from "vitest";
import {
  answerSpec, assignments, attempts, checkAnswer, coverage, discoveryStates, dueReviews, exerciseStatus, goalProgress, isStudyNote, loadNote, needsMarking, parseNumber, refId, refIds, requiresClosure,
  reviewSchedule, splitSolution, streaks, studyLoad, weekOf, tourBody, tourStops, type AnswerSpec, type LearnerEvent,
} from "../src/index.ts";

const DAY = 86_400_000;

let n = 0;
const ev = (event: string, rest: Record<string, unknown>, at = "2026-10-01T10:00:00Z"): LearnerEvent => ({ id: String(n++).padStart(26, "0"), at, event, ...rest });
const notes = [{ id: "a", hash: "h1" }, { id: "b", hash: "h2" }, { id: "c", hash: "h3" }];

test("discovery: opening discovers, marking sets the state up or down, evidence makes it understood", () => {
  const events = [
    ev("seen", { concept: "a", hash: "h1" }),
    ev("mark", { concept: "a", hash: "h1", state: "understood" }),
    ev("seen", { concept: "a", hash: "h1" }), // opening again does not lower it
    ev("seen", { concept: "b", hash: "old" }),
    ev("mark", { concept: "b", hash: "old", state: "processed" }),
    ev("exercise", { concept: "c", hash: "h3", result: "got", exercise: "recall" }),
    ev("seen", { concept: "gone", hash: "x" }),
    ev("exercise", { concept: "a", hash: "h1", result: "got", exercise: "placement" }), // practice, not evidence
  ];
  const s = discoveryStates(events, notes);
  expect(s.get("a")).toMatchObject({ state: "understood", kind: "autodidactic", changed: false });
  expect(s.get("b")).toMatchObject({ state: "processed", changed: true }); // processed on an older version
  expect(s.get("c")).toMatchObject({ state: "understood", kind: "interactive" });
  expect(s.has("gone")).toBe(false);
  const down = discoveryStates([...events, ev("mark", { concept: "a", hash: "h1", state: "discovered" })], notes);
  expect(down.get("a")!.state).toBe("discovered");
  const placed = discoveryStates([ev("exercise", { concept: "b", hash: "h2", result: "got", exercise: "placement" })], notes);
  expect(placed.get("b")!.state).toBe("discovered");
  expect(coverage(s, ["a", "b", "c"])).toEqual({ undiscovered: 0, discovered: 0, processed: 1, understood: 2, total: 3 });
});

test("spaced review: boxes move with results; the queue is capped", () => {
  const day = 86_400_000, t0 = Date.parse("2026-10-01T10:00:00Z");
  const iso = (d: number) => new Date(t0 + d * day).toISOString();
  const events = [
    ev("mark", { concept: "a", state: "processed" }, iso(0)),
    ev("exercise", { concept: "b", result: "got", exercise: "recall" }, iso(0)),
    ev("exercise", { concept: "b", result: "got", exercise: "gap" }, iso(1)),
    ev("exercise", { concept: "c", result: "got", exercise: "recall" }, iso(0)),
    ev("exercise", { concept: "c", result: "missed", exercise: "recall" }, iso(2)),
    ev("exercise", { concept: "c", result: "got", exercise: "placement" }, iso(2)),
  ];
  const s = reviewSchedule(events, notes);
  expect(s.get("a")).toMatchObject({ box: 0, due: t0 + day });
  expect(s.get("b")).toMatchObject({ box: 1, due: t0 + 4 * day }); // got twice: box 1, three days
  expect(s.get("c")).toMatchObject({ box: 0, due: t0 + 3 * day });
  expect(dueReviews(s, t0 + 3 * day).due.map((r) => r.id)).toEqual(["a", "c"]);
  expect(dueReviews(s, t0 + 10 * day, 2)).toMatchObject({ more: 1 });
  const out = reviewSchedule([...events, ev("mark", { concept: "a", state: "discovered" }, iso(1))], notes);
  expect(out.has("a")).toBe(false);
});

test("load: today's notes against the usual day, said only when well above it", () => {
  const day = 86_400_000, now = Date.parse("2026-10-20T18:00:00Z");
  const events: LearnerEvent[] = [];
  for (let d = 1; d <= 6; d++) for (let i = 0; i < 4; i++) events.push(ev("seen", { concept: `n${d}-${i}` }, new Date(now - d * day).toISOString()));
  for (let i = 0; i < 12; i++) events.push(ev("seen", { concept: `t${i}` }, new Date(now - 1000 * i).toISOString()));
  const load = studyLoad(events, now, (ms) => new Date(ms).toISOString().slice(0, 10));
  expect(load).toEqual({ today: 12, usual: 4 });
  expect(loadNote(load)).toMatch(/^12 notes today against your usual 4/);
  expect(loadNote({ today: 6, usual: 4 })).toBeNull();
  expect(loadNote({ today: 12, usual: null })).toBeNull();
});

test("tours: each outer list item's first link is a stop, the rest its narration", () => {
  const body = `Intro with a [link](/x.md) that is not a stop.

1. [Smooth manifold](/manifolds/smooth-manifold.md): where it starts.
2. [Tangent *space*](tangent-space.md "requires") — vectors at a point,
   on two lines.
   - [nested](/n.md) is not a stop
3. No link here.
4. Then see [Forms](/forms/differential-forms.md) for more.
`;
  expect(tourStops(body)).toEqual([
    { href: "/manifolds/smooth-manifold.md", label: "Smooth manifold", text: "where it starts." },
    { href: "tangent-space.md", label: "Tangent space", text: "vectors at a point,\non two lines." },
    { href: "/forms/differential-forms.md", label: "Forms", text: "Then see [Forms](/forms/differential-forms.md) for more." },
  ]);
  const written = tourBody([{ title: "A [b]", href: "/a.md", text: "first\nstop" }, { title: "C", href: "/c.md", text: "" }], "Why.");
  expect(written).toBe("Why.\n\n1. [A \\[b\\]](/a.md): first stop\n2. [C](/c.md)\n");
  expect(tourStops(written).map((s) => [s.label, s.text])).toEqual([["A [b]", "first stop"], ["C", ""]]);
});

// ------------------------------------------------------------------ exercises and goals (T44)

test("numbers are read as people type them", () => {
  expect(parseNumber("0.5")).toBe(0.5);
  expect(parseNumber(" 1/2 ")).toBe(0.5);
  expect(parseNumber("−3")).toBe(-3);
  expect(parseNumber("2×10^3")).toBe(2000);
  expect(parseNumber("1.5e-3")).toBe(0.0015);
  expect(parseNumber("1 000")).toBe(1000);
  expect(parseNumber(".25")).toBe(0.25);
  expect(parseNumber(7)).toBe(7);
  for (const bad of ["", "abc", "1/0", "1/2/3", "1,5", "--1", null, Number.NaN]) expect(parseNumber(bad)).toBeNull();
});

test("an exercise's answer is read from its frontmatter, with what is wrong said", () => {
  expect(answerSpec({})).toEqual({ kind: "text" });
  expect(answerSpec({ answer: { kind: "text" } })).toEqual({ kind: "text" });
  expect(answerSpec({ answer: { kind: "choice", choices: ["a", "b", "c"], correct: 2 } })).toEqual({ kind: "choice", choices: ["a", "b", "c"], correct: [1], multiple: false });
  expect(answerSpec({ answer: { kind: "choice", choices: ["a", "b", "c"], correct: [3, 1] } })).toMatchObject({ correct: [0, 2], multiple: true });
  expect(answerSpec({ answer: { kind: "choice", choices: ["a", "b"], correct: 3 } })).toEqual({ error: "correct should be the number of the right choice, 1 to 2" });
  expect(answerSpec({ answer: { kind: "choice", choices: ["a"], correct: 1 } })).toMatchObject({ error: expect.stringMatching(/two choices/) });
  expect(answerSpec({ answer: { kind: "value", value: "1/4" } })).toEqual({ kind: "value", value: 0.25, tolerance: 1e-6, relative: true, unit: null });
  expect(answerSpec({ answer: { kind: "value", value: 0 } })).toEqual({ kind: "value", value: 0, tolerance: 1e-9, relative: false, unit: null });
  expect(answerSpec({ answer: { kind: "value", value: 2, tolerance: 0.1, unit: "s" } })).toEqual({ kind: "value", value: 2, tolerance: 0.1, relative: false, unit: "s" });
  expect(answerSpec({ answer: { kind: "value", value: 2, tolerance: -1 } })).toMatchObject({ error: expect.stringMatching(/tolerance/) });
  expect(answerSpec({ answer: { kind: "value" } })).toMatchObject({ error: expect.stringMatching(/needs a number/) });
  expect(answerSpec({ answer: { kind: "essay" } })).toMatchObject({ error: expect.stringMatching(/unknown answer kind "essay"/) });
  expect(answerSpec({ answer: "42" })).toMatchObject({ error: expect.stringMatching(/should be a table/) });
});

test("choices and values are checked; text is not", () => {
  const one = answerSpec({ answer: { kind: "choice", choices: ["a", "b", "c"], correct: 2 } }) as AnswerSpec;
  expect(checkAnswer(one, [1])).toBe("got");
  expect(checkAnswer(one, [0])).toBe("missed");
  expect(checkAnswer(one, [1, 2])).toBe("missed");
  const many = answerSpec({ answer: { kind: "choice", choices: ["a", "b", "c"], correct: [1, 3] } }) as AnswerSpec;
  expect(checkAnswer(many, [2, 0])).toBe("got");
  expect(checkAnswer(many, [0])).toBe("missed");
  const rel = answerSpec({ answer: { kind: "value", value: 1000, tolerance: 0.01, relative: true } }) as AnswerSpec;
  expect(checkAnswer(rel, "1009")).toBe("got");
  expect(checkAnswer(rel, "1011")).toBe("missed");
  expect(checkAnswer(rel, "about a thousand")).toBeNull();
  const abs = answerSpec({ answer: { kind: "value", value: 0.5, tolerance: 0.1 } }) as AnswerSpec;
  expect(checkAnswer(abs, "0.6")).toBe("got");
  expect(checkAnswer(abs, "1/2")).toBe("got");
  expect(checkAnswer(abs, "0.61")).toBe("missed");
  expect(checkAnswer({ kind: "text" }, "anything")).toBeNull();
});

test("an exercise's solution is split off at its heading", () => {
  const body = "Find $x$.\n\n```md\n# Solution\n```\n\n## Worked solution\n\nIt is $2$.\n\n# Notes\n\nMore.\n";
  expect(splitSolution(body)).toEqual({ problem: "Find $x$.\n\n```md\n# Solution\n```\n", solution: "It is $2$.\n\n# Notes\n\nMore.\n" });
  expect(splitSolution("No solution here.\n")).toEqual({ problem: "No solution here.\n", solution: null });
});

test("links in frontmatter become note ids", () => {
  expect(refId("/dmft/cavity.md", "exercises")).toBe("dmft/cavity");
  expect(refId("cavity.md", "dmft")).toBe("dmft/cavity");
  expect(refId("../dmft/cavity.md#eq-3", "exercises/one")).toBe("exercises/dmft/cavity");
  expect(refId("../../x.md", "a")).toBeNull();
  expect(refId(3, "")).toBeNull();
  expect(refIds(["/a.md", "/a.md", "b"], "d")).toEqual(["a", "d/b"]);
  expect(refIds("/a.md", "")).toEqual(["a"]);
});

test("an attempt is evidence for every note it tests, settled there and then or by an agent later", () => {
  const notes = [{ id: "a", hash: "ha" }, { id: "b", hash: "hb" }, { id: "c", hash: "hc" }];
  const t = (d: number) => new Date(Date.UTC(2026, 9, d)).toISOString();
  const events = [
    { id: "1", event: "attempt", exercise: "ex/one", tests: ["a", "b"], hashes: { a: "ha", b: "old" }, answer: "0.5", result: "got", by: "dashboard", at: t(1) },
    { id: "2", event: "attempt", exercise: "ex/two", tests: ["c"], hashes: { c: "hc" }, answer: "Because…", at: t(2) },
  ];
  let states = discoveryStates(events, notes);
  expect(states.get("a")).toMatchObject({ state: "understood", kind: "interactive", changed: false });
  expect(states.get("b")).toMatchObject({ state: "understood", changed: true });
  expect(states.get("c")).toMatchObject({ state: "discovered" }); // waiting for marking
  const marked = [...events, { id: "3", event: "attempt_marked", ref: "2", result: "got", feedback: "Right.", by: "agent/x", at: t(3) }];
  states = discoveryStates(marked, notes);
  expect(states.get("c")).toMatchObject({ state: "understood", kind: "ai", hash: "hc" });
  const schedule = reviewSchedule(marked, notes);
  expect(schedule.get("a")).toMatchObject({ box: 0, due: Date.parse(t(1)) + DAY });
  expect(schedule.get("c")).toMatchObject({ box: 0, due: Date.parse(t(3)) + DAY });
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  expect(studyLoad(marked, Date.parse(t(2)) + 1000, day).today).toBe(1); // the attempt; a marking is not your study
  expect(studyLoad(marked, Date.parse(t(3)) + 1000, day).today).toBe(0);

  const tried = attempts(marked);
  expect(tried.get("ex/two")).toEqual([{ id: "2", exercise: "ex/two", at: t(2), answer: "Because…", result: "got", by: "agent/x", feedback: "Right.", gaps: [], gaveUp: false,
    working: "", review: false, checked: null, marked: true }]);
  expect(exerciseStatus(tried.get("ex/one"))).toBe("passed");
  expect(exerciseStatus(attempts(events).get("ex/two"))).toBe("waiting");
  expect(exerciseStatus(undefined)).toBe("untried");
  const later = attempts([...marked, { id: "4", event: "attempt", exercise: "ex/one", tests: ["a"], answer: "", result: "missed", by: "self", gave_up: true, at: t(4) }]);
  expect(exerciseStatus(later.get("ex/one"))).toBe("missed");
  expect(later.get("ex/one")!.at(-1)).toMatchObject({ gaveUp: true, by: "self" });
});

test("a goal's progress: the notes it needs, through requires, and its exercises", () => {
  const req: Record<string, string[]> = { goal: ["c"], c: ["b"], b: ["a"], a: [] };
  expect(requiresClosure(["c"], (id) => req[id]).sort()).toEqual(["a", "b"]);
  expect(requiresClosure(["a", "b"], (id) => req[id])).toEqual([]);
  const notes = ["a", "b", "c"].map((id) => ({ id, hash: "h" }));
  const events = [{ id: "1", event: "mark", concept: "a", state: "understood", at: "2026-10-01T00:00:00Z" },
    { id: "2", event: "attempt", exercise: "ex", tests: ["c"], result: "got", by: "self", at: "2026-10-01T00:00:00Z" }];
  const states = discoveryStates(events, notes);
  const p = goalProgress(["c"], (id) => req[id], ["ex", "ex2"], states, attempts(events));
  expect(p.notes.sort()).toEqual(["a", "b", "c"]);
  expect(p.coverage).toMatchObject({ understood: 2, undiscovered: 1, total: 3 });
  expect(p.exercises).toEqual([{ id: "ex", status: "passed" }, { id: "ex2", status: "untried" }]);
  expect(p.met).toBe(false);
  expect(goalProgress(["c"], (id) => req[id], ["ex"], states, attempts(events)).met).toBe(true);
  expect(goalProgress(["c"], (id) => req[id], [], states, attempts(events)).met).toBe(false);
});

test("tours, goals and exercises are kept off the map", () => {
  expect(["Tour", "Goal", "Exercise", "Definition"].map((type) => isStudyNote({ type }))).toEqual([false, false, false, true]);
});

test("exercises set by an agent: done when each is attempted since, or put aside", () => {
  const t = (h: number) => `2026-10-02T${String(h).padStart(2, "0")}:00:00.000Z`;
  const events = [
    { id: "0", event: "attempt", exercise: "x/a", tests: [], result: "got", by: "dashboard", at: t(1) }, // before it was set: not counted
    { id: "1", event: "assigned", exercises: ["x/a", "x/b", "x/a"], note: "Diagnostic", by: "agent/t", at: t(2) },
    { id: "2", event: "attempt", exercise: "x/b", tests: [], answer: "…", at: t(3) }, // waiting for marking: counts
    { id: "3", event: "assigned", exercises: ["x/c"], note: "Later", at: t(4) },
    { id: "4", event: "assigned", exercises: [], at: t(5) },
  ];
  expect(assignments(events)).toEqual([
    { id: "3", at: t(4), by: null, note: "Later", exercises: ["x/c"], done: [], closed: false },
    { id: "1", at: t(2), by: "agent/t", note: "Diagnostic", exercises: ["x/a", "x/b"], done: ["x/b"], closed: false },
  ]);
  const more = [...events, { id: "5", event: "attempt", exercise: "x/a", tests: [], result: "missed", by: "self", at: t(6) }, { id: "6", event: "assigned_closed", ref: "3", at: t(7) }];
  expect(assignments(more).map((a) => [a.id, a.closed, a.done])).toEqual([["3", true, []], ["1", true, ["x/a", "x/b"]]]);
});

test("working behind a checked answer: sent for review, it replaces the check, up or down", () => {
  const notes = [{ id: "a", hash: "h" }];
  const t = (h: number) => `2026-10-03T${String(h).padStart(2, "0")}:00:00.000Z`;
  // A right answer, working sent with it: counts as checked until reviewed.
  const lucky = [{ id: "1", event: "attempt", exercise: "ex", tests: ["a"], answer: "4", result: "got", by: "dashboard", working: "Guessed.", review: true, at: t(1) }];
  let a = attempts(lucky).get("ex")![0]!;
  expect(a).toMatchObject({ result: "got", checked: "got", working: "Guessed.", review: true, marked: false });
  expect(needsMarking(a)).toBe(true);
  expect(discoveryStates(lucky, notes).get("a")!.state).toBe("understood");
  // The review finds a lucky guess: lowered, and no longer evidence of understanding.
  const reviewed = [...lucky, { id: "2", event: "attempt_marked", ref: "1", result: "partly", feedback: "Right number, no argument.", by: "agent/x", at: t(2) }];
  a = attempts(reviewed).get("ex")![0]!;
  expect(a).toMatchObject({ result: "partly", checked: "got", by: "agent/x", marked: true });
  expect(needsMarking(a)).toBe(false);
  expect(exerciseStatus([a])).toBe("partly");
  expect(discoveryStates(reviewed, notes).get("a")!.state).toBe("discovered");
  expect(reviewSchedule(reviewed, notes).get("a")).toMatchObject({ box: 0, last: t(2) });

  // A wrong answer, working sent afterwards: a slip, raised to partly.
  const slip = [{ id: "3", event: "attempt", exercise: "ex", tests: ["a"], answer: "5", result: "missed", by: "dashboard", at: t(3) },
    { id: "4", event: "review_requested", ref: "3", working: "Var = 4·100/100 = 5 (added wrong).", at: t(4) }];
  a = attempts(slip).get("ex")![0]!;
  expect(a).toMatchObject({ result: "missed", review: true, working: "Var = 4·100/100 = 5 (added wrong)." });
  expect(needsMarking(a)).toBe(true);
  const raised = attempts([...slip, { id: "5", event: "attempt_marked", ref: "3", result: "partly", feedback: "Sound method; an arithmetic slip.", by: "self", at: t(5) }]).get("ex")![0]!;
  expect(raised).toMatchObject({ result: "partly", checked: "missed", by: "self" });
  // A request with no working, or after marking, changes nothing.
  expect(attempts([slip[0]!, { id: "6", event: "review_requested", ref: "3", working: " ", at: t(6) }]).get("ex")![0]!.review).toBe(false);
  // Working without asking for review is kept, but nothing waits.
  const kept = attempts([{ id: "7", event: "attempt", exercise: "ex", tests: [], answer: "4", result: "got", by: "dashboard", working: "4·100/100", at: t(7) }]).get("ex")![0]!;
  expect([kept.working, kept.review, needsMarking(kept)]).toEqual(["4·100/100", false, false]);
});

// ------------------------------------------------------------------ streaks (T48)

describe("streaks", () => {
  const H = 3_600_000;
  // Day d runs from 04:00 UTC on day d to 04:00 on d + 1.
  const opts = { dayOf: (ms: number) => Math.floor((ms - 4 * H) / DAY), dayStart: (d: number) => d * DAY + 4 * H };
  const at = (d: number, h = 12) => new Date(d * DAY + h * H).toISOString();
  const D0 = 20_000;
  const notes = [{ id: "a", hash: "h" }, { id: "b", hash: "h" }, { id: "c", hash: "h" }];
  let k = 0;
  const e = (d: number, event: string, rest: Record<string, unknown> = {}, h = 12) => ({ id: String(k++), at: at(d, h), event, ...rest });
  const solve = (d: number) => e(d, "attempt", { exercise: "x", tests: [], answer: "1", result: "got", by: "dashboard" });
  const run = (events: Record<string, unknown>[], today: number, more = {}) => streaks(events, notes, Date.parse(at(today, 20)), { ...opts, ...more });

  test("a day counts by its 4 a.m. boundary; today is open until it counts", () => {
    const late = [e(D0, "attempt", { exercise: "x", tests: [], answer: "1" }, 27)]; // 03:00 the next morning still counts for D0
    expect(run(late, D0 + 1).problems).toMatchObject({ current: 1, today: "open", days: [{ day: D0, status: "done" }, { day: D0 + 1, status: "open" }] });
    expect(run([solve(D0), solve(D0 + 1)], D0 + 1).problems).toMatchObject({ current: 2, best: 2, today: "done" });
    // A give-up, or an empty answer, is not problem solving.
    expect(run([e(D0, "attempt", { exercise: "x", tests: [], answer: "", gave_up: true, result: "missed" })], D0).problems.today).toBe("open");
  });

  test("a missed day ends a streak, unless a reprieve was earned by seven days kept", () => {
    const six = [0, 1, 2, 3, 4, 5].map((d) => solve(D0 + d));
    expect(run([...six, solve(D0 + 7)], D0 + 7).problems).toMatchObject({ current: 1, best: 6, reprieves: 0 });
    const seven = [...six, solve(D0 + 6)];
    const saved = run([...seven, solve(D0 + 8), solve(D0 + 9)], D0 + 9).problems;
    expect(saved).toMatchObject({ current: 9, best: 9, reprieves: 0 });
    expect(saved.days.find((x) => x.day === D0 + 7)!.status).toBe("reprieve");
    // With none left, the next miss ends it.
    expect(run([...seven, solve(D0 + 8), solve(D0 + 10)], D0 + 10).problems).toMatchObject({ current: 1, best: 8 });
    // Banked up to two.
    const long = Array.from({ length: 21 }, (_, d) => solve(D0 + d));
    expect(run(long, D0 + 20).problems.reprieves).toBe(2);
  });

  test("new learning is a note first worked through or understood", () => {
    const events = [e(D0, "mark", { concept: "a", state: "processed" }), e(D0 + 1, "mark", { concept: "a", state: "understood" }),
      e(D0 + 2, "exercise", { exercise: "gap", concept: "b", result: "got" }), e(D0 + 2, "mark", { concept: "zzz", state: "understood" })];
    expect(run(events, D0 + 2).learning.days.map((x) => x.status)).toEqual(["done", "missed", "done"]);
  });

  test("recall: rest when nothing is due, else practise what is due (up to three)", () => {
    const events = [
      e(D0, "mark", { concept: "a", state: "understood" }, 12), // due at noon on D0 + 1: not due at that day's start
      e(D0 + 2, "exercise", { exercise: "recall", concept: "a", result: "got" }),
      e(D0 + 4, "exercise", { exercise: "placement", concept: "a", result: "got" }), // placement is not recall
    ];
    const r = run(events, D0 + 4).recall;
    // D0 nothing due; D0 + 1 rest (due only at noon); D0 + 2 due and practised; D0 + 3 rest (due again at
    // noon); D0 + 4 due, and a placement drill does not count, so still open.
    expect(r.days.map((x) => x.status)).toEqual(["rest", "rest", "done", "rest", "open"]);
    const missed = run([events[0]!], D0 + 3).recall;
    expect(missed.days.map((x) => x.status)).toEqual(["rest", "rest", "missed", "open"]);
    // An exercise testing a note in review counts as practising it.
    const viaExercise = run([events[0]!, e(D0 + 2, "attempt", { exercise: "x", tests: ["a"], answer: "1", result: "missed", by: "dashboard" })], D0 + 2).recall;
    expect(viaExercise.today).toBe("done");
  });

  test("all three: the same day; recall's rest days count", () => {
    const events = [e(D0, "mark", { concept: "a", state: "processed" }), solve(D0), solve(D0 + 1)];
    expect(run(events, D0 + 1).all.days.map((x) => x.status)).toEqual(["done", "open"]);
  });

  test("weeks count with enough days kept; the week in progress never breaks the streak", () => {
    const mon = 20_000 - ((20_000 + 3) % 7); // a Monday: weekOf changes there
    expect(weekOf(mon)).toBe(weekOf(mon - 1) + 1);
    const days = [0, 1, 2, 3, 7, 8, 9, 14].map((d) => solve(mon + d));
    const w = run(days, mon + 15).problems.weeks;
    expect(w).toEqual({ current: 0, best: 1, thisWeek: 1 }); // week 2 had 3 days: broken; week 3 in progress
    const w2 = run([...days, solve(mon + 10)], mon + 15, { weekDays: 4 }).problems.weeks;
    expect(w2).toEqual({ current: 2, best: 2, thisWeek: 1 });
    expect(run(days, mon + 15, { weekDays: 3 }).problems.weeks).toMatchObject({ current: 2, best: 2 });
  });
});
