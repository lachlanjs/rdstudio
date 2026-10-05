// The code map (T66): the index rdstudio build writes (data/code.json), with
// what the app asks of it: an item's children, its links in and out, the
// notes attached to it (code: in their frontmatter), and the three facts of
// its health (a test exists, a note documents it, a person has reviewed one).

import type { CodeIndex, CodeItem, CodeLink, ConceptRecord } from "@rdstudio/core";
import { store } from "./data.svelte.ts";

export type LinkKind = CodeLink[2];

/** A link's name, read from each end: [outgoing, incoming]. */
export const LINK_LABEL: Record<LinkKind, [string, string]> = {
  calls: ["Calls", "Called by"],
  uses: ["Uses", "Used by"],
  imports: ["Imports", "Imported by"],
  includes: ["Includes", "Included by"],
  binds: ["Binds to Python", "Bound by"],
  implements: ["Implements", "Implemented in"],
  tests: ["Tests", "Tested by"],
  builds: ["Builds", "Built by"],
};

export const KIND_LABEL: Record<CodeItem["kind"], string> = {
  dir: "Directory", file: "File", class: "Class", function: "Function", method: "Method",
  field: "Field", constant: "Constant", target: "Build target", job: "CI job",
};

export interface CodeMap {
  index: CodeIndex;
  byId: Map<string, CodeItem>;
  children: Map<string | null, CodeItem[]>;
  out: Map<string, CodeLink[]>;
  into: Map<string, CodeLink[]>;
  notes: Map<string, ConceptRecord[]>;
  tested: Set<string>;
}

let built: { from: CodeIndex; concepts: Map<string, ConceptRecord>; map: CodeMap } | null = null;
/** The code map for the loaded index, worked out once per load. */
export function codeMap(): CodeMap | null {
  const index = store.code;
  if (!index) return null;
  if (built?.from === index && built.concepts === store.concepts) return built.map;
  const byId = new Map(index.items.map((i) => [i.id, i]));
  const children = new Map<string | null, CodeItem[]>();
  for (const i of index.items) (children.get(i.parent) ?? children.set(i.parent, []).get(i.parent)!).push(i);
  const out = new Map<string, CodeLink[]>(), into = new Map<string, CodeLink[]>();
  for (const l of index.links) {
    (out.get(l[0]) ?? out.set(l[0], []).get(l[0])!).push(l);
    (into.get(l[1]) ?? into.set(l[1], []).get(l[1])!).push(l);
  }
  // Notes attach to code with `code:` in their frontmatter: an item's id
  // ("src/core/system.hpp#nanosim::ParticleSystem"), a file's path, or a
  // qualified name ending ("ParticleSystem", "Simulation.run").
  const notes = new Map<string, ConceptRecord[]>();
  const byTail = new Map<string, CodeItem[]>();
  for (const i of index.items) for (const k of [i.qual, i.qual.split("::").slice(-2).join("::"), i.name]) (byTail.get(k) ?? byTail.set(k, []).get(k)!).push(i);
  for (const c of store.concepts.values()) {
    const refs = c.meta?.code;
    for (const ref of Array.isArray(refs) ? refs : typeof refs === "string" ? [refs] : []) {
      const r = String(ref);
      const hits = byId.has(r) ? [byId.get(r)!] : (byTail.get(r.split("#").pop()!) ?? []).filter((i) => !r.includes("#") || i.path === r.split("#")[0]);
      for (const i of hits.slice(0, 3)) (notes.get(i.id) ?? notes.set(i.id, []).get(i.id)!).push(c);
    }
  }
  const tested = new Set(index.links.filter((l) => l[2] === "tests").map((l) => l[1]));
  built = { from: index, concepts: store.concepts, map: { index, byId, children, out, into, notes, tested } };
  return built.map;
}

/** Health's three facts for one item: tested, documented, reviewed. */
export function healthOf(map: CodeMap, item: CodeItem): number {
  const notes = map.notes.get(item.id) ?? [];
  const tested = map.tested.has(item.id) || (map.children.get(item.id) ?? []).some((c) => map.tested.has(c.id));
  const documented = !!item.doc || notes.length > 0;
  const reviewed = notes.some((n) => n.trust === "human-reviewed");
  return (tested ? 1 : 0) + (documented ? 1 : 0) + (reviewed ? 1 : 0);
}

/** Where a code item's page is: its path, then "@" and its qualified name
 *  ("#/code/src/core/system.hpp@nanosim::ParticleSystem"); "@" since a "#"
 *  cannot sit inside the hash. A qualified name never holds "@" or "/". */
export const codeHref = (id: string): string => {
  const at = id.indexOf("#");
  const path = (at < 0 ? id : id.slice(0, at)).split("/").map(encodeURIComponent).join("/");
  return "#/code/" + path + (at < 0 ? "" : "@" + encodeURIComponent(id.slice(at + 1)));
};
/** The item id a code page's address names. */
export function codeId(param: string): string {
  const slash = param.lastIndexOf("/"), at = param.indexOf("@", slash + 1);
  return at < 0 ? param : param.slice(0, at) + "#" + param.slice(at + 1);
}
