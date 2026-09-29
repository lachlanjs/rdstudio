import { expect, test } from "vitest";
import { ID_RE, LearnerError, cleanEvent, mergeRecords, newId, readRecord } from "../src/index.ts";

test("ids sort in the order they are made, even within a millisecond", () => {
  const ids = [newId(1000), newId(1000), newId(1000), newId(1001)];
  expect(ids.every((id) => ID_RE.test(id))).toBe(true);
  expect([...ids].sort()).toEqual(ids);
});

test("events are checked and stamped; ids made offline are kept", () => {
  const e = cleanEvent({ event: "seen", concept: "a", at: "forged" }, { device: "laptop1", now: Date.UTC(2026, 8, 29) });
  expect(e).toMatchObject({ event: "seen", concept: "a", at: "2026-09-29T00:00:00Z", device: "laptop1" });
  expect(ID_RE.test(e.id)).toBe(true);
  const offline = newId();
  expect(cleanEvent({ event: "seen", id: offline, device: "phone1" }, { device: "laptop1" })).toMatchObject({ id: offline, device: "phone1" });
  for (const bad of [null, [], { concept: "a" }, { event: "x", kind: "vibes" }, { event: "x", id: "nope" }, { event: "x", device: "Not Valid" }, { event: "x", big: "y".repeat(70000) }]) {
    expect(() => cleanEvent(bad, { device: "laptop1" })).toThrow(LearnerError);
  }
});

test("merging is a union by id, the same in any order", () => {
  const a = readRecord([cleanEvent({ event: "seen" }, { device: "aaaa" }), cleanEvent({ event: "seen" }, { device: "aaaa" })].map((e) => JSON.stringify(e)).join("\n"));
  const b = [a[1]!, cleanEvent({ event: "attempt" }, { device: "bbbb" })];
  const m = mergeRecords(a, b);
  expect(m).toHaveLength(3);
  expect(mergeRecords(b, a)).toEqual(m);
  expect(mergeRecords(m, a, b)).toEqual(m);
});
