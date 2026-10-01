// Writing notes with provenance: create, update (whole body or one section),
// verify. A port of src/rdstudio/store.py, with one difference by design:
// frontmatter is edited in place (the YAML library's document API), so keys
// that are not changed keep their formatting and comments. The Python store
// re-renders the whole block; fixtures/agree_writes.py checks that both leave
// a note that reads the same.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Document, isMap, isScalar, isSeq, Scalar, type Node } from "yaml";
import { FrontmatterError, RulesClassifier, frontmatterText, headings, iso, parseYaml, strip, type Classifier } from "@rdstudio/core";
import { normpathPosix } from "./files.ts";

// Letters and digits in any script (géométrie), then also . _ / -.
const SAFE_ID = /^[\p{L}\p{N}][\p{L}\p{N}._/-]*$/u;
const RESERVED = new Set(["index.md", "log.md"]);

export class StoreError extends Error {}

export interface WriteResult {
  id: string;
  path: string;
  created: boolean;
  significant: boolean;
  decided_by: string;
}

/** The file for a concept id, refusing ids that escape the bundle or name reserved files. */
export function conceptPath(root: string, cid: string): string {
  let id = strip(cid).replace(/^\/+/, "");
  if (id.endsWith(".md")) id = id.slice(0, -3);
  const norm = normpathPosix(id);
  if (!SAFE_ID.test(norm) || norm.startsWith("..") || `/${norm}/`.includes("/../")) {
    throw new StoreError(`invalid concept id: '${id}'`);
  }
  const base = norm.slice(norm.lastIndexOf("/") + 1);
  if (RESERVED.has(base + ".md")) throw new StoreError(`${base}.md is reserved by OKF`);
  return join(root, `${norm}.md`);
}

/** The file of a note that exists, by any name inside the bundle (new notes
 *  are held to conceptPath's stricter names); refuses names that escape it. */
export function existingNotePath(root: string, cid: string): string {
  let id = strip(cid).replace(/^\/+/, "");
  if (id.endsWith(".md")) id = id.slice(0, -3);
  const norm = normpathPosix(id);
  if (!norm || norm === "." || norm.startsWith("..") || norm.split("/").some((p) => p.startsWith(".")) || /[\0\\]/.test(norm)) {
    throw new StoreError(`invalid concept id: '${id}'`);
  }
  const path = join(root, `${norm}.md`);
  if (!existsSync(path)) return conceptPath(root, cid); // not there: the usual rules and message
  const base = norm.slice(norm.lastIndexOf("/") + 1);
  if (RESERVED.has(base + ".md")) throw new StoreError(`${base}.md is reserved by OKF`);
  return path;
}

/** Replace the content under `heading` (keeping the heading line); append the
 *  section at the end when it does not exist. */
export function replaceSection(body: string, heading: string, content: string): string {
  const wanted = strip(strip(heading).replace(/^#+/, ""));
  const hs = headings(body);
  const lines = body.split("\n");
  for (const [idx, h] of hs.entries()) {
    if (h.text.toLowerCase() !== wanted.toLowerCase()) continue;
    let end = lines.length;
    for (const later of hs.slice(idx + 1)) if (later.level <= h.level) { end = later.line; break; }
    return [...lines.slice(0, h.line + 1), "", strip(content), "", ...lines.slice(end)].join("\n");
  }
  return `${body.replace(/\s+$/u, "")}\n\n# ${wanted}\n\n${strip(content)}\n`;
}

// ------------------------------------------------------------------ YAML documents

/** A value as a node written the way the Python store writes it: flat lists
 *  inline ([a, b]), text with line breaks as a literal block. */
export function node(doc: Document, value: unknown): Node {
  const n = doc.createNode(value) as Node;
  const style = (x: unknown): void => {
    if (isSeq(x)) {
      if (x.items.length && x.items.every((i) => isScalar(i) && !String(i.value).includes("\n"))) x.flow = true;
      else x.items.forEach(style);
    } else if (isMap(x)) {
      x.items.forEach((p) => style(p.value));
    } else if (isScalar(x) && typeof x.value === "string" && x.value.includes("\n")) {
      x.type = Scalar.BLOCK_LITERAL;
    }
  };
  style(n);
  return n;
}

export interface Note {
  doc: Document;
  body: string;
}

export function readNote(path: string): Note {
  const [raw, rest] = frontmatterText(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));
  const body = rest.replace(/^\n+/, "");
  if (raw === null || !strip(raw)) return { doc: new Document({}, { version: "1.2" }), body };
  const doc = parseYaml(raw);
  const problem = doc.errors[0];
  if (problem) throw new FrontmatterError(`unparseable YAML frontmatter: ${problem.message}`);
  if (!isMap(doc.contents)) throw new FrontmatterError("frontmatter is not a mapping");
  return { doc, body };
}

export function writeNote(path: string, { doc, body }: Note): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `---\n${doc.toString(YAML_STYLE)}---\n\n${strip(body)}\n`, "utf8");
}

// Close to what the Python store writes: `[a, b]` and unindented list items.
const YAML_STYLE = { lineWidth: 100, flowCollectionPadding: false, indentSeq: false } as const;

const meta = (doc: Document): Record<string, unknown> => (doc.toJS() ?? {}) as Record<string, unknown>;
export const now = (): string => iso(Date.now());

export interface RecordOptions {
  actor: string;
  body?: string | null;
  meta?: Record<string, unknown> | null;
  section?: string | null;
  append?: string | null;
  /** true stamps `generated`; false leaves provenance alone; null lets the classifier decide. */
  significant?: boolean | null;
  classifier?: Classifier;
}

/** Create or update a concept. `meta` keys overwrite existing ones (null
 *  deletes); `body` replaces the body, or with `section` only that section;
 *  `append` adds text at the end. Significant edits stamp `generated`. */
export function record(root: string, cid: string, opts: RecordOptions): WriteResult {
  const path = conceptPath(root, cid);
  const created = !existsSync(path);
  let note: Note;
  let significant = opts.significant === undefined ? true : opts.significant;
  if (created) {
    note = { doc: new Document({}, { version: "1.2" }), body: "" };
    significant = true;
  } else {
    try {
      note = readNote(path);
    } catch (err) {
      throw new StoreError(`cannot update ${path.slice(path.lastIndexOf("/") + 1)}: ${(err as Error).message}`);
    }
  }
  const { doc } = note;
  const before = meta(doc), beforeBody = note.body;
  for (const [key, value] of Object.entries(opts.meta ?? {})) {
    if (value === null || value === undefined) doc.delete(key);
    else doc.set(key, node(doc, value));
  }
  const after = meta(doc);
  if (!after.type) throw new StoreError("a concept needs a non-empty 'type'");

  if (opts.body !== undefined && opts.body !== null) note.body = opts.section ? replaceSection(note.body, opts.section, opts.body) : opts.body;
  if (opts.append) note.body = `${note.body.replace(/\s+$/u, "")}\n\n${strip(opts.append)}\n`;

  let decidedBy = "caller";
  if (significant === null) {
    const headline = ["type", "title", "description"].some((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
    if (headline) {
      significant = true;
      decidedBy = "rules";
    } else {
      const d = (opts.classifier ?? new RulesClassifier()).choose("edit_significance", ["minor", "significant"], { before: beforeBody, after: note.body });
      significant = d.choice !== "minor";
      decidedBy = d.backend;
    }
  }
  if (significant) doc.set("generated", node(doc, { by: opts.actor, at: now() }));

  // Keep 'type' first for readability.
  const items = (doc.contents as { items: { key: unknown }[] }).items;
  const at = items.findIndex((p) => (isScalar(p.key) ? p.key.value : p.key) === "type");
  if (at > 0) items.unshift(...items.splice(at, 1));

  writeNote(path, note);
  const rel = path.slice(root.replace(/\/+$/, "").length + 1);
  return { id: rel.slice(0, -3), path: rel, created, significant: Boolean(significant), decided_by: created ? "new" : decidedBy };
}

/** Append a verification event by `actor` at the current time. */
export function verify(root: string, cid: string, actor: string): WriteResult {
  const path = conceptPath(root, cid);
  if (!existsSync(path)) throw new StoreError(`no such concept: ${cid}`);
  const note = readNote(path);
  const { doc } = note;
  const current = doc.get("verified", true);
  const event = node(doc, { by: actor, at: now() });
  if (isSeq(current)) {
    current.items.push(event);
  } else {
    const events = doc.createNode([]) as Node & { items: unknown[] };
    if (isMap(current)) events.items.push(current);
    events.items.push(event);
    doc.set("verified", events);
  }
  writeNote(path, note);
  const rel = path.slice(root.replace(/\/+$/, "").length + 1);
  return { id: rel.slice(0, -3), path: rel, created: false, significant: false, decided_by: "caller" };
}
