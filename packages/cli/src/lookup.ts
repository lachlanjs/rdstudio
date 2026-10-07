// What Axis may look up for itself while it works in the editor (T84): the
// knowledge base, by the same search, outline and section reads the MCP server
// gives an outside agent, and the repository's code. Read-only, the project's
// own base only, and code only from files git tracks. Each call is kept as a
// step, so that what was looked at, and how it was reached, can be shown.

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, posix, relative } from "node:path";
import { SearchIndex, headings, section, type Bundle } from "@rdstudio/core";
import type { Config } from "./config.ts";
import type { ToolDef } from "./models.ts";

/** How a note or a file came to be looked at. */
export type How = "search" | "read" | "link" | "code";

/** One thing looked up. */
export interface Step {
  tool: string;
  args: Record<string, unknown>;
  /** One line for the person: what was looked up and what came of it. */
  said: string;
  how: How;
  /** The notes it named: what a search found, or the one note opened. */
  notes: string[];
  /** The note opened (outlined or read), and the section read. */
  opened?: string;
  section?: string;
  /** The note already in hand that links to the one opened: a step along a chain. */
  from?: string;
  /** The file and line read or found. */
  code?: { path: string; line: number };
  /** The passage read, shortened: what a preview shows. */
  excerpt?: string;
  failed?: boolean;
}

const str = { type: "string" } as const;
const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[]): ToolDef => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } } });

export const TOOLS: ToolDef[] = [
  fn("search_notes", "Keyword search over the project's knowledge base. Returns note ids, titles, types, one-sentence descriptions and a one-line snippet. Search by the words a note would use.",
    { query: str, under: { ...str, description: "Only notes in this folder, such as design or decisions." }, type: { ...str, description: "Only notes of this type, such as Decision, Design, Task, Question." }, limit: { type: "integer", description: "How many, 8 unless said, 15 at most." } }, ["query"]),
  fn("outline_note", "A note's description, its headings, the notes it links to and the notes that link to it, without its body. Use it to choose a section to read.", { id: { ...str, description: "The note's id or path: design/model or /design/model.md." } }, ["id"]),
  fn("read_note", "Read one section of a note, by its heading, or the whole note when no section is named. Prefer a section.", { id: str, section: { ...str, description: "A heading's text, as outline_note gives it." } }, ["id"]),
  fn("search_code", "Find a name or a phrase in the repository's files (exact text, whole lines returned with path and line number). The knowledge base is not searched: use search_notes for that.",
    { text: str, path: { ...str, description: "Only under this folder or in this file." } }, ["text"]),
  fn("read_code", "Read lines of one file of the repository.", { path: str, from: { type: "integer", description: "The first line, 1 unless said." }, to: { type: "integer", description: "The last line; 120 lines are read unless said, 200 at most." } }, ["path"]),
];

const MAX_READ = 8000;
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() + "\n[…cut: read a section of it for the rest]" : s);
const brief = (s: string, n = 400) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n).trimEnd() + "…" : t; };

/** A note's id from what a model writes for one: /design/model.md, design/model, [x](/design/model.md). */
export function noteId(b: Bundle, raw: unknown): string | null {
  let id = String(raw ?? "").trim().replace(/^.*\]\(/, "").replace(/\)$/, "").replace(/\s+"[^"]*"$/, "").split("#")[0]!.replace(/^\/+/, "").replace(/\.md$/i, "");
  if (b.concepts.has(id)) return id;
  id = id.replace(/^knowledge\//, "");
  return b.concepts.has(id) ? id : null;
}

/** What is looked up for one request: the base as it was when asked, and what has been opened so far. */
export class Lookup {
  readonly steps: Step[] = [];
  private index: SearchIndex | null = null;
  /** The notes in hand, latest last: the one being written, then each one opened. */
  private held: string[];
  private tracked: Set<string> | null = null;

  readonly cfg: Config;
  readonly b: Bundle;

  constructor(cfg: Config, b: Bundle, note: string) { this.cfg = cfg; this.b = b; this.held = [note]; }

  /** Run one call; the text goes back to the model. */
  run(name: string, raw: string): string {
    let args: Record<string, unknown>;
    try { args = raw.trim() ? JSON.parse(raw) : {}; } catch { args = {}; }
    if (typeof args !== "object" || args === null || Array.isArray(args)) args = {};
    const step: Step = { tool: name, args, said: "", how: "read", notes: [] };
    let out: string;
    try {
      out = name === "search_notes" ? this.search(args, step) : name === "outline_note" ? this.outline(args, step) : name === "read_note" ? this.read(args, step)
        : name === "search_code" ? this.grep(args, step) : name === "read_code" ? this.file(args, step) : this.fail(step, `There is no tool ${name}.`);
    } catch (err) { out = this.fail(step, `That could not be looked up: ${(err as Error).message}`); }
    this.steps.push(step);
    return out;
  }

  private fail(step: Step, why: string): string { step.failed = true; step.said = why; return why; }

  private search(a: Record<string, unknown>, step: Step): string {
    step.how = "search";
    const query = String(a.query ?? "").trim();
    if (!query) return this.fail(step, "search_notes needs a query.");
    this.index ??= new SearchIndex(this.b);
    const limit = Math.max(1, Math.min(Number(a.limit) || 8, 15));
    const hits = this.index.search(query, { limit, under: typeof a.under === "string" && a.under ? a.under.replace(/^\/+|\/+$/g, "") : undefined, type: typeof a.type === "string" && a.type ? a.type : undefined });
    step.notes = hits.map((h) => h.concept.id);
    step.said = `Searched the notes for "${query}": ${hits.length ? `${hits.length} found` : "nothing found"}`;
    if (!hits.length) return "No notes match. Try other words, or fewer.";
    return hits.map((h) => `- ${h.concept.title} (/${h.concept.id}.md), ${h.concept.type}${h.concept.description ? `: ${h.concept.description}` : ""}\n  ${h.snippet}`).join("\n");
  }

  /** The note in hand that links to this one, latest first: how it was reached. */
  private reached(id: string, step: Step): void {
    for (let k = this.held.length - 1; k >= 0; k--) {
      const h = this.held[k]!;
      if (h !== id && this.b.concepts.get(h)?.links.some((l) => l.target === id)) { step.from = h; step.how = "link"; break; }
    }
    if (!this.held.includes(id)) this.held.push(id);
  }

  private outline(a: Record<string, unknown>, step: Step): string {
    const id = noteId(this.b, a.id);
    if (!id) return this.fail(step, `There is no note ${String(a.id ?? "")}. Search for it by its words.`);
    const c = this.b.concepts.get(id)!;
    step.opened = id; step.notes = [id];
    this.reached(id, step);
    step.said = `Looked at the outline of ${c.title}`;
    step.excerpt = brief(c.description || c.body);
    const out = [...new Set(c.links.filter((l) => !l.broken).map((l) => l.target))], inn = this.b.backlinks(id);
    const named = (ids: string[]) => ids.slice(0, 30).map((i) => `${this.b.concepts.get(i)?.title ?? i} (/${i}.md)`).join("; ") || "none";
    return [`# ${c.title} (/${id}.md), ${c.type}`, c.description, `${[...c.body].length} characters.`,
      `Headings:\n${headings(c.body).map((h) => "#".repeat(h.level) + " " + h.text).join("\n") || "none"}`, `Links to: ${named(out)}`, `Linked from: ${named(inn)}`].filter(Boolean).join("\n\n");
  }

  private read(a: Record<string, unknown>, step: Step): string {
    const id = noteId(this.b, a.id);
    if (!id) return this.fail(step, `There is no note ${String(a.id ?? "")}. Search for it by its words.`);
    const c = this.b.concepts.get(id)!;
    step.opened = id; step.notes = [id];
    const want = typeof a.section === "string" ? a.section.replace(/^#+\s*/, "").trim() : "";
    let body = c.body.trim();
    if (want) {
      const s = section(c.body, want);
      if (s === null) { this.reached(id, step); return this.fail(step, `There is no section "${want}" in ${c.title}. Its headings: ${headings(c.body).map((h) => h.text).join("; ") || "none"}.`); }
      body = s.trim(); step.section = want;
    }
    this.reached(id, step);
    step.said = want ? `Read "${want}" in ${c.title}` : `Read ${c.title}`;
    step.excerpt = brief(body.replace(/^#+ .*\n/, ""));
    return `# ${c.title} (/${id}.md)${want ? `, the section "${want}"` : ""}\n\n${cut(body, MAX_READ)}`;
  }

  // ---------------------------------------------------------------- code

  /** Where the knowledge base is, from the repository's root: code searches leave it out. */
  private knowledge(): string { return relative(this.cfg.root, this.cfg.knowledgeDir).replace(/\\/g, "/"); }

  /** A path inside the repository that git tracks, or null: nothing else is read. */
  private safe(raw: unknown): string | null {
    const p = posix.normalize(String(raw ?? "").trim().replace(/\\/g, "/").replace(/^\.?\/+/, "").replace(/:\d+.*$/, ""));
    if (!p || p.startsWith("..") || p.startsWith("/")) return null;
    if (!this.tracked) {
      try { this.tracked = new Set(execFileSync("git", ["ls-files", "-z"], { cwd: this.cfg.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 << 20 }).split("\0").filter(Boolean)); }
      catch { this.tracked = new Set(); }
    }
    return this.tracked.has(p) ? p : null;
  }

  private grep(a: Record<string, unknown>, step: Step): string {
    step.how = "code";
    const text = String(a.text ?? "").trim();
    if (text.length < 2) return this.fail(step, "search_code needs the text to find.");
    const under = typeof a.path === "string" && a.path.trim() ? posix.normalize(a.path.trim().replace(/^\.?\/+/, "")) : ".";
    if (under.startsWith("..")) return this.fail(step, "That path is outside the repository.");
    const k = this.knowledge();
    let lines: string[] = [];
    try {
      lines = execFileSync("git", ["grep", "-n", "-I", "-F", "--max-count=6", "-e", text, "--", under, ...(k ? [`:!${k}`] : [])],
        { cwd: this.cfg.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 8 << 20 }).split("\n").filter(Boolean);
    } catch { /* no match, or not a git repository */ }
    step.said = `Searched the code for "${text}": ${lines.length ? `${Math.min(lines.length, 40)} lines found` : "nothing found"}`;
    if (!lines.length) return "Nothing in the code matches. The text is matched exactly: try a shorter name.";
    const first = /^([^:]+):(\d+):/.exec(lines[0]!);
    if (first) step.code = { path: first[1]!, line: Number(first[2]) };
    return lines.slice(0, 40).map((l) => (l.length > 240 ? l.slice(0, 240) + "…" : l)).join("\n") + (lines.length > 40 ? `\n[…${lines.length - 40} more: narrow it with a path]` : "");
  }

  private file(a: Record<string, unknown>, step: Step): string {
    step.how = "code";
    const path = this.safe(a.path);
    if (!path) return this.fail(step, `${String(a.path ?? "")} is not a file of this repository that can be read. Find it with search_code.`);
    const full = join(this.cfg.root, path);
    if (statSync(full).size > 2_000_000) return this.fail(step, `${path} is too large to read.`);
    const all = readFileSync(full, "utf8").split("\n");
    const from = Math.max(1, Math.min(all.length, Math.trunc(Number(a.from)) || 1));
    const to = Math.max(from, Math.min(all.length, Math.trunc(Number(a.to)) || from + 119, from + 199));
    step.code = { path, line: from };
    step.said = `Read ${path}, lines ${from} to ${to}`;
    const text = all.slice(from - 1, to).join("\n");
    step.excerpt = brief(text, 300);
    return `${path}, lines ${from} to ${to} of ${all.length}:\n\n${all.slice(from - 1, to).map((l, i) => `${from + i}\t${l}`).join("\n")}`;
  }
}
