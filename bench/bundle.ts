// What bench/run.py and tests/test_bench.py need to know about a project,
// as one line of JSON: node bench/bundle.ts <project folder> [--build]
//
// Counts and the time to load the bundle; with --build, the time to build the
// site as well. Lint errors, requires cycles, the ratings in use and broken
// links, for checking a generated bundle.

import { loadBundle } from "../packages/core/src/node.ts";
import { build } from "../packages/cli/src/build.ts";
import { loadConfig } from "../packages/cli/src/config.ts";

const [root, ...flags] = process.argv.slice(2);
if (!root) { console.error("usage: node bench/bundle.ts <project folder> [--build]"); process.exit(2); }
const cfg = loadConfig(root);
const r1 = (ms: number): number => Math.round(ms * 10) / 10;

let t = performance.now();
const bundle = loadBundle(cfg.knowledgeDir);
const loadMs = performance.now() - t;
const links = [...bundle.concepts.values()].flatMap((c) => c.links);
const out: Record<string, unknown> = {
  notes: bundle.concepts.size,
  links: links.length,
  load_ms: r1(loadMs),
  errors: bundle.lint().filter((i) => i.level === "error").length,
  cycles: bundle.requiresCycles().length,
  ratings: [...new Set(links.map((l) => l.rel).filter(Boolean))].sort(),
  broken: links.filter((l) => l.broken).length,
};
if (flags.includes("--build")) {
  t = performance.now();
  build(cfg);
  out.build_ms = r1(performance.now() - t);
}
console.log(JSON.stringify(out));
