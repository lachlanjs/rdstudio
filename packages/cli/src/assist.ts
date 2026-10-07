// An agent in the editor (T74): while a note is being edited, ask about a
// passage, or have text proposed for a place in it. The model is given the
// note as it is in the editor with the place marked, the notes it links to,
// the notes a search finds, and code found by the names in the request (from
// the code index where there is one, and by searching the repository's files
// either way, so any language is found). Nothing is written here: an answer
// is shown beside the note, and proposed text is a suggestion the editor
// offers to accept or reject. See knowledge/design/assist.md.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative } from "node:path";
import { SearchIndex, type Bundle, type CodeIndex } from "@rdstudio/core";
import { loadBundle } from "@rdstudio/core/node";
import { codeIndexSync } from "./code.ts";
import type { Config } from "./config.ts";
import { assemble, type Seen } from "./context.ts";
import * as models from "./models.ts";
import { StoreError } from "./store.ts";

export const MODES = ["ask", "fill", "figure"] as const;
export type Mode = (typeof MODES)[number];

/** The marks put round the place in the note that the request is about. */
export const OPEN = "⟦", CLOSE = "⟧", HERE = "⟦HERE⟧";

export interface Ask {
  note: string; // its id; it need not be saved yet
  mode: Mode;
  title?: string;
  body: string; // the text in the editor now
  from: number; // the selection, or the caret (from === to), as offsets in body
  to: number;
  prompt?: string;
  /** figure: the artifact it wrote before, and what the check found wrong with it, to put right. */
  fix?: { html: string; problems: string[] };
}

/** Something the model was given, shown under its reply. */
export interface Source {
  kind: "note" | "code";
  id: string; // a note's id, or a file's path
  title: string;
  line?: number;
}

export interface Reply {
  mode: Mode;
  reply: string; // as the model wrote it
  answer: string; // what to show: the answer, or why the text was written as it was
  insert: string | null; // fill: the text proposed, for from..to
  /** figure: the artifact written (T78), to be checked and shown before anything is saved. */
  artifact?: { title: string; caption: string; html: string } | null;
  from: number;
  to: number;
  sources: Source[];
  model: string;
  cost: number;
}

const HOW = `# How to help

You are helping someone write a note in a project's knowledge base (Open
Knowledge Format: Markdown with links between notes). They are in the
editor now. The place they are asking about is marked in their note: a
passage between ${OPEN} and ${CLOSE}, or the point ${HERE}.

- Use what you are given below: the note, the notes it links to, notes
  found by searching the base, and code from the repository. Do not invent
  facts, names, file paths or code that are not there. If what you are given
  does not answer, say so plainly and say what would.
- Link to a note as [its title](/its/path.md), with the path as given.
  Refer to code as \`path:line\`.
- Write as the note is written: its language, its tone, its level. Plain
  words. No preamble, no closing remarks.
- Maths goes between dollar signs, as LaTeX.`;

const FORM: Record<Mode, string> = {
  ask: `# Your reply

Answer the question about the marked place, in Markdown, in a few short
paragraphs or a short list. Change nothing: this is shown beside the note.`,
  fill: `# Your reply

Write the text to go at the marked place: in place of the passage between
${OPEN} and ${CLOSE}, or at ${HERE}. Reply in exactly this form and nothing else:

<insert>
The Markdown to put there. Only the new text: none of the note around it, no
frontmatter, and not the marks. Code goes in a fenced block with its
language, and a line before it saying where it is from (\`path:line\`), copied
as given, not rewritten.
</insert>
<why>
One or two sentences: what you wrote and what you took it from, and anything
you were unsure of.
</why>`,
  figure: `# Your reply

Reply in exactly this form and nothing else:

<title>A short title for the artifact</title>
<caption>One line to go under it in the note: what it shows and how to use it.</caption>
<artifact>
<!doctype html>
…the whole file…
</artifact>
<why>
One or two sentences: what you made and what you took it from, and anything
you were unsure of.
</why>`,
};

const FIGURE_HOW = `# The artifact

You are writing an artifact: one self-contained HTML file that will be shown
inside the note, in a frame, where Markdown is not enough. It should make the
marked passage easier to understand by letting the reader see or try
something: a plot to hover, sliders that recompute, an animation to play and
step, a table to sort.

It must keep these rules. It is loaded and checked before it is offered, and
is not offered if it breaks one.

- One file: all script, style and data inside it. It cannot read other files.
- No network. It is served with a policy that blocks every address but
  these, rdstudio's own libraries, which you may use exactly as written:
  vendor/katex/katex.min.js, vendor/katex/auto-render.min.js,
  vendor/katex/katex.min.css (maths); vendor/vega/vega.min.js,
  vendor/vega/vega-lite.min.js, vendor/vega/vega-embed.min.js (charts).
  Plain canvas, SVG and DOM need no library and are usually enough.
- No errors: nothing uncaught, nothing written with console.error.
- Light: well under 200 kB, ready at once. Do no work until asked: an
  animation starts when the reader presses play, never on load, and stops.
- The app's colours, through these CSS variables, each with a fallback:
  --surface, --surface-1, --surface-2, --text, --text-soft, --text-faint,
  --rule, --rule-strong, --pen-red, --pen-green, --pen-blue, --font-ui,
  --font-text, --font-mono. A transparent or var(--surface) background.
- Sized by its content: no fixed page height, no inner scroll bars, a width
  that works from 320 to 800 pixels. Modest height (under about 480 pixels).
- Controls a keyboard can reach, each with a label.
- A <title>, and <meta name="description" content="one sentence">.
- Only what the note, the notes given and the code given support. Do not
  invent data: if a figure needs numbers you were not given, compute them
  from the formula in the passage, and say so in the caption.`;

// ------------------------------------------------------------------ the note, marked

/** The note's text with the place marked, cut to a window round it when the note is long. */
export function marked(body: string, from: number, to: number, room = 14000): string {
  const a = Math.max(0, Math.min(body.length, Math.min(from, to))), b = Math.max(a, Math.min(body.length, Math.max(from, to)));
  const text = a === b ? body.slice(0, a) + HERE + body.slice(a) : body.slice(0, a) + OPEN + body.slice(a, b) + CLOSE + body.slice(b);
  if (text.length <= room) return text;
  const half = Math.floor((room - (b - a)) / 2), start = Math.max(0, a - half), end = Math.min(text.length, b + half + 2);
  return (start ? "[…]\n" : "") + text.slice(start, end) + (end < text.length ? "\n[…]" : "");
}

// ------------------------------------------------------------------ notes

const dirOf = (id: string) => (id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : "");

/** The notes a text links to, by id: bundle-absolute links and ones relative to the note. */
export function linkedIds(b: Bundle, note: string, body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/\]\(([^)\s#]+?)(?:\.md)?(?:#[^)\s]*)?(?:\s+"[^"]*")?\)/g)) { // a link may carry its rating as a title: (/a.md "requires")
    const target = m[1]!;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // a web address
    const id = target.startsWith("/") ? target.replace(/^\/+/, "") : posix.normalize(posix.join(dirOf(note), target));
    if (id !== note && b.concepts.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

const noteText = (b: Bundle, id: string, chars: number): string => {
  const c = b.concepts.get(id)!;
  const body = c.body.trim();
  return `### ${c.title} (/${id}.md)\n${c.description ? c.description + "\n" : ""}\n${body.length > chars ? body.slice(0, chars).trimEnd() + "\n[…]" : body}`;
};

// ------------------------------------------------------------------ code

/** Names worth looking up in the code: what is in backticks, and words that look like identifiers or paths. */
export function codeNames(text: string): string[] {
  const out: string[] = [];
  const add = (s: string) => { const t = s.trim().replace(/\(\)$/, ""); if (t.length >= 3 && t.length <= 80 && !/\s/.test(t) && !out.includes(t)) out.push(t); };
  for (const m of text.matchAll(/`([^`\n]+)`/g)) add(m[1]!);
  for (const m of text.matchAll(/[A-Za-z_][\w./:]*[\w]/g)) {
    const w = m[0];
    if (/[a-z][A-Z]/.test(w) || /_/.test(w) || /::/.test(w) || /\.[a-z]{1,4}$/i.test(w) || (/\//.test(w) && !w.startsWith("/"))) add(w);
  }
  return out.slice(0, 12);
}

const leaf = (name: string) => name.split(/::|\.|\//).filter(Boolean).pop() ?? name;

interface Found { path: string; line: number; title: string; text: string }

/** Items of the code index named like one of the names. */
function fromIndex(index: CodeIndex | null, names: string[], words: string[]): Found[] {
  if (!index) return [];
  const out: Found[] = [];
  const want = new Set(names.map(leaf)), paths = new Set(names);
  for (const i of index.items) {
    if (i.kind === "dir") continue;
    const hit = want.has(i.name) || paths.has(i.path) || paths.has(i.qual) || (i.kind === "file" && names.some((n) => i.path.endsWith("/" + n)));
    if (!hit) continue;
    out.push({ path: i.path, line: i.line, title: `${i.kind} ${i.qual}`, text: [i.signature, i.doc && `(${i.doc})`, i.src && "```" + i.lang + "\n" + i.src + "\n```"].filter(Boolean).join("\n") });
  }
  if (out.length) return out;
  // No name given: items whose name holds one of the request's longer words.
  const lower = words.map((w) => w.toLowerCase());
  for (const i of index.items) {
    if (i.kind === "dir" || i.kind === "file" || !lower.some((w) => i.name.toLowerCase().includes(w))) continue;
    out.push({ path: i.path, line: i.line, title: `${i.kind} ${i.qual}`, text: [i.signature, i.doc && `(${i.doc})`, i.src && "```" + i.lang + "\n" + i.src + "\n```"].filter(Boolean).join("\n") });
    if (out.length >= 6) break;
  }
  return out;
}

const LANG: Record<string, string> = { py: "python", ts: "ts", js: "js", cpp: "cpp", hpp: "cpp", h: "cpp", c: "c", rs: "rust", go: "go", java: "java", rb: "ruby", sh: "sh", toml: "toml", yml: "yaml", yaml: "yaml", json: "json", cmake: "cmake" };

/** Where the names occur in the repository's files (git's, outside the knowledge base), each with the lines round it. */
function fromFiles(cfg: Config, names: string[], skip: Set<string>): Found[] {
  const out: Found[] = [];
  const knowledge = relative(cfg.root, cfg.knowledgeDir).replace(/\\/g, "/");
  for (const name of names) {
    const word = leaf(name);
    if (!/^[\w.-]+$/.test(word)) continue;
    let lines: string[] = [];
    try {
      lines = execFileSync("git", ["grep", "-n", "-w", "-F", "-I", "--max-count=2", "-e", word, "--", ".", ...(knowledge ? [`:!${knowledge}`] : [])],
        { cwd: cfg.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 4 << 20 }).split("\n").filter(Boolean);
    } catch { continue; } // not a git repository, or no match
    // Where it is defined comes first: a line that starts a definition.
    const defines = (l: string) => new RegExp(`\\b(def|class|function|fn|func|struct|interface|type|const|let|var|enum|namespace)\\b[^\\n]*\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(l);
    lines.sort((a, b) => Number(defines(b)) - Number(defines(a)));
    let taken = 0;
    for (const l of lines) {
      const m = /^([^:]+):(\d+):/.exec(l);
      if (!m) continue;
      const path = m[1]!, line = Number(m[2]);
      if (skip.has(path + ":" + line) || out.some((f) => f.path === path && Math.abs(f.line - line) < 12)) continue;
      const file = join(cfg.root, path);
      try { if (!existsSync(file) || statSync(file).size > 400_000) continue; } catch { continue; }
      const all = readFileSync(file, "utf8").split("\n"), start = Math.max(0, line - 4), end = Math.min(all.length, line + 16);
      const ext = posix.extname(path).slice(1).toLowerCase();
      out.push({ path, line: start + 1, title: `${path}, where ${word} is`, text: "```" + (LANG[ext] ?? "") + "\n" + all.slice(start, end).join("\n") + "\n```" });
      if (++taken >= 2) break;
    }
    if (out.length >= 8) break;
  }
  return out;
}

// ------------------------------------------------------------------ the request

export interface Prepared {
  messages: models.Message[];
  seen: Seen[];
  sources: Source[];
  job: models.Job;
}

/** Build the request: nothing is sent yet. */
export function prepare(cfg: Config, ask: Ask): Prepared {
  if (!(MODES as readonly string[]).includes(ask.mode)) throw new StoreError(`a mode is one of ${MODES.join(", ")}`);
  const prompt = ask.prompt?.trim() ?? "";
  const from = Math.max(0, Math.min(ask.body.length, Math.min(ask.from, ask.to))), to = Math.max(from, Math.min(ask.body.length, Math.max(ask.from, ask.to)));
  const selection = ask.body.slice(from, to);
  if (ask.mode === "ask" && !prompt && !selection.trim()) throw new StoreError("ask something, or select a passage to ask about");
  if (ask.mode === "fill" && !prompt && !selection.trim()) throw new StoreError("say what to write here, or select a passage to rewrite");
  if (ask.mode === "figure" && !prompt && !selection.trim()) throw new StoreError("select the passage the figure should be about, or say what it should show");
  const b = loadBundle(cfg.knowledgeDir);
  const known = b.concepts.get(ask.note);
  const title = ask.title?.trim() || known?.title || ask.note;

  const sources: Source[] = [];
  const linked = linkedIds(b, ask.note, ask.body).slice(0, 6);
  for (const id of linked) sources.push({ kind: "note", id, title: b.concepts.get(id)!.title });
  // Searched for by the request, the passage, what is written round the place, and the note's title.
  const near = ask.body.slice(Math.max(0, from - 300), Math.min(ask.body.length, to + 300));
  const query = [prompt, selection.slice(0, 400), near, title].filter(Boolean).join(" ");
  const found = new SearchIndex(b).search(query, { limit: 10 }).map((h) => h.concept.id).filter((id) => id !== ask.note && !linked.includes(id)).slice(0, 5);
  for (const id of found) sources.push({ kind: "note", id, title: b.concepts.get(id)!.title });

  const about = [prompt, selection].join("\n");
  const names = codeNames(about);
  // With no name given, the index is searched by the request's words only when the request is about code.
  const wantsCode = /\b(code|function|class|method|implement\w*|source|snippet|definition|declaration|signature|api)\b/i.test(prompt);
  const words = wantsCode ? [...new Set((prompt + " " + title).split(/[^A-Za-z]+/).filter((w) => w.length >= 5 && !/^(function|class|method|source|snippet|insert|relevant|where|about|write|there|their|which|definition|declaration|signature)$/i.test(w)))].slice(0, 8) : [];
  const indexed = fromIndex(codeIndexSync(cfg), names, words).slice(0, 8);
  const inFiles = fromFiles(cfg, names, new Set(indexed.map((f) => f.path + ":" + f.line))).filter((f) => !indexed.some((i) => i.path === f.path && Math.abs(i.line - f.line) < 12));
  const code = [...indexed, ...inFiles].slice(0, 10);
  for (const f of code) sources.push({ kind: "code", id: f.path, title: f.title, line: f.line });

  const what = ask.mode === "ask"
    ? (prompt ? `Their question about the marked place:\n\n${prompt}` : "They ask: what should I know about the marked passage? Is it right, and what does it leave out?")
    : ask.mode === "figure"
      ? (ask.fix
        ? `The artifact you wrote was loaded and checked, and is not good enough to offer. What was wrong:\n\n${ask.fix.problems.map((p) => "- " + p).join("\n")}\n\nWrite it again, whole, with that put right and nothing else changed.${prompt ? `\n\nWhat they asked for:\n\n${prompt}` : ""}`
        : (prompt ? `What they want the artifact to show, for the marked place:\n\n${prompt}` : "They want an artifact that makes the marked passage easier to understand."))
      : (prompt ? `What they want written at the marked place:\n\n${prompt}` : "They want the marked passage rewritten: clearer and more exact, saying the same thing.");
  const { messages, seen } = assemble([
    { name: "How to help", text: HOW.replace(/^# How to help\n\n/, ""), tokens: 600, cache: true },
    { name: "The artifact", text: ask.mode === "figure" ? FIGURE_HOW.replace(/^# The artifact\n\n/, "") : "", tokens: 900, cache: true },
    { name: "Your reply", text: FORM[ask.mode].replace(/^# Your reply\n\n/, ""), tokens: 400, cache: true },
    { name: "Notes this one links to", text: linked.map((id) => noteText(b, id, 2400)).join("\n\n"), tokens: 3600 },
    { name: "Notes found by searching the base", text: found.map((id) => noteText(b, id, 1600)).join("\n\n"), tokens: 2400 },
    { name: "Code from the repository", text: code.map((f) => `### ${f.title} (\`${f.path}:${f.line}\`)\n${f.text}`).join("\n\n"), tokens: 3600 },
    { name: `The note being written: ${title} (/${ask.note}.md)`, text: marked(ask.body, from, to) || HERE, tokens: 4000, role: "user" },
    { name: "The artifact you wrote before", text: ask.fix ? ask.fix.html : "", tokens: 12000, role: "user" },
    { name: "What to do", text: what, tokens: 900, role: "user" },
  ]);
  return { messages, seen, sources, job: ask.mode === "ask" ? "discuss" : "write" };
}

/** Read a fill's reply: the text proposed, and why. */
export function parseFill(reply: string): { insert: string | null; why: string } {
  const ins = /<insert>\n?([\s\S]*?)\n?<\/insert>/i.exec(reply);
  const why = /<why>\n?([\s\S]*?)\n?<\/why>/i.exec(reply);
  if (!ins) return { insert: null, why: reply.trim() };
  const text = ins[1]!.replace(new RegExp(`${OPEN}HERE${CLOSE}|${OPEN}|${CLOSE}`, "g"), "");
  return { insert: text.trim() ? text : null, why: (why?.[1] ?? "").trim() };
}

/** Read a figure's reply: the artifact, its title and caption, and why. */
export function parseFigure(reply: string): { artifact: { title: string; caption: string; html: string } | null; why: string } {
  const part = (tag: string) => new RegExp(`<${tag}>\\n?([\\s\\S]*?)\\n?<\\/${tag}>`, "i").exec(reply)?.[1]?.trim() ?? "";
  // The file holds its own <title>: the first one in the reply is ours, before <artifact>.
  const lead = reply.split(/<artifact>/i)[0] ?? "";
  const title = /<title>\n?([\s\S]*?)\n?<\/title>/i.exec(lead)?.[1]?.trim() ?? "";
  const body = /<artifact>\n?([\s\S]*)\n?<\/artifact>/i.exec(reply)?.[1]?.trim() ?? "";
  const html = body.replace(/^```(?:html)?\n/, "").replace(/\n```$/, "");
  if (!/<(html|body|script|svg|canvas|div|p)\b/i.test(html)) return { artifact: null, why: part("why") || reply.trim() };
  return { artifact: { title: title || /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() || "Figure", caption: part("caption"), html }, why: part("why") };
}

/** Ask, streaming the reply's text. Nothing is kept but the usage. */
export async function ask(cfg: Config, a: Ask, onText?: (piece: string) => void): Promise<{ reply: Reply; seen: Seen[] }> {
  const p = prepare(cfg, a);
  const r = await models.complete({ cfg, job: p.job, feature: a.mode === "ask" ? "note-ask" : a.mode === "figure" ? "note-figure" : "note-fill", messages: p.messages, onText,
    maxTokens: a.mode === "ask" ? 900 : a.mode === "figure" ? 8000 : 2000 });
  const from = Math.min(a.from, a.to), to = Math.max(a.from, a.to);
  const base = { mode: a.mode, reply: r.text, from, to, sources: p.sources, model: r.usage.model, cost: r.usage.cost };
  if (a.mode === "ask") return { reply: { ...base, answer: r.text.trim(), insert: null }, seen: p.seen };
  if (a.mode === "figure") { const f = parseFigure(r.text); return { reply: { ...base, answer: f.why, insert: null, artifact: f.artifact }, seen: p.seen }; }
  const { insert, why } = parseFill(r.text);
  return { reply: { ...base, answer: why, insert }, seen: p.seen };
}
