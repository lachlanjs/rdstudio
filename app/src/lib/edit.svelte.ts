// Editing notes through rdstudio serve's API (the generated client in api/).
// An EditSession holds one note being edited: the text editor and the details
// form both work on it. Unsaved work is kept as a draft in this browser, so a
// closed tab or a dropped connection loses nothing; every save names the
// version it started from, and a note changed meanwhile (by an agent, or on
// another device) is shown to compare instead of being overwritten.

import { client } from "./api/client.gen.ts";
import { getApiEdit, getApiNotesById, putApiNotesById } from "./api/sdk.gen.ts";
import type { NoteConflict, NoteSource } from "./api/types.gen.ts";
import { store } from "./data.svelte.ts";

class Editing {
  enabled = $state(false);
  actor = $state("");
  token: string | null = null;

  async load(): Promise<void> {
    if (store.site.static) return;
    client.setConfig({ baseUrl: new URL(".", location.href).href.replace(/\/$/, "") });
    try {
      const { data } = await getApiEdit();
      if (!data) return;
      this.enabled = data.enabled && Boolean(data.token);
      this.token = data.token;
      this.actor = data.actor;
    } catch { /* an older server, or none: read only */ }
  }
}

export const editing = new Editing();

/** The details form's fields; everything else in the frontmatter is left alone. */
export interface Fields {
  type: string;
  title: string;
  description: string;
  tags: string; // comma separated
  status: string;
}

function fieldsOf(meta: Record<string, unknown>): Fields {
  const text = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  return {
    type: text(meta.type),
    title: text(meta.title),
    description: text(meta.description),
    tags: Array.isArray(meta.tags) ? meta.tags.map(String).join(", ") : text(meta.tags),
    status: text(meta.status),
  };
}

/** The frontmatter changes the fields make to `meta` (null removes a field). */
function changes(fields: Fields, meta: Record<string, unknown>): Record<string, unknown> {
  const before = fieldsOf(meta);
  const out: Record<string, unknown> = {};
  for (const key of ["type", "title", "description", "status"] as const) {
    if (fields[key].trim() !== before[key].trim()) out[key] = fields[key].trim() || null;
  }
  if (fields.tags.trim() !== before.tags.trim()) {
    const tags = fields.tags.split(",").map((t) => t.trim()).filter(Boolean);
    out.tags = tags.length ? tags : null;
  }
  return out;
}

type Draft = { base: string; body: string; fields: Fields; at: number };
const draftKey = (id: string) => `rdstudio.draft.${location.pathname}.${id}`;

function readDraft(id: string): Draft | null {
  try { return JSON.parse(localStorage.getItem(draftKey(id)) ?? "null") as Draft | null; } catch { return null; }
}
function writeDraft(id: string, draft: Draft | null): void {
  try {
    if (draft) localStorage.setItem(draftKey(id), JSON.stringify(draft));
    else localStorage.removeItem(draftKey(id));
  } catch { /* storage unavailable: no drafts */ }
}

export type Status = "loading" | "ready" | "saving" | "saved" | "conflict" | "error";

export class EditSession {
  readonly id: string;
  status = $state<Status>("loading");
  message = $state("");
  source = $state.raw<NoteSource | null>(null);
  body = $state("");
  fields = $state<Fields>({ type: "", title: "", description: "", tags: "", status: "" });
  /** When saving was refused: the note as it is now (null if it was deleted or moved). */
  conflict = $state.raw<{ current: NoteSource | null } | null>(null);
  /** The editor's text was replaced from outside (a restored draft, their version): it reloads. */
  revision = $state(0);
  private draftTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(id: string) {
    this.id = id;
  }

  get dirty(): boolean {
    const s = this.source;
    if (!s) return false;
    return this.body !== s.body || Object.keys(changes(this.fields, s.meta)).length > 0;
  }

  async load(): Promise<void> {
    this.status = "loading";
    try {
      const { data, error } = await getApiNotesById({ path: { id: this.id } });
      if (!data) throw new Error((error as { error?: string } | undefined)?.error ?? "could not open the note");
      this.adopt(data);
      const draft = readDraft(this.id);
      if (draft && (draft.body !== data.body || Object.keys(changes(draft.fields, data.meta)).length)) {
        this.body = draft.body;
        this.fields = draft.fields;
        this.revision++;
        if (draft.base === data.version) {
          this.status = "ready";
          this.message = "Restored your unsaved changes.";
        } else {
          // Unsaved work from before the note changed elsewhere: compare first.
          this.conflict = { current: data };
          this.status = "conflict";
        }
      } else {
        writeDraft(this.id, null);
        this.status = "ready";
      }
    } catch (err) {
      this.status = "error";
      this.message = (err as Error).message;
    }
  }

  private adopt(note: NoteSource): void {
    this.source = note;
    this.body = note.body;
    this.fields = fieldsOf(note.meta);
  }

  /** Call after every change: keeps the draft a moment later. */
  changed(): void {
    if (this.status === "saved") this.status = "ready";
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => {
      const s = this.source;
      if (!s) return;
      writeDraft(this.id, this.dirty || this.conflict ? { base: s.version, body: this.body, fields: $state.snapshot(this.fields), at: Date.now() } : null);
    }, 400);
  }

  /** Save, from the version opened (or, after a conflict, over the current one). */
  async save(over?: NoteSource): Promise<boolean> {
    const s = this.source;
    if (!s || !editing.token || this.status === "saving") return false;
    if (!over && !this.dirty) { this.status = "saved"; return true; }
    this.status = "saving";
    this.message = "";
    const base = over ?? s;
    try {
      const { data, error, response } = await putApiNotesById({
        path: { id: this.id },
        headers: { "x-rdstudio-token": editing.token },
        body: { base: base.version, body: this.body, meta: changes(this.fields, base.meta) },
      });
      if (data) {
        this.source = data.note;
        this.conflict = null;
        if (this.draftTimer) clearTimeout(this.draftTimer);
        writeDraft(this.id, null);
        this.status = "saved";
        void store.refresh();
        return true;
      }
      if (response?.status === 409) {
        this.conflict = { current: (error as NoteConflict).current };
        this.status = "conflict";
        this.changed(); // keep the draft
        return false;
      }
      throw new Error((error as { error?: string } | undefined)?.error ?? `could not save (${response?.status ?? "no reply"})`);
    } catch (err) {
      this.status = "error";
      this.message = `${(err as Error).message}. Your changes are kept in this browser; try again.`;
      this.changed();
      return false;
    }
  }

  /** After a conflict: save mine over the note as it is now. */
  keepMine(): Promise<boolean> {
    const current = this.conflict?.current;
    if (!current) return this.save(); // deleted or moved: nothing to save over
    return this.save(current);
  }

  /** After a conflict, or to cancel: drop my changes for the note as it is now. */
  discard(): void {
    const current = this.conflict ? this.conflict.current : this.source;
    this.conflict = null;
    writeDraft(this.id, null);
    if (current) {
      this.adopt(current);
      this.revision++;
      this.status = "ready";
    } else {
      this.status = "error";
      this.message = "This note was deleted or moved.";
    }
  }
}
