// Editing notes from the app: read a note's source, and save edits to it,
// changing only what was edited. The body is replaced verbatim; a frontmatter
// field is changed by splicing its own lines, so other fields keep their
// formatting and comments, and saving an unchanged note writes nothing. Every
// save names the version it started from and is refused when the file has
// changed since (an agent or another device wrote it).

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Document, isMap, isScalar, type Pair } from "yaml";
import { RulesClassifier, frontmatterText, parseYaml, type Classifier } from "@rdstudio/core";
import { StoreError, conceptPath, existingNotePath, node, now } from "./store.ts";

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

const BOM = "\uFEFF";

/** [the text before the body, the frontmatter YAML or null, the body], so that
 *  prefix + body is the file exactly. */
export function splitSource(text: string): [prefix: string, frontmatter: string | null, body: string] {
  const [raw] = frontmatterText(text);
  if (raw === null) return ["", null, text];
  const open = text.indexOf("\n") + 1; // after the first ---
  const lines = text.slice(open).split("\n");
  let at = open;
  for (const line of lines) {
    at += line.length + 1;
    if (line.replace(/\s+$/u, "") === "---") break;
  }
  at = Math.min(at, text.length);
  while (text[at] === "\n" || (text[at] === "\r" && text[at + 1] === "\n")) at += text[at] === "\r" ? 2 : 1;
  return [text.slice(0, at), raw, text.slice(at)];
}

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

// ------------------------------------------------------------------ frontmatter

const YAML_STYLE = { lineWidth: 100, flowCollectionPadding: false, indentSeq: false } as const;

/** One top-level field as the store writes it, ending in a line break. */
function fieldText(key: string, value: unknown): string {
  const doc = new Document({}, { version: "1.2" });
  const n = node(doc, value);
  // A flat mapping on one line, as {by: ..., at: ...} is written elsewhere.
  if (isMap(n) && n.items.every((p) => isScalar(p.value) && !String(p.value.value).includes("\n"))) n.flow = true;
  doc.set(key, n);
  return doc.toString(YAML_STYLE);
}

const lineStart = (text: string, at: number): number => text.lastIndexOf("\n", at - 1) + 1;
const lineEnd = (text: string, at: number): number => {
  const nl = text.indexOf("\n", at);
  return nl < 0 ? text.length : nl + 1;
};

/** Change top-level frontmatter fields in `raw` (null removes one), touching
 *  only their lines; new fields go at the end, or `type` at the start. */
export function editFrontmatter(raw: string, changes: Record<string, unknown>): string {
  let text = raw && !raw.endsWith("\n") ? raw + "\n" : raw;
  for (const [key, value] of Object.entries(changes)) {
    const doc = parseYaml(text);
    if (doc.errors.length) throw new StoreError(`unparseable YAML frontmatter: ${doc.errors[0]!.message}`);
    if (text.trim() && !isMap(doc.contents)) throw new StoreError("frontmatter is not a mapping");
    const items = isMap(doc.contents) ? (doc.contents.items as Pair[]) : [];
    const pair = items.find((p) => (isScalar(p.key) ? p.key.value : p.key) === key);
    const replacement = value === null || value === undefined ? "" : fieldText(key, value);
    if (pair) {
      const keyRange = (pair.key as { range?: [number, number, number] }).range!;
      const valueRange = (pair.value as { range?: [number, number, number] } | null)?.range;
      const start = lineStart(text, keyRange[0]);
      const end = lineEnd(text, Math.max(keyRange[1], (valueRange?.[1] ?? keyRange[1]) - 1));
      text = text.slice(0, start) + replacement + text.slice(end);
    } else if (replacement) {
      text = key === "type" ? replacement + text : text + replacement;
    }
  }
  return text;
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
  const [prefix, raw, body] = splitSource(before.startsWith(BOM) ? before.slice(1) : before);
  const bom = before.startsWith(BOM) ? BOM : "";
  const old = sourceOf(root, path, before);

  // The editor works in \n; a file written with \r\n keeps them.
  let newBody = body;
  if (opts.body !== undefined && opts.body !== null) {
    newBody = opts.body.replace(/\r\n?/g, "\n");
    if (before.includes("\r\n")) newBody = newBody.replace(/\n/g, "\r\n");
  }
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

  let head = prefix;
  if (Object.keys(changes).length) {
    const front = editFrontmatter(raw ?? "", changes);
    // Keep the blank lines that separated the frontmatter from the body.
    const gap = raw === null ? "\n" : prefix.slice(prefix.lastIndexOf("---") + 3).replace(/^[^\n]*\n/, "");
    head = `---\n${front}---\n${gap}`;
  }
  const text = bom + head + newBody;
  writeFileSync(path, text, "utf8");
  return { note: sourceOf(root, path, text), created: false, changed: true, significant: Boolean(significant) };
}
