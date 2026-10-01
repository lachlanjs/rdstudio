// The core's link graph against the copies the dashboard's map view still
// carries (pagerank, impliedLinks, stronglyConnected), until the map imports
// the core (the renderer refactor, B3).

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { impliedLinks, noteIds, pagerank, strengthEdges, type Edge } from "../src/index.ts";
import { loadBundle } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const mapJs = readFileSync(ROOT + "app/src/lib/views/map.js", "utf8");

// Lift a top-level function out of map.js by name.
function lift(name: string): string {
  const start = mapJs.indexOf(`function ${name}(`);
  const end = mapJs.indexOf("\n}\n", start);
  if (start < 0 || end < 0) throw new Error(`map.js has no function ${name}`);
  return mapJs.slice(start, end + 3);
}
const map = new Function(`${lift("pagerank")}\n${lift("stronglyConnected")}\n${lift("impliedLinks")}\nreturn { pagerank, impliedLinks };`)() as {
  pagerank: (ids: string[], edges: Edge[]) => Map<string, number>;
  impliedLinks: (ids: string[], edges: Edge[]) => Set<string>;
};

// How map.js builds its edges from the dashboard's concepts.json.
const STRENGTH: Record<string, number> = { requires: 3, uses: 2, "see also": 1 };
function mapEdges(concepts: { id: string; links: { target: string; kind: string; broken: boolean; rel: string | null }[] }[]): Edge[] {
  const known = new Set(concepts.map((c) => c.id));
  const strongest = new Map<string, number>();
  for (const c of concepts) {
    for (const l of c.links) {
      if (l.broken || l.kind !== "concept" || !known.has(l.target) || l.target === c.id) continue;
      const key = c.id + "\n" + l.target;
      strongest.set(key, Math.max(strongest.get(key) || 0, (l.rel && STRENGTH[l.rel]) || 2));
    }
  }
  return [...strongest].map(([key, s]) => [...key.split("\n"), s] as Edge);
}

const bundles = readdirSync(ROOT + "fixtures/bundles").sort();

describe.each(bundles)("%s", (name) => {
  const b = loadBundle(`${ROOT}fixtures/bundles/${name}`);
  const ids = noteIds(b);
  const edges = strengthEdges(b, ids);
  test("edges as map.js builds them", () => {
    const concepts = ids.map((id) => ({ id, links: b.concepts.get(id)!.links }));
    expect(edges).toEqual(mapEdges(concepts));
  });
  test("pagerank", () => expect(pagerank(ids, edges)).toEqual(map.pagerank(ids, edges)));
  test("implied links", () => expect([...impliedLinks(ids, edges)].sort()).toEqual([...map.impliedLinks(ids, edges)].sort()));
});

test("implied links skip see also and cycles", () => {
  const ids = ["a", "b", "c", "x", "y"];
  const edges: Edge[] = [["a", "b", 3], ["b", "c", 3], ["a", "c", 3], ["a", "x", 1], ["x", "c", 1], ["x", "y", 3], ["y", "x", 3]];
  expect([...impliedLinks(ids, edges)]).toEqual(["a\nc"]);
});
