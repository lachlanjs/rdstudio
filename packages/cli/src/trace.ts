// What agents outside the app do in the knowledge base (T107): each call a
// terminal agent makes to the MCP server, and each file of the base it reads
// or edits with its own tools where its harness reports it (T108), kept as a
// line in a log beside the learner record. `rdstudio serve` reads the log and
// follows it, so the Atlas can draw a session as a path while it happens, and
// again afterwards.
//
// The log is private, like the learner record: it is on this machine, outside
// the repository, and is never part of a build. It holds what was touched,
// not what was said: a search's words, the notes named and opened, and never
// the text read or written.

import { randomBytes } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Bundle } from "@rdstudio/core";
import { readToml, userConfigPath, type Config } from "./config.ts";
import * as learner from "./learner.ts";
import type { Step } from "./lookup.ts";

/** One thing an agent did, as it is kept. */
export interface Event {
  at: string;
  /** The session it belongs to: one for each run of the MCP server, or each session a harness names. */
  session: string;
  /** What the agent calls itself: "claude-code 2.1", "opencode". */
  client: string;
  /** How it was seen: a call to the MCP server, or a file tool of the agent's own, reported by its harness. */
  source: "mcp" | "hook";
  step: Step;
}

export interface Session { id: string; client: string; sources: ("mcp" | "hook")[]; started: string; last: string; steps: number; notes: number; wrote: number }

/** Sessions go quiet: one with nothing for this long is taken to be over. */
export const QUIET_MS = 5 * 60_000;
/** The log is kept to this size: past it, the older half goes. */
const MOST_BYTES = 4 << 20;

export const tracePath = (cfg: Config): string => join(learner.recordDir(cfg), "agents.jsonl");

/** Whether what agents do is kept: yes unless turned off, `[agents] trace = false` in the user config or the project's. */
export function enabled(cfg: Config): boolean {
  const off = (t: unknown) => typeof t === "object" && t !== null && (t as { trace?: unknown }).trace === false;
  return cfg.isProject && !off(cfg.raw.agents) && !off(readToml(userConfigPath()).agents) && process.env.RDSTUDIO_TRACE !== "0";
}

/** Add an event. Never throws: an agent's call does not fail because its trace could not be kept. */
export function append(cfg: Config, e: Event): void {
  try {
    if (!enabled(cfg)) return;
    const path = tracePath(cfg);
    mkdirSync(learner.recordDir(cfg), { recursive: true });
    appendFileSync(path, JSON.stringify(e) + "\n", "utf8");
    if (statSync(path).size > MOST_BYTES) trim(path);
  } catch { /* not kept */ }
}

/** Drop the older half, at a line. */
function trim(path: string): void {
  const text = readFileSync(path, "utf8"), cut = text.indexOf("\n", Math.floor(text.length / 2));
  if (cut < 0) return;
  writeFileSync(path + ".tmp", text.slice(cut + 1), "utf8");
  renameSync(path + ".tmp", path);
}

const parse = (text: string): Event[] => {
  const out: Event[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as Event;
      if (e && typeof e.session === "string" && typeof e.at === "string" && e.step && typeof e.step.tool === "string" && Array.isArray(e.step.notes)) out.push(e);
    } catch { /* a line half written, or not ours */ }
  }
  return out;
};

export function events(cfg: Config, session?: string): Event[] {
  const path = tracePath(cfg);
  if (!existsSync(path)) return [];
  const all = parse(readFileSync(path, "utf8"));
  return session ? all.filter((e) => e.session === session) : all;
}

/** The sessions in the log, the latest first. */
export function sessions(cfg: Config): Session[] {
  const by = new Map<string, Session & { seen: Set<string> }>();
  for (const e of events(cfg)) {
    let s = by.get(e.session);
    if (!s) by.set(e.session, s = { id: e.session, client: e.client, sources: [], started: e.at, last: e.at, steps: 0, notes: 0, wrote: 0, seen: new Set() });
    if (e.at > s.last) s.last = e.at;
    if (!s.sources.includes(e.source)) s.sources.push(e.source);
    if (e.client && (!s.client || s.client === "an agent")) s.client = e.client;
    s.steps++;
    if (!e.step.failed) { for (const id of e.step.opened ? [e.step.opened] : []) s.seen.add(id); if (e.step.how === "write") s.wrote++; }
  }
  return [...by.values()].map(({ seen, ...s }) => ({ ...s, notes: seen.size })).sort((a, b) => (a.last < b.last ? 1 : -1));
}

/** Take one session out of the log. */
export function forget(cfg: Config, session: string): { id: string } {
  const path = tracePath(cfg);
  if (existsSync(path)) {
    const kept = readFileSync(path, "utf8").split("\n").filter((line) => { if (!line.trim()) return false; try { return (JSON.parse(line) as Event).session !== session; } catch { return false; } });
    writeFileSync(path + ".tmp", kept.length ? kept.join("\n") + "\n" : "", "utf8");
    renameSync(path + ".tmp", path);
  }
  return { id: session };
}

/** Follow the log: `on` is called with each event added from now on. Returns a function that stops. The file is
 *  looked at twice a second, which costs one stat, and read only from where it was last read to. */
export function follow(cfg: Config, on: (e: Event) => void, everyMs = 500): () => void {
  const path = tracePath(cfg);
  let at = existsSync(path) ? statSync(path).size : 0, rest = "";
  const timer = setInterval(() => {
    let size: number;
    try { size = statSync(path).size; } catch { return; }
    if (size < at) { at = 0; rest = ""; } // trimmed: read from the start (an event may be given twice; the page keeps them by time and session)
    if (size === at) return;
    const buf = Buffer.alloc(size - at);
    let fd: number | null = null;
    try { fd = openSync(path, "r"); readSync(fd, buf, 0, buf.length, at); } catch { return; } finally { if (fd !== null) closeSync(fd); }
    at = size;
    const text = rest + buf.toString("utf8"), end = text.lastIndexOf("\n");
    rest = end < 0 ? text : text.slice(end + 1);
    if (end >= 0) for (const e of parse(text.slice(0, end))) on(e);
  }, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}

// ------------------------------------------------------------------ the MCP server's side

const short = (t: string, n = 70) => (t.length > n ? t.slice(0, n) + "…" : t);
const text = (v: unknown) => (typeof v === "string" ? v : "");

/** The MCP server's tracer: one session for the life of the process. What a call touched is worked out from its
 *  name, its arguments and its reply, so the tools themselves know nothing of it. */
export class Tracer {
  readonly session = `${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}-${randomBytes(3).toString("hex")}`;
  /** The notes in hand, latest last: a note opened that one of them links to was reached by that link. */
  private held: string[] = [];
  private readonly cfg: Config;
  private readonly client: () => string;

  constructor(cfg: Config, client: () => string) { this.cfg = cfg; this.client = client; }

  /** Keep one call. `b` is the base as the call saw it, where it loaded one. */
  call(name: string, args: Record<string, unknown>, reply: string, b: Bundle | null): void {
    try {
      const step = this.step(name, args, reply, b);
      if (step) append(this.cfg, { at: new Date().toISOString(), session: this.session, client: this.client(), source: "mcp", step });
    } catch { /* not kept */ }
  }

  private opened(step: Step, b: Bundle | null, raw: unknown): string | null {
    const ref = text(raw);
    if (!ref || ref.startsWith("global:")) return null; // the global base is not on this map
    const id = b?.resolveId(ref) ?? null;
    if (!id) return null;
    step.opened = id; step.notes = [id];
    for (let k = this.held.length - 1; k >= 0; k--) {
      const h = this.held[k]!;
      if (h !== id && b!.concepts.get(h)?.links.some((l) => l.target === id)) { step.from = h; step.how = "link"; break; }
    }
    if (!this.held.includes(id)) this.held.push(id);
    return id;
  }

  private step(name: string, a: Record<string, unknown>, reply: string, b: Bundle | null): Step | null {
    const step: Step = { tool: name, args: {}, said: "", how: "read", notes: [] };
    const title = (id: string) => b?.concepts.get(id)?.title ?? id;
    if (name === "search" || name === "find_similar") {
      const query = text(a.query ?? a.text);
      step.how = name === "search" ? "search" : "meaning";
      step.args = { query, ...(a.under ? { under: a.under } : {}), ...(a.type ? { type: a.type } : {}) };
      let ids: string[] = [];
      try { const j = JSON.parse(reply) as { id?: unknown }[] | { results?: { id?: unknown }[] }; ids = (Array.isArray(j) ? j : j.results ?? []).map((r) => text(r.id)).filter((id) => id && !id.startsWith("global:")); } catch { /* nothing found: the reply is a sentence */ }
      step.notes = ids;
      step.said = `${name === "search" ? "Searched the notes for" : "Looked for notes that mean"} "${short(query)}": ${ids.length ? `${ids.length} found` : "nothing found"}`;
      return step;
    }
    if (name === "outline" || name === "read" || name === "backlinks" || name === "study_path") {
      const id = this.opened(step, b, a.id);
      if (!id) { if (text(a.id).startsWith("global:")) return null; step.failed = true; step.said = `Looked for ${text(a.id)}, which is not a note`; return step; }
      const section = name === "read" ? text(a.section_heading) : "";
      if (section && /^No section /.test(reply)) { step.failed = true; step.said = `Looked for "${section}" in ${title(id)}, which has no such section`; return step; }
      if (section) step.section = section;
      step.args = { id, ...(section ? { section } : {}) };
      step.said = name === "outline" ? `Looked at the outline of ${title(id)}` : name === "backlinks" ? `Looked at what links to ${title(id)}` : name === "study_path" ? `Looked at what ${title(id)} requires`
        : section ? `Read "${section}" in ${title(id)}` : `Read ${title(id)}`;
      return step;
    }
    if (name === "record") {
      if (a.scope === "global" || text(a.id).startsWith("global:")) return null;
      step.how = "write";
      const failed = /^Not recorded/.test(reply);
      let made = false, path = "";
      try { const j = JSON.parse(reply) as { created?: boolean; path?: string }; made = j.created === true; path = text(j.path); } catch { /* refused */ }
      const id = path ? path.replace(/\.md$/, "") : text(a.id).replace(/^\/+/, "").replace(/\.md$/i, "");
      step.args = { id, ...(a.section_heading ? { section: a.section_heading } : {}), ...(a.append ? { append: true } : {}) };
      if (failed) { step.failed = true; step.said = `Tried to write ${id}: ${short(reply.replace(/^Not recorded:\s*/, ""), 120)}`; return step; }
      step.opened = id; step.notes = [id];
      if (!this.held.includes(id)) this.held.push(id);
      const named = text(a.title) || title(id);
      step.said = made ? `Wrote a new note: ${named}` : a.section_heading ? `Rewrote "${text(a.section_heading)}" in ${named}` : a.append ? `Added to ${named}` : `Changed ${named}`;
      return step;
    }
    if (name === "list_concepts") { step.args = { directory: text(a.directory) }; step.said = `Listed ${text(a.directory) ? text(a.directory) + "/" : "the top of the base"}`; return step; }
    if (name === "brief") { step.said = "Read the brief"; return step; }
    if (name === "from_developer") { step.said = /^Nothing waits/.test(reply) ? "Asked what the developer had sent: nothing" : "Took what the developer sent from the app"; return step; }
    if (name === "review_queue") { step.said = "Looked at what awaits the developer"; return step; }
    if (name === "procedure_next" || name === "procedure_propose") {
      const id = this.opened(step, b, a.procedure);
      if (name === "procedure_propose") step.how = "write";
      step.said = id ? `${name === "procedure_next" ? "Asked the next step of" : "Proposed a change to"} ${title(id)}` : `Called ${name}`;
      return step;
    }
    if (name === "promote") { step.how = "write"; step.said = `Promoted ${text(a.id)} to the global base`; return step; }
    // The learner's and the teacher's tools are about the person, not the base: that they were called, and no more.
    step.said = `Called ${name}`;
    return step;
  }
}

// ------------------------------------------------------------------ a harness's side (T108)

/** What a harness's hook reports of one tool call, as it arrives on standard input. Claude Code's PostToolUse sends
 *  session_id, tool_name and tool_input; another harness may send the plain form: {tool, path, query, session, client}. */
export function hookEvent(cfg: Config, raw: unknown): Event | null {
  const j = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const input = (typeof j.tool_input === "object" && j.tool_input !== null ? j.tool_input : {}) as Record<string, unknown>;
  const tool = text(j.tool_name ?? j.tool), path = text(input.file_path ?? input.notebook_path ?? input.path ?? j.path), query = text(input.pattern ?? j.query);
  const kind = /^(read|view)$/i.test(tool) ? "read" : /^(edit|write|multiedit|notebookedit|patch)$/i.test(tool) ? "write" : /^(grep|glob|search)$/i.test(tool) ? "search" : null;
  if (!kind) return null;
  // A search with no folder named is of where the agent is: the repository.
  const step = fileStep(cfg, kind, path || (kind === "search" ? text(j.cwd) || cfg.root : ""), query);
  if (!step) return null;
  const claude = typeof j.session_id === "string" && j.hook_event_name !== undefined;
  const client = text(j.client) || (claude ? "claude-code" : "an agent");
  // The agent's own MCP session, where it has one at work: the latest from the same agent, still active. Its calls
  // and its file reads are then one path. With none, the harness's session is its own.
  const now = Date.now(), family = client.split(/[\s/]/)[0]!.toLowerCase();
  const own = sessions(cfg).find((s) => s.sources.includes("mcp") && now - +new Date(s.last) < QUIET_MS && s.client.toLowerCase().startsWith(family));
  const named = text(j.session_id ?? j.session).replace(/[^\w.-]/g, "").slice(0, 40);
  return { at: new Date().toISOString(), session: own?.id ?? `${family}-${named || "files"}`, client: own?.client ?? client, source: "hook", step };
}

/** A step for a file of the knowledge base that an agent read, searched or edited with its own tools, or null
 *  where the file is not a note of this project's base. `path` may be absolute or from the repository's root. */
export function fileStep(cfg: Config, kind: "read" | "write" | "search", path: string, query = ""): Step | null {
  const root = cfg.knowledgeDir.replace(/\/+$/, "");
  const abs = path.startsWith("/") ? path : join(cfg.root, path);
  if (kind === "search") {
    // A search of files under the base: its words, and where; what it found is not known here.
    if (abs !== root && !abs.startsWith(root + "/") && !root.startsWith(abs.replace(/\/+$/, "") + "/") && abs.replace(/\/+$/, "") !== cfg.root.replace(/\/+$/, "")) return null;
    return { tool: "files", args: { query }, said: `Searched the files of the base for "${short(query)}"`, how: "search", notes: [] };
  }
  if (!abs.startsWith(root + "/") || !abs.endsWith(".md")) return null;
  const id = abs.slice(root.length + 1, -3);
  if (/(^|\/)(index|log)$/.test(id) || id.split("/").some((p) => p.startsWith("."))) return null;
  return { tool: "files", args: { id }, said: `${kind === "write" ? "Edited" : "Read"} ${id} as a file`, how: kind === "write" ? "write" : "read", notes: [id], opened: id };
}
