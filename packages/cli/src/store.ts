// Writing notes with provenance: create, update (whole body or one section),
// verify. A port of src/rdstudio/store.py, with one difference by design:
// frontmatter is edited in place (the YAML library's document API), so keys
// that are not changed keep their formatting and comments. The Python store
// re-renders the whole block; fixtures/agree_writes.py checks that both leave
// a note that reads the same.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Document, isMap, isScalar, isSeq, Scalar, type Node, type Pair } from "yaml";
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

export const BOM = "\uFEFF";

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

/** The file `before` with frontmatter fields changed (null removes one) and,
 *  unless `body` is null, the body replaced; everything else is kept as it
 *  was, byte for byte: other fields, comments, the blank lines after the
 *  frontmatter, a byte order mark and \r\n line ends. */
export function spliceText(before: string, changes: Record<string, unknown>, body: string | null): string {
  const bom = before.startsWith(BOM) ? BOM : "";
  const [prefix, raw, oldBody] = splitSource(bom ? before.slice(1) : before);
  let head = prefix;
  if (Object.keys(changes).length) {
    const front = editFrontmatter((raw ?? "").replace(/\r\n/g, "\n"), changes);
    // Keep the blank lines that separated the frontmatter from the body.
    const gap = raw === null ? "\n" : prefix.slice(prefix.lastIndexOf("---") + 3).replace(/^[^\n]*\n/, "");
    head = `---\n${front}---\n${gap}`;
    if (before.includes("\r\n")) head = head.replace(/\r?\n/g, "\r\n");
  }
  let newBody = oldBody;
  if (body !== null) newBody = before.includes("\r\n") ? body.replace(/\r?\n/g, "\r\n") : body;
  return bom + head + newBody;
}


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
 *  `append` adds text at the end. Significant edits stamp `generated`. Only
 *  what changes is written: other fields keep their lines as they were. */
export function record(root: string, cid: string, opts: RecordOptions): WriteResult {
  const path = conceptPath(root, cid);
  const created = !existsSync(path);
  const file = created ? "" : readFileSync(path, "utf8");
  let significant = created ? true : opts.significant === undefined ? true : opts.significant;
  let before: Record<string, unknown> = {};
  let body = "";
  if (!created) {
    try {
      [before, body] = parsed(file);
    } catch (err) {
      throw new StoreError(`cannot update ${path.slice(path.lastIndexOf("/") + 1)}: ${(err as Error).message}`);
    }
  }
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(opts.meta ?? {})) {
    if (JSON.stringify(value ?? null) !== JSON.stringify(before[key] ?? null)) changes[key] = value ?? null;
  }
  const after = { ...before };
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) delete after[key];
    else after[key] = value;
  }
  if (!after.type) throw new StoreError("a concept needs a non-empty 'type'");

  let newBody = body;
  if (opts.body !== undefined && opts.body !== null) newBody = opts.section ? replaceSection(body, opts.section, opts.body) : opts.body;
  if (opts.append) newBody = `${newBody.replace(/\s+$/u, "")}\n\n${strip(opts.append)}\n`;
  newBody = newBody.replace(/\r\n?/g, "\n");

  let decidedBy = "caller";
  if (significant === null) {
    if (["type", "title", "description"].some((k) => k in changes)) {
      significant = true;
      decidedBy = "rules";
    } else {
      const d = (opts.classifier ?? new RulesClassifier()).choose("edit_significance", ["minor", "significant"], { before: body, after: newBody });
      significant = d.choice !== "minor";
      decidedBy = d.backend;
    }
  }
  if (significant) changes.generated = { by: opts.actor, at: now() };

  if (created) {
    // editFrontmatter puts `type` first and the rest in the order given.
    const fields = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== null));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `---\n${editFrontmatter("", fields)}---\n\n${strip(newBody)}\n`, "utf8");
  } else if (Object.keys(changes).length || newBody !== body) {
    writeFileSync(path, spliceText(file, changes, newBody === body ? null : `${strip(newBody)}\n`), "utf8");
  }
  const rel = path.slice(root.replace(/\/+$/, "").length + 1);
  return { id: rel.slice(0, -3), path: rel, created, significant: Boolean(significant), decided_by: created ? "new" : decidedBy };
}

/** A note's fields and body (with \n line ends); throws on unreadable frontmatter. */
export function parsed(file: string): [Record<string, unknown>, string] {
  const [, raw, body] = splitSource(file.startsWith(BOM) ? file.slice(1) : file);
  let meta: Record<string, unknown> = {};
  if (raw !== null && strip(raw)) {
    const doc = parseYaml(raw.replace(/\r\n/g, "\n"));
    if (doc.errors.length) throw new FrontmatterError(`unparseable YAML frontmatter: ${doc.errors[0]!.message}`);
    if (!isMap(doc.contents)) throw new FrontmatterError("frontmatter is not a mapping");
    meta = (doc.toJS() ?? {}) as Record<string, unknown>;
  }
  return [meta, body.replace(/\r\n/g, "\n")];
}

/** Append a verification event by `actor` at the current time, changing only
 *  the `verified` field's lines. */
export function verify(root: string, cid: string, actor: string): WriteResult {
  const path = conceptPath(root, cid);
  if (!existsSync(path)) throw new StoreError(`no such concept: ${cid}`);
  const file = readFileSync(path, "utf8");
  const [meta] = parsed(file);
  const current = meta.verified;
  const events = Array.isArray(current) ? [...current] : current && typeof current === "object" ? [current] : [];
  events.push({ by: actor, at: now() });
  writeFileSync(path, spliceText(file, { verified: events }, null), "utf8");
  const rel = path.slice(root.replace(/\/+$/, "").length + 1);
  return { id: rel.slice(0, -3), path: rel, created: false, significant: false, decided_by: "caller" };
}
