// Work together (T51): the developer writes an answer with the teacher
// alongside. Each request (a hint, feedback, or a discussion) keeps a version
// of the draft as sent, asks the model with the exercise, its notes and the
// draft as context, and keeps the reply as a turn pinned to passages of that
// version. The teaching style is the `tutor` skill (customisable); the reply's
// form is fixed here, because the pins are read from it. See design/tutor.md.

import { LearnerError, splitSolution, type Bundle } from "@rdstudio/core";
import { loadBundle } from "@rdstudio/core/node";
import { notices } from "./agent.ts";
import type { Config } from "./config.ts";
import { assemble, type Seen } from "./context.ts";
import * as models from "./models.ts";
import * as teacher from "./teacher.ts";

export const MODES = ["hint", "feedback", "discuss"] as const;
export type Mode = (typeof MODES)[number];
export const COLOURS = ["red", "green", "blue", "hint"] as const;
export type Colour = (typeof COLOURS)[number];
export const HINT_RUNGS = 3;

export interface Pin {
  colour: Colour;
  quote: string;
  /** Where the quote is in the version sent, or null when it could not be found. */
  from: number | null;
  to: number | null;
  comment: string;
}

export interface Turn {
  id: string; // t1, t2, …
  at: string;
  mode: Mode;
  rung: number | null; // hints: 1 to HINT_RUNGS
  prompt: string | null; // discussion: what the developer asked
  selection: string | null; // discussion: the passage they highlighted
  confidence: string | null; // feedback: how sure they were
  version: string; // the draft version sent
  reply: string; // as the model wrote it
  general: string; // the reply outside any pin
  pins: Pin[];
  model: string;
  cost: number;
}

// ------------------------------------------------------------------ the reply's form

const FORM = `# How to write your reply

Point at the developer's draft by quoting it exactly, word for word, on a
line of its own that starts with a marker, then say what you have to say
about it on the lines after:

[red] "exact words from the draft"
What is wrong or missing there, and why it matters.

[green] "exact words from the draft"
What is right there, and why.

[blue] "exact words from the draft"
In a discussion: what this passage has to do with the question.

[hint] "exact words from the draft"
In a hint: where the next step goes (optional).

Quote only a few words, enough to find the place. Never quote the
solution. Anything before the first marker is a general reply. Use LaTeX
between dollar signs for maths.`;

const MODE_ASK: Record<Mode, (t: Partial<Turn>) => string> = {
  hint: (t) => {
    const rung = t.rung ?? 1;
    const what = rung === 1 ? "one word or a short phrase naming the idea the next step needs"
      : rung === 2 ? "one sentence pointing in the direction of the next step, without taking it"
      : "at most two sentences saying what the next step is, without doing it";
    return `Give a hint, rung ${rung} of ${HINT_RUNGS}: ${what}. Use at most one [hint] pin. Nothing else.`;
  },
  feedback: (t) => `Give feedback on the draft as it stands: name its aspects with [red] and [green] pins, two to five in all, `
    + `each with a sentence or two. There may be no red or no green. Do not write the answer for them.`
    + (t.confidence ? ` Before asking, they said they were ${t.confidence} of it.` : ""),
  discuss: (t) => `Answer the developer's question below, linking the parts of their draft it bears on with [blue] pins. Keep it short.`,
};

/** Read the pins from a reply in the form above, and find each quote in the draft. */
export function parseReply(reply: string, draft: string): { general: string; pins: Pin[] } {
  const pins: Pin[] = [];
  const general: string[] = [];
  let current: Pin | null = null;
  for (const line of reply.split("\n")) {
    const m = /^\s*\[(red|green|blue|hint)\]\s*[“"](.+?)[”"]\s*:?\s*(.*)$/i.exec(line);
    if (m) {
      const quote = m[2]!.trim();
      const at = locate(draft, quote);
      current = { colour: m[1]!.toLowerCase() as Colour, quote, from: at?.from ?? null, to: at?.to ?? null, comment: m[3]!.trim() };
      pins.push(current);
    } else if (current) current.comment = (current.comment + "\n" + line).trim();
    else general.push(line);
  }
  return { general: general.join("\n").trim(), pins };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Where `quote` is in `text`: exactly, or with any run of spaces taken as any other. */
export function locate(text: string, quote: string): { from: number; to: number } | null {
  if (!quote) return null;
  const at = text.indexOf(quote);
  if (at >= 0) return { from: at, to: at + quote.length };
  const words = quote.split(/\s+/).filter(Boolean).map(escape);
  if (!words.length) return null;
  const m = new RegExp(words.join("\\s+")).exec(text);
  return m ? { from: m.index, to: m.index + m[0].length } : null;
}

// ------------------------------------------------------------------ context

const exerciseDir = (id: string) => (id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : "");

function noteContext(b: Bundle, exercise: string): { tested: string; around: string } {
  const c = b.concepts.get(exercise)!;
  const refs = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).map(String)
    .map((r) => { let x = r.replace(/\.md$/, "").replace(/#.*$/, ""); if (!x.startsWith("/")) x = (exerciseDir(exercise) ? exerciseDir(exercise) + "/" : "") + x; return x.replace(/^\/+/, ""); })
    .filter((id) => b.concepts.has(id));
  const tested = refs(c.meta.tests);
  const graph = b.requiresGraph();
  const around = new Set<string>();
  for (const t of tested) for (const r of graph.get(t) ?? []) if (!tested.includes(r)) around.add(r);
  return {
    tested: tested.map((id) => { const n = b.concepts.get(id)!; return `### ${n.title}\n\n${n.body.trim()}`; }).join("\n\n"),
    around: [...around].map((id) => { const n = b.concepts.get(id)!; return `- ${n.title}${n.description ? `: ${n.description}` : ""}`; }).join("\n"),
  };
}

/** The profile's struggles that touch these notes (by title), if any. */
function struggles(cfg: Config, titles: string[]): string {
  const p = teacher.readFile(cfg, "profile.md").text ?? "";
  const m = /^#+\s*Struggling\s*$([\s\S]*?)(?=^#+\s|(?![\s\S]))/im.exec(p);
  if (!m) return "";
  const lines = m[1]!.split("\n").filter((l) => l.trim().startsWith("-"));
  const lower = titles.map((t) => t.toLowerCase());
  return lines.filter((l) => lower.some((t) => l.toLowerCase().includes(t))).map((l) => l.replace(/\[e:[0-9A-Z]{26}\]/g, "").trim()).join("\n");
}

export interface Ask {
  exercise: string;
  mode: Mode;
  text: string; // the draft as it is now
  working?: string;
  prompt?: string; // discussion
  selection?: string; // discussion: the highlighted passage
  confidence?: string; // feedback
}

export interface Prepared {
  turn: Omit<Turn, "reply" | "general" | "pins" | "model" | "cost">;
  messages: models.Message[];
  seen: Seen[];
  job: models.Job;
}

/** Keep the version, and build the request: nothing is sent yet. */
export function prepare(cfg: Config, ask: Ask): Prepared {
  if (!(MODES as readonly string[]).includes(ask.mode)) throw new LearnerError(`a mode is one of ${MODES.join(", ")}`);
  const b = loadBundle(cfg.knowledgeDir);
  const ex = b.concepts.get(ask.exercise);
  if (!ex || ex.type !== "Exercise") throw new LearnerError(`${ask.exercise} is not an Exercise note`);
  if (ask.mode === "discuss" && !ask.prompt?.trim() && !ask.selection?.trim()) throw new LearnerError("ask something, or highlight a passage to ask about");
  teacher.saveDraft(cfg, ask.exercise, { text: ask.text, working: ask.working ?? "" });
  const draft = teacher.keepVersion(cfg, ask.exercise, ask.mode);
  const version = draft.versions.at(-1)!.id;
  const turns = teacher.readDraft(cfg, ask.exercise).turns as unknown as Turn[];
  const rung = ask.mode === "hint" ? Math.min(HINT_RUNGS, turns.filter((t) => t.mode === "hint").length + 1) : null;
  const turn = {
    id: `t${turns.length + 1}`, at: new Date().toISOString(), mode: ask.mode, rung,
    prompt: ask.prompt?.trim() || null, selection: ask.selection?.trim() || null, confidence: ask.confidence?.trim() || null, version,
  };
  const { problem, solution } = splitSolution(ex.body);
  const notes = noteContext(b, ask.exercise);
  const skill = teacher.skill(cfg, "tutor")?.text ?? "";
  const earlier = turns.slice(-6).map((t) => `${t.mode}${t.rung ? ` (rung ${t.rung})` : ""}${t.prompt ? `, asked: ${t.prompt}` : ""}:\n${t.reply}`).join("\n\n");
  const { messages, seen } = assemble([
    { name: "How to teach", text: skill, tokens: 2500, cache: true, keep: true },
    { name: "Reply form", text: FORM, tokens: 400, cache: true, keep: true },
    { name: `The exercise: ${ex.title}`, text: problem, tokens: 1500, keep: true },
    { name: "Its solution (for you only; never quote it)", text: solution ?? "(none written)", tokens: 1500, cache: true },
    { name: "The notes it tests", text: notes.tested, tokens: 3000 },
    { name: "What those notes build on", text: notes.around, tokens: 600 },
    { name: "What the developer has found hard here", text: struggles(cfg, [ex.title, ...notes.tested.split("\n").filter((l) => l.startsWith("### ")).map((l) => l.slice(4))]), tokens: 400 },
    { name: "Earlier in this session", text: earlier, tokens: 1500 },
    { name: "The developer's draft", text: draft.text || "(empty so far)", tokens: 3000, role: "user", keep: true },
    { name: "Their working", text: draft.working, tokens: 1500, role: "user" },
    { name: "The passage they highlighted", text: turn.selection ?? "", tokens: 500, role: "user", keep: true },
    { name: "Their question", text: turn.prompt ?? "", tokens: 500, role: "user", keep: true },
    { name: "What to do", text: MODE_ASK[ask.mode](turn), tokens: 300, role: "user", keep: true },
  ], models.limits()[models.tierOf({ job: ask.mode === "hint" ? "hint" : ask.mode })].input);
  return { turn, messages, seen, job: ask.mode === "hint" ? "hint" : ask.mode };
}

/** Ask, streaming the reply's text; the turn is kept with the draft. */
export async function ask(cfg: Config, a: Ask, onText?: (piece: string) => void): Promise<{ turn: Turn; seen: Seen[] }> {
  const p = prepare(cfg, a);
  const reply = await models.complete({ cfg, job: p.job, feature: a.mode, messages: p.messages, exercise: a.exercise, onText,
    maxTokens: a.mode === "hint" ? 200 : 900 });
  const version = teacher.readDraft(cfg, a.exercise).versions.find((v) => v.id === p.turn.version)!;
  const parsed = parseReply(reply.text, version.text), pins = parsed.pins;
  // A reply stopped at the output limit says so (T110): the limit set for the job's tier, or the tutor's own.
  const general = reply.cut ? `${parsed.general}\n\n*${notices({ cut: reply.cut }, models.tierOf({ job: p.job }))[0]}*`.trim() : parsed.general;
  const turn: Turn = { ...p.turn, reply: reply.text, general, pins, model: reply.usage.model, cost: reply.usage.cost };
  teacher.addTurn(cfg, a.exercise, turn as unknown as Record<string, unknown> & { id: string; mode: string });
  return { turn, seen: p.seen };
}

/** How much help an answer had, for its attempt: counts by mode. */
export function helpOf(cfg: Config, exercise: string): Record<Mode, number> | null {
  const turns = teacher.readDraft(cfg, exercise).turns as unknown as Turn[];
  if (!turns.length) return null;
  return { hint: turns.filter((t) => t.mode === "hint").length, feedback: turns.filter((t) => t.mode === "feedback").length, discuss: turns.filter((t) => t.mode === "discuss").length };
}
