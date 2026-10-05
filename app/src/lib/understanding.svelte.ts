// Where each note stands for you (T27): its discovery state, reviews due, the
// day's load, and whether what you have not reached is hidden. All derived
// from the private learner record by @rdstudio/core/learning, and off (every
// note simply shown) while the record is off or in an exported snapshot.

import type { ConceptRecord } from "@rdstudio/core";
import { coverage, discoveryStates, isStudyNote, dueReviews, loadNote, reviewSchedule, studyLoad, type Discovery, type NoteState } from "@rdstudio/core/learning";
import { learner, store } from "./data.svelte.ts";

const HIDE_KEY = "rdstudio.hideUndiscovered";

export const STATE_LABEL: Record<Discovery, string> = {
  undiscovered: "Not opened yet",
  discovered: "Opened",
  processed: "Worked through",
  understood: "Understood",
};

const notes = (): ConceptRecord[] => [...store.concepts.values()].filter(isStudyNote);
const localDay = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

class Understanding {
  /** Whether there is anything to show: the record is on, on a live server. */
  readonly on = $derived(learner.enabled && !store.site.static);
  readonly states = $derived(this.on ? discoveryStates(learner.events, notes()) : new Map<string, NoteState>());
  readonly schedule = $derived(this.on ? reviewSchedule(learner.events, notes()) : new Map());

  #hide = $state(read(HIDE_KEY) === "1");
  /** Hide what you have not reached (per device), except the frontier. */
  get hiding(): boolean { return this.on && this.#hide; }
  setHiding(on: boolean): void {
    this.#hide = on;
    try { localStorage.setItem(HIDE_KEY, on ? "1" : "0"); } catch { /* private browsing */ }
  }

  /** Notes reached, and the frontier: notes one link from one reached, so
   *  there is always a next step. With nothing reached yet, the starting
   *  points (landmarks, and notes that need nothing first). */
  readonly #shown = $derived.by(() => {
    const reached = new Set<string>();
    for (const [id, s] of this.states) if (s.state !== "undiscovered") reached.add(id);
    const frontier = new Set<string>();
    for (const c of notes()) {
      if (reached.has(c.id)) continue;
      const near = c.backlinks.some((b) => reached.has(b)) || c.links.some((l) => l.kind === "concept" && reached.has(l.target));
      if (near) frontier.add(c.id);
    }
    if (!reached.size) for (const c of notes()) if (c.meta?.landmark === true || (c.depth === 0 && c.requires.length === 0 && c.backlinks.length > 0)) frontier.add(c.id);
    return { reached, frontier };
  });

  state(id: string): NoteState | undefined {
    return this.on ? this.states.get(id) : undefined;
  }
  /** A class for a note's title or outline: st-<state>, plus changed. */
  cls(id: string): string {
    const s = this.state(id);
    return s ? `st-${s.state}${s.changed ? " changed" : ""}` : "";
  }
  visible(id: string): boolean {
    return !this.hiding || this.#shown.reached.has(id) || this.#shown.frontier.has(id);
  }
  /** On the frontier, whether or not hiding is on: one link from a reached
   *  note, or before anything is reached, a starting point. */
  onFrontier(id: string): boolean {
    return this.on && this.#shown.frontier.has(id);
  }
  /** Shown only as the frontier: drawn faintly. */
  frontier(id: string): boolean {
    return this.hiding && this.#shown.frontier.has(id);
  }
  folderVisible(dir: string): boolean {
    if (!this.hiding) return true;
    const d = store.tree[dir];
    return !!d && (d.concepts.some((id) => this.visible(id)) || d.children.some((c) => this.folderVisible(c)));
  }

  /** A folder's notes (and those below it) by state. */
  coverage(dir: string) {
    const ids: string[] = [];
    const walk = (d: string) => {
      const f = store.tree[d];
      if (!f) return;
      for (const id of f.concepts) { const c = store.concepts.get(id); if (c && isStudyNote(c)) ids.push(id); }
      f.children.forEach(walk);
    };
    walk(dir);
    return coverage(this.states, ids);
  }

  due(now = Date.now()) {
    return dueReviews(this.schedule, now);
  }
  /** When the next review falls due, if nothing is due now. */
  nextDue(now = Date.now()): number | null {
    const later = [...this.schedule.values()].map((r) => r.due).filter((t) => t > now);
    return later.length ? Math.min(...later) : null;
  }
  loadNote(now = Date.now()): string | null {
    return this.on ? loadNote(studyLoad(learner.events, now, localDay)) : null;
  }

  /** Mark a note (an autodidactic act): discovered takes it back down. */
  mark(id: string, state: Discovery): void {
    void learner.record({ event: "mark", concept: id, state, kind: "autodidactic" });
  }
}

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export const understanding = new Understanding();
