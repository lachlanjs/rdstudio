// The core against the conformance fixtures (fixtures/README.md), part by part.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { mergeRecords, readRecord } from "../src/index.ts";
import { loadBundle } from "../src/node.ts";
import { snapshot } from "./snapshot.ts";

const FIXTURES = fileURLToPath(new URL("../../../fixtures/", import.meta.url));
const names = readdirSync(FIXTURES + "bundles").sort();

// Parts not ported yet, with the task that ports them.
const PENDING = new Set<string>();
const QUERIES = JSON.parse(readFileSync(FIXTURES + "queries.json", "utf8")) as Record<string, string[]>;

describe.each(names)("%s", (name) => {
  const want = JSON.parse(readFileSync(`${FIXTURES}expected/${name}.json`, "utf8")) as Record<string, unknown>;
  const got = snapshot(loadBundle(`${FIXTURES}bundles/${name}`), QUERIES[name] ?? []);
  for (const part of Object.keys(want).filter((k) => !PENDING.has(k))) {
    if (part === "concepts") {
      // One test per note, so a failure names it.
      const wantConcepts = want.concepts as Record<string, unknown>;
      test("the same notes", () => expect(Object.keys(got.concepts as object).sort()).toEqual(Object.keys(wantConcepts).sort()));
      for (const cid of Object.keys(wantConcepts)) {
        test(`note ${cid}`, () => expect((got.concepts as Record<string, unknown>)[cid]).toEqual(wantConcepts[cid]));
      }
    } else {
      test(part, () => expect(got[part]).toEqual(want[part]));
    }
  }
});

describe("learner records", () => {
  const want = JSON.parse(readFileSync(`${FIXTURES}expected/learner.json`, "utf8"));
  const files = readdirSync(FIXTURES + "learner").filter((f) => f.endsWith(".jsonl")).sort();
  const read = Object.fromEntries(files.map((f) => [f, readRecord(readFileSync(`${FIXTURES}learner/${f}`, "utf8"))]));
  test.each(files)("%s is read the same", (f) => expect(read[f]).toEqual(want.read[f]));
  test("merged the same", () => expect(mergeRecords(...Object.values(read))).toEqual(want.merged));
});
