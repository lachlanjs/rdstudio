// What Axis may look up for itself while it works in the editor (T84): the
// knowledge base, by the same search, outline and section reads the MCP server
// gives an outside agent, and the repository's code: by exact text and by
// line, and, where the code is indexed (T66), by outline and by a search of
// its symbols' names and comments (T86). Read-only, the project's
// own base only, and code only from files git tracks (or, where there is no
// git, files outside hidden, installed and built folders). Each call is kept as a
// step, so that what was looked at, and how it was reached, can be shown.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, relative } from "node:path";
import { SearchIndex, headings, section, tokenize, type Bundle, type CodeIndex, type CodeItem } from "@rdstudio/core";
import { codeIndexSync } from "./code.ts";
import type { Config } from "./config.ts";
import * as embed from "./embed.ts";
import type { Toolbox } from "./agent.ts";
import type { ToolDef } from "./models.ts";

/** How a note or a file came to be looked at; "propose" is a change proposed (T101), which looks at nothing, and
 *  "write" a note written by an agent outside the app (T107). */
export type How = "search" | "read" | "link" | "code" | "meaning" | "propose" | "write";

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
  fn("search_symbols", "Find functions, classes, methods and constants by what they are for: a keyword search over their names, signatures and comments, in the languages the code index reads. Use it when you do not know the name. Returns each with its file, line, signature and the first line of its comment.",
    { query: str, kind: { ...str, description: "Only this kind: class, function, method, field or constant." }, path: { ...str, description: "Only under this folder or in this file." }, limit: { type: "integer", description: "How many, 8 unless said, 20 at most." } }, ["query"]),
  fn("outline_code", "What a folder or a file of the repository holds, from the code index: a folder's files and folders; a file's classes, functions and constants, each with its line, signature and the first line of its comment, and what the file imports. Leave the path empty for the top.", { path: str }, []),
  fn("search_code", "Find a name or a phrase in the repository's files (exact text, whole lines returned with path and line number). The knowledge base is not searched: use search_notes for that.",
    { text: str, path: { ...str, description: "Only under this folder or in this file." } }, ["text"]),
  fn("read_code", "Read lines of one file of the repository.", { path: str, from: { type: "integer", description: "The first line, 1 unless said." }, to: { type: "integer", description: "The last line; 120 lines are read unless said, 200 at most." } }, ["path"]),
];

/** Search by meaning (T89): offered only where the model for it is installed. */
export const FIND_SIMILAR: ToolDef = fn("find_similar", "Find notes by meaning: notes that say something like the text you give, even in quite other words. Slower and vaguer than search_notes: use it after search_notes and the links of the notes in hand have not found what you need, or when you cannot guess the words a note would use. Give a question or a sentence, not keywords. Returns each note's nearest section, with how alike it is (0 to 1).",
  { text: { ...str, description: "A question, or a sentence saying what you are looking for." }, under: { ...str, description: "Only notes in this folder." }, limit: { type: "integer", description: "How many, 6 unless said, 15 at most." } }, ["text"]);
/** The tools to offer for a project. */
export const toolsFor = (): ToolDef[] => (embed.available() ? [...TOOLS.slice(0, 1), FIND_SIMILAR, ...TOOLS.slice(1)] : TOOLS);

const MAX_READ = 8000;
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() + "\n[…cut: read a section of it for the rest]" : s);
/** The start of a passage as plain words, for a preview: without Markdown's marks, a link as its text. */
const brief = (s: string, n = 400) => {
  const t = s.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[\^[^\]]*\]/g, "").replace(/^\s*(?:[-*+]|\d+\.|#+|>)\s+/gm, "").replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
};

/** A note's id from what a model writes for one: /design/model.md, design/model, [x](/design/model.md). */
export function noteId(b: Bundle, raw: unknown): string | null {
  let id = String(raw ?? "").trim().replace(/^.*\]\(/, "").replace(/\)$/, "").replace(/\s+"[^"]*"$/, "").split("#")[0]!.replace(/^\/+/, "").replace(/\.md$/i, "");
  if (b.concepts.has(id)) return id;
  id = id.replace(/^knowledge\//, "");
  return b.concepts.has(id) ? id : null;
}

/** What is looked up for one request: the base as it was when asked, and what has been opened so far. */
export class Lookup implements Toolbox {
  readonly steps: Step[] = [];
  private index: SearchIndex | null = null;
  /** The notes in hand, latest last: the one being written, then each one opened. */
  private held: string[];
  private tracked: Set<string> | null = null;
  private git = false;
  /** How each note was first named, by a search of words or of meaning: a note opened after is found that way. */
  private named = new Map<string, "search" | "meaning">();

  readonly cfg: Config;
  readonly b: Bundle;

  constructor(cfg: Config, b: Bundle, note: string) { this.cfg = cfg; this.b = b; this.held = [note]; }

  private static args(raw: string): Record<string, unknown> {
    let args: Record<string, unknown>;
    try { args = raw.trim() ? JSON.parse(raw) : {}; } catch { args = {}; }
    return typeof args !== "object" || args === null || Array.isArray(args) ? {} : args;
  }

  defs(): ToolDef[] { return toolsFor(); }

  async call(name: string, raw: string): Promise<{ text: string; step: Step }> {
    const text = await this.runAsync(name, raw);
    return { text, step: this.steps.at(-1)! };
  }

  /** Run one call that may take a while (a search by meaning runs the model); any other is run at once. */
  async runAsync(name: string, raw: string): Promise<string> {
    if (name !== "find_similar") return this.run(name, raw);
    const args = Lookup.args(raw), step: Step = { tool: name, args, said: "", how: "meaning", notes: [] };
    let out: string;
    try { out = await this.similar(args, step); } catch (err) { out = this.fail(step, `That could not be looked up: ${(err as Error).message}`); }
    this.steps.push(step);
    return out;
  }

  private async similar(a: Record<string, unknown>, step: Step): Promise<string> {
    const text = String(a.text ?? a.query ?? "").trim();
    if (!text) return this.fail(step, "find_similar needs the text to look for.");
    if (!embed.available()) return this.fail(step, "Search by meaning is not installed here. Use search_notes.");
    const found = await embed.similar(this.cfg, this.b, text, { limit: Number(a.limit) || 6, under: typeof a.under === "string" && a.under ? a.under : undefined });
    if (!found.ready) return this.fail(step, "Search by meaning is still being prepared for this knowledge base (the first time takes a minute or two). Use search_notes for now.");
    step.notes = found.hits.map((h) => h.note);
    for (const id of step.notes) if (!this.named.has(id)) this.named.set(id, "meaning");
    step.said = `Looked for notes that mean "${text.length > 70 ? text.slice(0, 70) + "…" : text}": ${found.hits.length ? `${found.hits.length} found` : "nothing found"}`;
    const wait = found.pending ? `\n[${found.pending} sections changed lately are not searched by meaning yet: search_notes finds them.]` : "";
    if (!found.hits.length) return "No notes were found." + wait;
    return "Nearest in meaning first (how alike, 0 to 1). A high figure is not proof: read a note before resting on it.\n" + found.hits.map((h) => {
      const c = this.b.concepts.get(h.note)!;
      return `- ${c.title} (/${h.note}.md), ${c.type}${h.heading ? `, section "${h.heading}"` : ""} (${h.score.toFixed(2)})${c.description ? `: ${c.description}` : ""}\n  ${brief(h.body, 220)}`;
    }).join("\n") + wait;
  }

  /** Run one call; the text goes back to the model. */
  run(name: string, raw: string): string {
    const args = Lookup.args(raw);
    const step: Step = { tool: name, args, said: "", how: "read", notes: [] };
    let out: string;
    try {
      out = name === "search_notes" ? this.search(args, step) : name === "outline_note" ? this.outline(args, step) : name === "read_note" ? this.read(args, step)
        : name === "search_symbols" ? this.symbols(args, step) : name === "outline_code" ? this.codeOutline(args, step)
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
    for (const id of step.notes) if (!this.named.has(id)) this.named.set(id, "search");
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
    // Not by a link: if a search by meaning was what named it, that is how it was found.
    if (step.how !== "link" && this.named.get(id) === "meaning") step.how = "meaning";
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
    return this.files().has(p) ? p : null;
  }

  /** The repository's files: the ones git tracks, or, where git is not there to ask (T89), the ones a walk
   *  finds, leaving out hidden folders and what is installed or built. */
  private files(): Set<string> {
    if (this.tracked) return this.tracked;
    try {
      this.tracked = new Set(execFileSync("git", ["ls-files", "-z"], { cwd: this.cfg.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 << 20 }).split("\0").filter(Boolean));
      this.git = true;
    } catch {
      const out = new Set<string>(), skip = /^(\..*|node_modules|__pycache__|dist|build|target|venv|out|coverage)$/;
      const walk = (dir: string) => {
        let names: import("node:fs").Dirent[];
        try { names = readdirSync(join(this.cfg.root, dir), { withFileTypes: true }); } catch { return; }
        for (const e of names.sort((a, b) => (a.name < b.name ? -1 : 1))) {
          if (out.size >= 20_000) return;
          if (e.isDirectory()) { if (!skip.test(e.name)) walk(dir ? `${dir}/${e.name}` : e.name); }
          else if (e.isFile() && !e.name.startsWith(".")) out.add(dir ? `${dir}/${e.name}` : e.name);
        }
      };
      walk("");
      this.tracked = out;
    }
    return this.tracked;
  }

  /** Lines holding a text, without git: each file read and looked through. */
  private scan(text: string, under: string, knowledge: string): string[] {
    const lines: string[] = [];
    for (const path of [...this.files()].sort()) {
      if (lines.length >= 60) break;
      if (under !== "." && path !== under && !path.startsWith(under.replace(/\/?$/, "/"))) continue;
      if (knowledge && path.startsWith(knowledge + "/")) continue;
      let body: string;
      try { if (statSync(join(this.cfg.root, path)).size > 400_000) continue; body = readFileSync(join(this.cfg.root, path), "utf8"); } catch { continue; }
      if (body.includes("\0") || !body.includes(text)) continue; // not text, or not there
      let n = 0;
      body.split("\n").forEach((l, k) => { if (n < 6 && l.includes(text)) { lines.push(`${path}:${k + 1}:${l}`); n++; } });
    }
    return lines;
  }

  // The code index (T66), where the project has one: read once for a request.
  private idx: CodeIndex | null | undefined;
  private codeIndex(): CodeIndex | null { return this.idx === undefined ? (this.idx = codeIndexSync(this.cfg)) : this.idx; }
  private static readonly NO_INDEX = "This project's code is not indexed (the code map is off, or holds nothing), so there are no outlines or symbols. Use search_code to find text, and read_code to read a file.";
  /** One item on a line: where it is, what it is, and the first line of its comment. */
  private static line(i: CodeItem): string {
    const doc = i.doc.split("\n")[0]!.trim();
    const sig = i.signature.split("\n")[0]!.trim() || i.qual;
    return `${i.path}:${i.line} ${/^(class|struct)\b/.test(sig) ? "" : i.kind + " "}${sig}${doc ? ` — ${doc.length > 140 ? doc.slice(0, 140) + "…" : doc}` : ""}`;
  }

  /** Symbols by their words (T86): names split at capitals and underscores, signatures and comments, scored as a keyword search is. */
  private symbols(a: Record<string, unknown>, step: Step): string {
    step.how = "code";
    const query = String(a.query ?? "").trim();
    if (!query) return this.fail(step, "search_symbols needs a query.");
    const index = this.codeIndex();
    if (!index) return this.fail(step, Lookup.NO_INDEX);
    const words = (t: string) => tokenize(t.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_.:/]+/g, " "));
    const kind = typeof a.kind === "string" ? a.kind.trim().toLowerCase() : "", under = typeof a.path === "string" ? a.path.trim().replace(/^\.?\/+/, "") : "";
    const pool = index.items.filter((i) => i.kind !== "dir" && i.kind !== "file" && (!kind || i.kind === kind) && (!under || i.path === under || i.path.startsWith(under.replace(/\/?$/, "/"))));
    const docs = pool.map((i) => { const tf = new Map<string, number>(); for (const [text, wgt] of [[i.name, 3], [i.qual, 1], [i.doc, 2], [i.signature, 1]] as const) for (const t of words(text)) tf.set(t, (tf.get(t) ?? 0) + wgt); return tf; });
    const terms = [...new Set(words(query))];
    const scored = pool.map((i, k) => {
      let score = 0;
      for (const t of terms) { const f = docs[k]!.get(t); if (f) { const df = docs.reduce((n, d) => n + (d.has(t) ? 1 : 0), 0); score += Math.log(1 + (pool.length - df + 0.5) / (df + 0.5)) * (f / (f + 1.5)); } }
      return { i, score };
    }).filter((x) => x.score > 0).sort((x, y) => y.score - x.score || (x.i.id < y.i.id ? -1 : 1));
    const hits = scored.slice(0, Math.max(1, Math.min(Number(a.limit) || 8, 20))).map((x) => x.i);
    step.said = `Searched the code's symbols for "${query}": ${hits.length ? `${hits.length} found` : "nothing found"}`;
    if (!hits.length) return "No function, class or constant matches those words. Try other words, or search_code for exact text. Only the languages the index reads are covered.";
    step.code = { path: hits[0]!.path, line: hits[0]!.line };
    return hits.map((i) => Lookup.line(i)).join("\n");
  }

  /** What a folder or a file holds (T86). */
  private codeOutline(a: Record<string, unknown>, step: Step): string {
    step.how = "code";
    const index = this.codeIndex();
    if (!index) return this.fail(step, Lookup.NO_INDEX);
    const raw = posix.normalize(String(a.path ?? "").trim().replace(/\\/g, "/").replace(/^\.?\/+/, "") || ".").replace(/\/+$/, "");
    if (raw.startsWith("..")) return this.fail(step, "That path is outside the repository.");
    const byId = new Map(index.items.map((i) => [i.id, i]));
    const kids = (id: string | null) => index.items.filter((i) => i.parent === id).sort((x, y) => x.line - y.line || (x.id < y.id ? -1 : 1));
    const top = raw === "." || raw === "";
    const item = top ? null : byId.get(raw) ?? byId.get(raw + "/");
    if (!top && (!item || (item.kind !== "dir" && item.kind !== "file"))) return this.fail(step, `${raw} is not a folder or a file in the code index. outline_code with no path lists the top.`);
    if (top || item!.kind === "dir") {
      const inside = top ? index.items.filter((i) => i.parent === null || !byId.has(i.parent)) : kids(item!.id);
      step.said = `Looked at what is in ${top ? "the repository" : raw + "/"}`;
      const count = (id: string) => index.items.filter((i) => i.id.startsWith(id) && i.kind !== "dir" && i.kind !== "file").length;
      return `${top ? "The repository" : raw + "/"}:\n` + (inside.map((i) => i.kind === "dir" ? `- ${i.id} (folder, ${count(i.id)} symbols)` : `- ${i.path} (${i.lang}, ${kids(i.id).length} at its top)`).join("\n") || "nothing indexed");
    }
    step.code = { path: item!.path, line: 1 };
    step.said = `Looked at the outline of ${item!.path}`;
    const lines: string[] = [];
    const walk = (id: string, depth: number) => { for (const k of kids(id)) { if (lines.length >= 150) return; lines.push(`${"  ".repeat(depth)}- ${Lookup.line(k).slice(k.path.length + 1)}`); walk(k.id, depth + 1); } };
    walk(item!.id, 0);
    const uses = [...new Set(index.links.filter(([from, , kind]) => from === item!.id && (kind === "imports" || kind === "includes")).map(([, to]) => byId.get(to)?.path ?? to))];
    return [`${item!.path} (${item!.lang})${item!.doc ? `: ${item!.doc.split("\n")[0]}` : ""}`, lines.join("\n") || "No classes, functions or constants were found in it.", lines.length >= 150 ? "[…more: read the file for the rest]" : "",
      uses.length ? `Imports: ${uses.slice(0, 30).join(", ")}` : ""].filter(Boolean).join("\n\n");
  }

  private grep(a: Record<string, unknown>, step: Step): string {
    step.how = "code";
    const text = String(a.text ?? "").trim();
    if (text.length < 2) return this.fail(step, "search_code needs the text to find.");
    const under = typeof a.path === "string" && a.path.trim() ? posix.normalize(a.path.trim().replace(/^\.?\/+/, "")) : ".";
    if (under.startsWith("..")) return this.fail(step, "That path is outside the repository.");
    const k = this.knowledge();
    let lines: string[] = [];
    this.files();
    if (!this.git) lines = this.scan(text, under, k);
    else try {
      lines = execFileSync("git", ["grep", "-n", "-I", "-F", "--max-count=6", "-e", text, "--", under, ...(k ? [`:!${k}`] : [])],
        { cwd: this.cfg.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 8 << 20 }).split("\n").filter(Boolean);
    } catch { /* no match */ }
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
