// The classifier rules (and the port of Python's difflib under them) against
// fixtures/expected/classify.json, recorded from Python and kept as it is.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { editSignificance, matchStep, opcodes } from "../src/index.ts";

const want = JSON.parse(readFileSync(fileURLToPath(new URL("../../../fixtures/expected/classify.json", import.meta.url)), "utf8"));

test("difflib opcodes", () => {
  for (const d of want.difflib) expect(opcodes(d.a, d.b)).toEqual(d.opcodes);
});

test("edit significance", () => {
  for (const s of want.significance) {
    expect(editSignificance(s.before, s.after)).toEqual({ choice: s.choice, confidence: s.confidence, backend: s.backend });
  }
});

test("procedure step matching", () => {
  for (const m of want.match) {
    expect(matchStep(m.description, want.steps)).toEqual({ choice: m.choice, confidence: m.confidence, backend: m.backend });
  }
});
