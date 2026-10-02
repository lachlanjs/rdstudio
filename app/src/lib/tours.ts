// Tours: ordered walks through notes with a sentence of narration per stop.
// Shared tours are notes of type Tour; your own are kept beside the learner
// record (data.svelte.ts). Both are Markdown lists read by tourStops, and a
// tour's key in addresses is the note's id, or ~name for one of yours.

import { tourStops } from "@rdstudio/core/learning";
import { learner, store } from "./data.svelte.ts";
import { resolveLink } from "./markdown.ts";

export interface Tour {
  key: string;
  title: string;
  description: string;
  body: string;
  /** A Tour note in the project; otherwise one of yours. */
  shared: boolean;
  dir: string; // the folder its links are relative to
}

export interface Stop {
  id: string | null; // the note, or null when the link does not reach one
  title: string;
  href: string;
  text: string;
}

export const tourHref = (key: string): string => "#/tour/" + key.split("/").map(encodeURIComponent).join("/");

export const sharedTours = () => [...store.concepts.values()].filter((c) => c.type === "Tour").sort((a, b) => a.title.localeCompare(b.title));

export async function loadTour(key: string): Promise<Tour | null> {
  if (key.startsWith("~")) {
    const t = learner.tours.find((x) => x.name === key.slice(1));
    return t ? { key, title: t.title, description: t.description, body: t.body, shared: false, dir: "" } : null;
  }
  const c = store.concepts.get(key);
  if (!c || c.type !== "Tour") return null;
  return { key, title: c.title, description: c.description, body: await store.body(key), shared: true, dir: c.directory };
}

export function stopsOf(tour: Pick<Tour, "body" | "dir">): Stop[] {
  return tourStops(tour.body).map((s) => {
    const r = resolveLink(s.href, tour.dir);
    const id = r?.kind === "concept" && r.exists ? r.id : null;
    return { id, title: id ? store.concepts.get(id)!.title : s.label, href: s.href, text: s.text };
  });
}
