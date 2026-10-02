// Editing notes from the app: read a note's source, and save edits to it,
// changing only what was edited. The body is replaced verbatim; a frontmatter
// field is changed by splicing its own lines, so other fields keep their
// formatting and comments, and saving an unchanged note writes nothing. Every
// save names the version it started from and is refused when the file has
// changed since (an agent or another device wrote it).

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { isMap } from "yaml";
import { RulesClassifier, parseYaml, type Classifier } from "@rdstudio/core";
import { BOM, StoreError, conceptPath, editFrontmatter, existingNotePath, now, spliceText, splitSource } from "./store.ts";

export { editFrontmatter, splitSource } from "./store.ts";

/** The text a note's file holds, with a version to send back when saving. */
export interface NoteSource {
  id: string;
  path: string; // relative to the knowledge folder
  version: string; // of the whole file
  meta: Record<string, unknown>;
  frontmatter: string; // the YAML between the --- lines
  body: string; // everything after the frontmatter and the blank lines below it, verbatim
}

export class ConflictError extends StoreError {
  readonly current: NoteSource | null; // the note as it is now; null when it is gone
  constructor(message: string, current: NoteSource | null) {
    super(message);
    this.current = current;
  }
}

export const fileVersion = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 16);

function relId(root: string, path: string): string {
  return path.slice(root.replace(/\/+$/, "").length + 1).slice(0, -3);
}

export function noteSource(root: string, cid: string): NoteSource {
  const path = existingNotePath(root, cid);
  if (!existsSync(path)) throw new StoreError(`no such note: ${cid}`);
  return sourceOf(root, path, readFileSync(path, "utf8"));
}

function sourceOf(root: string, path: string, text: string): NoteSource {
  const [, raw, body] = splitSource(text);
  let meta: Record<string, unknown> = {};
  if (raw !== null) {
    const doc = parseYaml(raw);
    if (!doc.errors.length && isMap(doc.contents)) meta = (doc.toJS() ?? {}) as Record<string, unknown>;
  }
  const id = relId(root, path);
  return { id, path: id + ".md", version: fileVersion(text), meta, frontmatter: raw ?? "", body };
}

// ------------------------------------------------------------------ saving

export interface SaveOptions {
  actor: string;
  /** The version the edit started from; null creates a new note. */
  base: string | null;
  body?: string | null;
  /** Fields to set (null removes one). */
  meta?: Record<string, unknown> | null;
  /** true stamps `generated`; false leaves it alone; null (the default) decides from the change. */
  significant?: boolean | null;
  classifier?: Classifier;
}

export interface SaveResult {
  note: NoteSource;
  created: boolean;
  changed: boolean;
  significant: boolean;
}

/** Save an edit to a note, or create one (base null). */
export function saveNote(root: string, cid: string, opts: SaveOptions): SaveResult {
  const path = opts.base === null ? conceptPath(root, cid) : existingNotePath(root, cid);
  const exists = existsSync(path);
  if (opts.base === null) {
    if (exists) throw new ConflictError(`${relId(root, path)} already exists`, sourceOf(root, path, readFileSync(path, "utf8")));
    const meta = { ...(opts.meta ?? {}) };
    if (!meta.type) throw new StoreError("a note needs a non-empty 'type'");
    const fields = Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== null && v !== undefined));
    const front = editFrontmatter("", { ...fields, generated: { by: opts.actor, at: now() } });
    const body = (opts.body ?? "").replace(/\r\n?/g, "\n");
    const text = `---\n${front}---\n\n${body.trim() ? body.replace(/\n*$/, "\n") : ""}`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, "utf8");
    return { note: sourceOf(root, path, text), created: true, changed: true, significant: true };
  }
  if (!exists) throw new ConflictError(`${relId(root, path)} was deleted or moved`, null);
  const before = readFileSync(path, "utf8");
  if (fileVersion(before) !== opts.base) {
    throw new ConflictError(`${relId(root, path)} changed since you opened it`, sourceOf(root, path, before));
  }
  const [, , rawBody] = splitSource(before.startsWith(BOM) ? before.slice(1) : before);
  const body = rawBody.replace(/\r\n/g, "\n");
  const old = sourceOf(root, path, before);

  // The editor works in \n; spliceText keeps a file's \r\n.
  const newBody = opts.body !== undefined && opts.body !== null ? opts.body.replace(/\r\n?/g, "\n") : body;
  const changes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(opts.meta ?? {})) {
    const was = old.meta[k];
    if (JSON.stringify(v ?? null) !== JSON.stringify(was ?? null)) changes[k] = v;
  }
  if (newBody === body && !Object.keys(changes).length) return { note: old, created: false, changed: false, significant: false };
  if ("type" in changes && !changes.type) throw new StoreError("a note needs a non-empty 'type'");

  let significant = opts.significant ?? null;
  if (significant === null) {
    if (["type", "title", "description"].some((k) => k in changes)) significant = true;
    else {
      const d = (opts.classifier ?? new RulesClassifier()).choose("edit_significance", ["minor", "significant"], { before: body, after: newBody });
      significant = d.choice !== "minor";
    }
  }
  if (significant) changes.generated = { by: opts.actor, at: now() };

  const text = spliceText(before, changes, newBody === body ? null : newBody);
  writeFileSync(path, text, "utf8");
  return { note: sourceOf(root, path, text), created: false, changed: true, significant: Boolean(significant) };
}
