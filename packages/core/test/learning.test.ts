import { expect, test } from "vitest";
import { coverage, discoveryStates, dueReviews, loadNote, reviewSchedule, studyLoad, tourBody, tourStops, type LearnerEvent } from "../src/index.ts";

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
  ];
  const s = discoveryStates(events, notes);
  expect(s.get("a")).toMatchObject({ state: "understood", kind: "autodidactic", changed: false });
  expect(s.get("b")).toMatchObject({ state: "processed", changed: true }); // processed on an older version
  expect(s.get("c")).toMatchObject({ state: "understood", kind: "interactive" });
  expect(s.has("gone")).toBe(false);
  const down = discoveryStates([...events, ev("mark", { concept: "a", hash: "h1", state: "discovered" })], notes);
  expect(down.get("a")!.state).toBe("discovered");
  expect(coverage(s, ["a", "b", "c"])).toEqual({ undiscovered: 0, discovered: 0, processed: 1, understood: 2, total: 3 });
});

test("spaced review: boxes move with results; the queue is capped", () => {
  const day = 86_400_000, t0 = Date.parse("2026-10-01T10:00:00Z");
  const iso = (d: number) => new Date(t0 + d * day).toISOString();
  const events = [
    ev("mark", { concept: "a", state: "processed" }, iso(0)),
    ev("exercise", { concept: "b", result: "got" }, iso(0)),
    ev("exercise", { concept: "b", result: "got" }, iso(1)),
    ev("exercise", { concept: "c", result: "got" }, iso(0)),
    ev("exercise", { concept: "c", result: "missed" }, iso(2)),
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
