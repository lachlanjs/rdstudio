// Reading order and study paths, from links rated "requires".

import type { ConceptRecord } from "@rdstudio/core";
import { store } from "./data.svelte.ts";

export function hasRequires(): boolean {
  for (const c of store.concepts.values()) if (c.requires?.length) return true;
  return false;
}

/** Everything `id` requires, directly or through a chain, in reading order. */
export function prerequisites(id: string): ConceptRecord[] {
  const seen = new Set<string>();
  const todo = [...(store.concepts.get(id)?.requires ?? [])];
  while (todo.length) {
    const v = todo.pop()!;
    if (seen.has(v) || !store.concepts.has(v)) continue;
    seen.add(v);
    todo.push(...store.concepts.get(v)!.requires);
  }
  seen.delete(id);
  return [...seen].map((x) => store.concepts.get(x)!).sort((a, b) => a.order - b.order);
}
