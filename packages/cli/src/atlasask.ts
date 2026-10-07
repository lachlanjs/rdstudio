// Ask Atlas (T85): a question asked on the map of the notes, answered from
// the knowledge base and the code. The model looks things up for itself, as
// it does in the editor (T84), and each lookup is kept as a step; here the
// steps are what the map draws. It says which notes its answer rests on,
// each with a sentence copied from the note, and a sentence that is not in
// the note is not shown as one. Nothing is written.

import { loadBundle } from "@rdstudio/core/node";
import type { Bundle } from "@rdstudio/core";
import { BY_MEANING, ROUNDS, rounds, type Source } from "./assist.ts";
import * as embed from "./embed.ts";
import type { Config } from "./config.ts";
import { assemble, type Seen } from "./context.ts";
import { Lookup, noteId, type How, type Step } from "./lookup.ts";
import * as models from "./models.ts";
import { StoreError } from "./store.ts";

export interface Question {
  question: string;
  /** Where the asker is on the map: a note's id, or a folder. Left out, the whole map. */
  start?: string;
  tier?: models.Tier;
}

/** A note the answer rests on. */
export interface Used {
  note: string;
  title: string;
  section?: string;
  /** A sentence of the note the answer rests on; where the model's was not found in the note, the start of what it read. */
  quote: string;
  /** The quote is in the note, word for word. */
  checked: boolean;
  /** How the note was first reached: named by a search and opened, or by a link from a note in hand. */
  how: How;
  from?: string;
}

export interface Answer {
  question: string;
  answer: string;
  used: Used[];
  steps: Step[];
  /** Code it read. */
  code: Source[];
  model: string;
  tier: models.Tier;
  cost: number;
}

export const MAX_QUESTION = 2000, MAX_USED = 8;

const HOW = `You answer questions about a project from its knowledge base (Open
Knowledge Format: Markdown notes with links between them) and from the
repository's code. The question is asked on the Atlas, the app's map of the
notes; the notes you open are lit on the map as you go, so the asker sees
where the answer comes from.

- Work only from what you look up with the tools. Do not invent facts,
  names, file paths or code. If what you find does not answer, say so
  plainly and say what was missing.
- Link to a note as [its title](/its/path.md), with the path as given.
  Refer to code as \`path:line\`, in backticks, not as a link.
- Plain words. No preamble, no closing remarks.
- Maths goes between dollar signs, as LaTeX.`;

const LOOKUP = (rounds: number, meaning: boolean) => `Nothing has been looked up for you. Look first, then answer.

- search_notes finds notes by their words; outline_note shows a note's
  headings and what it links to; read_note reads one section. Prefer one
  section to a whole note.
- When what you need is one step on from a note you have open, follow its
  link: open the linked note, do not search for it again.${meaning ? BY_MEANING : ""}
- Read a note before you rest a claim on it: a search's one line is not
  enough.
- For code: search_symbols finds functions and classes by what they are
  for, when you do not know the name; outline_code lists what a folder or a
  file holds; search_code finds exact text; read_code reads lines. Quote
  code only as you read it.
- You may call several tools at once. You have ${rounds} rounds of looking
  up at most; then reply in the form asked, with what you have.
- Say nothing between lookups: no "let me check". Only the reply is shown.`;

const FORM = `Reply in exactly this form and nothing else:

<answer>
The answer, in Markdown: a few short paragraphs or a short list.
</answer>
<used>
- /path/of/note.md | the heading you read | "one sentence copied from the note, word for word, that the answer rests on"
</used>

In <used>, one line for each note the answer rests on, the most important
first, ${MAX_USED} at most. Only notes you opened. Leave the heading empty if you read
the whole note. A note you opened and did not use is left out.`;

const GIVEN = `You cannot look things up, so what a search found for the question is
below, under "Looked up for you". Work only from that.`;

/** Where the asker is, in words for the model; and the note to start the chain from, if it is one. */
function place(b: Bundle, start: string | undefined): { text: string; note: string } {
  const raw = (start ?? "").trim().replace(/^\/+|\/+$/g, "").replace(/\.md$/i, "");
  const id = raw ? noteId(b, raw) : null;
  if (id) {
    const c = b.concepts.get(id)!;
    const links = [...new Set(c.links.filter((l) => !l.broken).map((l) => l.target))].slice(0, 40);
    return { note: id, text: [`They have this note selected: ${c.title} (/${id}.md)${c.description ? `: ${c.description}` : ""}`, "The question may be about it. It is not open: read it if you need it.",
      links.length ? `It links to:\n${links.map((i) => `- ${b.concepts.get(i)?.title ?? i} (/${i}.md)`).join("\n")}` : ""].filter(Boolean).join("\n\n") };
  }
  const inside = raw ? [...b.concepts.values()].filter((c) => c.id.startsWith(raw + "/")) : [];
  if (inside.length) {
    return { note: "", text: `They are looking at the folder ${raw}/ (${inside.length} notes), so the question is most likely about what is in it; search_notes takes \`under\` to search only there. Its notes:\n` +
      inside.slice(0, 60).map((c) => `- ${c.title} (/${c.id}.md)`).join("\n") + (inside.length > 60 ? `\n[…and ${inside.length - 60} more]` : "") };
  }
  const tops = new Map<string, number>();
  for (const c of b.concepts.values()) { const top = c.id.includes("/") ? c.id.slice(0, c.id.indexOf("/")) : "(top)"; tops.set(top, (tops.get(top) ?? 0) + 1); }
  return { note: "", text: `They are looking at the whole map: ${b.concepts.size} notes. Its folders: ${[...tops].map(([k, n]) => `${k} (${n})`).join(", ")}.` };
}

export interface Prepared { messages: models.Message[]; seen: Seen[]; note: string }

/** Build the request: nothing is sent. With `given`, for a model that cannot call tools, what was looked up for it. */
export function prepare(cfg: Config, q: Question, b: Bundle = loadBundle(cfg.knowledgeDir), given = ""): Prepared {
  const question = (q.question ?? "").trim();
  if (!question) throw new StoreError("ask a question");
  if (question.length > MAX_QUESTION) throw new StoreError(`that question is too long (${question.length} characters; ${MAX_QUESTION} at most)`);
  const where = place(b, q.start);
  const { messages, seen } = assemble([
    { name: "How to help", text: HOW, tokens: 500 },
    { name: "Looking things up", text: given ? GIVEN : LOOKUP(ROUNDS[q.tier ?? "mid"], embed.available()), tokens: 500 },
    { name: "Your reply", text: FORM, tokens: 400, cache: true },
    { name: "Where they are on the map", text: where.text, tokens: 1500, role: "user" },
    { name: "Looked up for you", text: given, tokens: 6000, role: "user" },
    { name: "Their question", text: question, tokens: 700, role: "user", cache: true },
  ]);
  return { messages, seen, note: where.note };
}

const flat = (s: string) => s.replace(/[*_`~]|\[\^[^\]]*\]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

/** A sentence as plain words: a link as its text, without Markdown's marks. */
const plain = (s: string) => s.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[\^[^\]]*\]/g, "").replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();

/** Read the reply: the answer, and the notes it says it rests on, each checked against what was looked up. */
export function parseAnswer(reply: string, b: Bundle, steps: Step[]): { answer: string; used: Used[] } {
  const inAnswer = /<answer>\n?([\s\S]*?)\n?<\/answer>/i.exec(reply)?.[1];
  const answer = (inAnswer ?? reply.replace(/<used>[\s\S]*$/i, "").replace(/<\/?answer>/gi, "")).trim();
  const good = steps.filter((s) => !s.failed);
  const seenNotes = new Set(good.flatMap((s) => s.notes));
  // Named by a search by meaning before any search of words named it.
  const byMeaning = new Set<string>(), byWords = new Set<string>();
  for (const s of good) for (const id of s.opened ? [] : s.notes) { if (s.how === "meaning" && !byWords.has(id)) byMeaning.add(id); else if (s.how === "search") byWords.add(id); }
  const used: Used[] = [];
  const add = (raw: string, section: string, quote: string) => {
    const id = noteId(b, raw);
    // A note it never looked at is not one the answer can rest on.
    if (!id || !seenNotes.has(id) || used.some((u) => u.note === id) || used.length >= MAX_USED) return;
    const c = b.concepts.get(id)!;
    const opened = good.filter((s) => s.opened === id), first = opened[0], read = opened.filter((s) => s.tool === "read_note");
    const said = quote.trim().replace(/^["“']+|["”']+$/g, "").trim();
    const checked = said.length >= 12 && flat(c.body + " " + c.description).includes(flat(said));
    const fallback = (read.find((s) => section && s.section?.toLowerCase() === section.toLowerCase()) ?? read.at(-1))?.excerpt || c.description || "";
    const heading = section.replace(/^#+\s*/, "").trim();
    used.push({ note: id, title: c.title, ...(heading ? { section: heading } : {}), quote: checked ? plain(said) : fallback, checked,
      how: first ? (first.how === "link" ? "link" : first.how === "meaning" ? "meaning" : "search") : byMeaning.has(id) ? "meaning" : "search", ...(first?.from ? { from: first.from } : {}) });
  };
  const block = /<used>\n?([\s\S]*?)(?:<\/used>|$)/i.exec(reply)?.[1] ?? "";
  for (const line of block.split("\n")) {
    const m = /^\s*[-*]?\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*(.*?)\s*$/.exec(line);
    if (m) add(m[1]!, m[2]!, m[3]!);
  }
  // A note linked in the answer is rested on too, whether or not it was listed.
  for (const m of answer.matchAll(/\]\((\/[^)\s#]+?)(?:#[^)\s]*)?(?:\s+"[^"]*")?\)/g)) add(m[1]!, "", "");
  return { answer, used };
}

export interface Hooks { onText?: (piece: string) => void; onStep?: (step: Step) => void; signal?: AbortSignal }

/** Ask, streaming the answer's text and each lookup as it is made. Nothing is kept but the usage. */
export async function ask(cfg: Config, q: Question, hooks: Hooks = {}): Promise<{ answer: Answer; seen: Seen[] }> {
  const tier = q.tier ?? "mid", model = models.tiers()[tier];
  const b = loadBundle(cfg.knowledgeDir);
  let p = prepare(cfg, { ...q, tier }, b);
  const look = new Lookup(cfg, b, p.note);
  const { text, cost, model: used } = await rounds({
    call: { cfg, job: "discuss", feature: "atlas-ask", onText: hooks.onText, model, maxTokens: 1600, signal: hooks.signal },
    messages: p.messages, look, tier, onStep: hooks.onStep,
    // A model that cannot call tools: the search is made for it, and the three notes it finds first are read.
    gathered: () => {
      const out = [look.run("search_notes", JSON.stringify({ query: q.question, limit: 6 }))];
      hooks.onStep?.(look.steps.at(-1)!);
      for (const id of [...new Set([...(p.note ? [p.note] : []), ...look.steps[0]!.notes])].slice(0, 3)) {
        out.push(look.run("read_note", JSON.stringify({ id })));
        hooks.onStep?.(look.steps.at(-1)!);
      }
      return (p = prepare(cfg, { ...q, tier }, b, out.join("\n\n"))).messages;
    },
  });
  const code: Source[] = [];
  for (const s of look.steps) if (!s.failed && s.tool === "read_code" && s.code && !code.some((x) => x.id === s.code!.path && x.line === s.code!.line)) code.push({ kind: "code", id: s.code.path, title: s.code.path, line: s.code.line });
  return { answer: { question: q.question.trim(), ...parseAnswer(text, b, look.steps), steps: look.steps, code, model: used, tier, cost }, seen: p.seen };
}
