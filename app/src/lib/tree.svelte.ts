// The knowledge tree's state, kept across pages: the filter, and which
// folders are open (for this browser tab).

import type { ConceptRecord } from "@rdstudio/core";
import { SvelteSet } from "svelte/reactivity";
import { store } from "./data.svelte.ts";
import { titleCase } from "./format.ts";

function saved(): string[] {
  try { return JSON.parse(sessionStorage.getItem("rdstudio.openDirs") ?? "[]") as string[]; } catch { return []; }
}

class TreeState {
  filter = $state("");
  open = new SvelteSet<string>(saved());

  toggle(id: string, isOpen: boolean): void {
    if (this.filter) return; // while filtering, every matching folder is open
    if (isOpen) this.open.add(id);
    else this.open.delete(id);
    try { sessionStorage.setItem("rdstudio.openDirs", JSON.stringify([...this.open])); } catch { /* private mode */ }
  }

  matches(c: ConceptRecord | undefined): boolean {
    if (!c) return false;
    if (!this.filter) return true;
    const q = this.filter.toLowerCase();
    return [c.title, c.description, c.type, ...(c.tags ?? [])].join(" ").toLowerCase().includes(q);
  }

  hasMatch(id: string): boolean {
    const d = store.tree[id];
    if (!d) return false;
    return d.concepts.some((cid) => this.matches(store.concepts.get(cid))) || d.children.some((child) => this.hasMatch(child));
  }
}

export const tree = new TreeState();

export function dirLabel(id: string): string {
  if (!id) return store.site.title || "Knowledge";
  return titleCase(id.split("/").pop()!.replace(/[-_]/g, " "));
}
