// The link graph the map draws: each link's strength from its rating, how
// important each note is (PageRank), and which links are implied by others.
// Moved from the dashboard's map.js; test/graph.test.ts checks the two agree.

import type { Bundle } from "./bundle.ts";
import { cmp } from "./text.ts";

// How consequential a link is, from its rating; unrated links count as "uses".
export const STRENGTH = { requires: 3, uses: 2, "see also": 1 } as const;
export type Edge = [from: string, to: string, strength: number];

/** Note ids in the order the dashboard lists them (sorted, as the build writes them). */
export function noteIds(bundle: Bundle): string[] {
  return [...bundle.concepts.keys()].sort(cmp);
}

/** Directed links between notes, each with its strongest rating. */
export function strengthEdges(bundle: Bundle, ids = noteIds(bundle)): Edge[] {
  const strongest = new Map<string, number>();
  for (const id of ids) {
    for (const l of bundle.concepts.get(id)!.links) {
      if (l.broken || l.kind !== "concept" || !bundle.concepts.has(l.target) || l.target === id) continue;
      const key = id + "\n" + l.target;
      strongest.set(key, Math.max(strongest.get(key) ?? 0, l.rel ? STRENGTH[l.rel] : 2));
    }
  }
  return [...strongest].map(([key, s]) => {
    const [a, b] = key.split("\n") as [string, string];
    return [a, b, s];
  });
}

/** PageRank over the links: how central each note is. */
export function pagerank(ids: string[], edges: readonly Edge[], damping = 0.85, rounds = 40): Map<string, number> {
  const n = ids.length;
  const out = new Map(ids.map((id) => [id, [] as string[]]));
  for (const [a, b] of edges) out.get(a)!.push(b);
  let rank = new Map(ids.map((id) => [id, 1 / n]));
  for (let i = 0; i < rounds; i++) {
    const next = new Map(ids.map((id) => [id, (1 - damping) / n]));
    let dangling = 0;
    for (const id of ids) {
      const targets = out.get(id)!;
      if (!targets.length) { dangling += rank.get(id)!; continue; }
      const share = (damping * rank.get(id)!) / targets.length;
      for (const t of targets) next.set(t, next.get(t)! + share);
    }
    for (const id of ids) next.set(id, next.get(id)! + (damping * dangling) / n);
    rank = next;
  }
  return rank;
}

/** Tarjan's strongly connected components: node → component number. */
export function stronglyConnected(ids: string[], next: (v: string) => string[]): Map<string, number> {
  const index = new Map<string, number>(), low = new Map<string, number>(), onStack = new Set<string>();
  const stack: string[] = [], component = new Map<string, number>();
  let counter = 0, groups = 0;
  const visit = (v: string): void => {
    index.set(v, counter); low.set(v, counter); counter++;
    stack.push(v); onStack.add(v);
    for (const w of next(v)) {
      if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) === index.get(v)) {
      let w: string;
      do { w = stack.pop()!; onStack.delete(w); component.set(w, groups); } while (w !== v);
      groups++;
    }
  };
  for (const v of ids) if (!index.has(v)) visit(v);
  return component;
}

/** Links implied by others, as "from\nto" keys: a → c is implied when c can also
 *  be reached from a through a chain of links at least as strong (never through
 *  "see also"), as in a transitive reduction. Links inside a group of notes that
 *  require each other (a cycle) are left alone. Only the map hides them. */
export function impliedLinks(ids: string[], edges: readonly Edge[]): Set<string> {
  const out = new Map(ids.map((id) => [id, [] as [string, number][]]));
  for (const [a, b, s] of edges) out.get(a)!.push([b, s]);
  const component = stronglyConnected(ids, (v) => out.get(v)!.filter(([, s]) => s >= 2).map(([w]) => w));
  const implied = new Set<string>();
  for (const [a, c, s] of edges) {
    if (component.get(a) === component.get(c)) continue;
    const need = Math.max(s, 2);
    const seen = new Set([a]);
    const stack: string[] = [];
    for (const [b, sb] of out.get(a)!) if (b !== c && sb >= need && !seen.has(b)) { seen.add(b); stack.push(b); }
    while (stack.length) {
      const v = stack.pop()!;
      if (v === c) { implied.add(a + "\n" + c); break; }
      for (const [w, sw] of out.get(v)!) if (sw >= need && !seen.has(w)) { seen.add(w); stack.push(w); }
    }
  }
  return implied;
}
