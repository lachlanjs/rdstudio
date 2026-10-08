// Conformance fixtures: what an OKF implementation must compute for each bundle
// in fixtures/bundles/, recorded in fixtures/expected/.
//
//   node fixtures/expected.ts            # check the core against them
//   node fixtures/expected.ts --update   # record them again (review the diff)
//
// classify.json is not written here: its cases came from Python's difflib,
// which the core's opcodes() is a port of, and it stays as recorded.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mergeRecords, readRecord } from "../packages/core/src/index.ts";
import { loadBundle } from "../packages/core/src/node.ts";
import { snapshot } from "../packages/core/test/snapshot.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const QUERIES = JSON.parse(readFileSync(HERE + "queries.json", "utf8")) as Record<string, string[]>;

// Keys by code point, as the files were first written.
const byCodePoint = (a: string, b: string): number => {
  const x = [...a], y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i]!.codePointAt(0)! - y[i]!.codePointAt(0)!;
    if (d) return d;
  }
  return x.length - y.length;
};
const sorted = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort(byCodePoint).map((k) => [k, sorted((v as Record<string, unknown>)[k])]));
  return v;
};
const dump = (v: unknown): string => JSON.stringify(sorted(v), null, 1) + "\n";

function learner(): unknown {
  const files = readdirSync(HERE + "learner").filter((f) => f.endsWith(".jsonl")).sort();
  const read = Object.fromEntries(files.map((f) => [f, readRecord(readFileSync(`${HERE}learner/${f}`, "utf8"))]));
  return { format: 1, read, merged: mergeRecords(...Object.values(read)) };
}

const update = process.argv.includes("--update");
const names = readdirSync(HERE + "bundles", { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
const all: [string, unknown][] = [...names.map((n): [string, unknown] => [n, snapshot(loadBundle(`${HERE}bundles/${n}`), QUERIES[n] ?? [])]), ["learner", learner()]];
let differ = 0;
for (const [name, value] of all) {
  const path = `${HERE}expected/${name}.json`, text = dump(value);
  if (update) { writeFileSync(path, text); console.log(`wrote expected/${name}.json`); continue; }
  // Compared as values: a whole number may be written 1.0 in a file recorded by Python.
  const same = dump(JSON.parse(readFileSync(path, "utf8"))) === text;
  console.log(`${same ? "ok    " : "DIFFER"} expected/${name}.json`);
  if (!same) differ++;
}
if (differ) { console.log("node fixtures/expected.ts --update records them again; review the diff."); process.exit(1); }
