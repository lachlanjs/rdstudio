// Frontmatter: the YAML block between `---` lines at the top of a note (OKF §3),
// read as YAML 1.2 (core schema): `yes` and `on` are text, `010` is ten, and
// dates stay as written.

import { parseDocument, stringify } from "yaml";
import { rstrip, strip } from "./text.ts";

export class FrontmatterError extends Error {}

export type Meta = Record<string, unknown>;

/** `[frontmatter, body]`; frontmatter is null when the note has none. */
export function splitFrontmatter(source: string): [Meta | null, string] {
  const text = source.startsWith("﻿") ? source.slice(1) : source;
  if (!text.startsWith("---")) return [null, text];
  const lines = text.split("\n");
  if (strip(lines[0]!) !== "---") return [null, text];
  for (let i = 1; i < lines.length; i++) {
    if (rstrip(lines[i]!) !== "---") continue;
    const raw = lines.slice(1, i).join("\n") + "\n"; // with its last line break, as in the file
    const body = lines.slice(i + 1).join("\n");
    let meta: unknown = {};
    if (strip(raw)) {
      // CR and CRLF are line breaks in YAML; the parser only sees a trailing CR
      // as part of the last value, so normalise them first.
      const yaml = raw.replace(/\r\n?/g, "\n");
      const doc = parseDocument(yaml, { version: "1.2", schema: "core", uniqueKeys: false });
      // Tags the core schema does not know (such as !foo) are errors, as in the Python core.
      const problem = doc.errors[0] ?? doc.warnings.find((w) => w.code === "TAG_RESOLVE_FAILED");
      if (problem) throw new FrontmatterError(`unparseable YAML frontmatter: ${problem.message}`);
      meta = doc.toJS({ maxAliasCount: 1000 });
    }
    if (meta === null || meta === undefined) meta = {};
    if (typeof meta !== "object" || Array.isArray(meta)) throw new FrontmatterError("frontmatter is not a mapping");
    return [meta as Meta, body.replace(/^\n+/, "")];
  }
  throw new FrontmatterError("frontmatter block is not closed with '---'");
}

/** Serialise frontmatter, keeping key order. */
export function dumpFrontmatter(meta: Meta): string {
  return stringify(meta, { version: "1.2", lineWidth: 100 });
}
