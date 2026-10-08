// The one loop Axis runs on (T100), wherever it is asked from: beside a note
// (assist.ts) or on the Atlas (atlasask.ts). The model is asked; each tool it
// calls is run and answered; it is asked again, until it replies or its
// rounds are used. The tools come in boxes: looking things up (lookup.ts) is
// one, and what a surface may do besides is another, so a tool is written
// once and offered wherever its box is passed.

import { estimate, size } from "./context.ts";
import type { Step } from "./lookup.ts";
import * as models from "./models.ts";

/** A set of tools, and the running of them. */
export interface Toolbox {
  /** The tools to offer now. */
  defs(): models.ToolDef[];
  /** Run one call: the text that goes back to the model, and the step kept of it. */
  call(name: string, raw: string): Promise<{ text: string; step: Step }>;
}

/** Something the model was given, shown under its reply. */
export interface Source {
  kind: "note" | "code";
  id: string; // a note's id, or a file's path
  title: string;
  line?: number;
}

/** What a request used, over all its rounds: calls to the model, and tokens sent (of which read from the cache) and written. */
export interface Spent { calls: number; input: number; output: number; cached: number }

export interface Hooks {
  /** Each piece of the reply's text as it is written. */
  onText?: (piece: string) => void;
  /** Each thing it does with a tool, as it does. What was written before one is not the reply: text starts again after it. */
  onStep?: (step: Step) => void;
  signal?: AbortSignal;
}

/** How many times it may use its tools before it must reply, by tier. */
export const ROUNDS: Record<models.Tier, number> = { low: 3, mid: 6, max: 8 };

/** Said only where notes can be searched by meaning (T89). */
export const BY_MEANING = `
- find_similar finds notes by meaning, in other words than theirs. It is
  second: use it when search_notes and the links of the notes in hand have
  not found what you need.`;

/** How to look things up in the code, and the rules of the rounds: the same words wherever Axis is asked. */
export const LOOKING = (rounds: number) => `- For code: search_symbols finds functions and classes by what they are
  for, when you do not know the name; outline_code lists what a folder or a
  file holds; search_code finds exact text; read_code reads lines. Quote
  code only as you read it.
- You may call several tools at once. You have ${rounds} rounds of looking
  up at most; then reply in the form asked, with what you have.
- Say nothing between lookups: no "let me check". Only the reply is shown.`;

/** A model, or the provider it is routed to, that cannot call tools says so; then it is given what it would have looked up. */
const noTools = (err: unknown) => err instanceof models.ModelError && /\btools?\b|tool_choice|function.?call/i.test(err.message) && /support|not available|no endpoints|invalid|unknown|unrecognized|not allowed|not permitted|unexpected|extra|disabled/i.test(err.message);

/** Under an input limit: what a tool's answer ends with when it was cut to fit, or when little room is left. */
const FULL = "\n[…cut: the input limit set for this tier is reached. Nothing more can be looked up: reply now, in the form asked, with what you have.]";
const NEARLY = "\n[The input limit set for this tier is nearly reached. Nothing more can be looked up: reply now, in the form asked, with what you have.]";
/** Tokens kept back for those words. */
const STOP_ROOM = 60;

export interface Run {
  call: Omit<models.Call, "messages" | "tools" | "toolChoice">;
  messages: models.Message[];
  /** The tools it may use: the first box that offers a tool runs it. */
  boxes: Toolbox[];
  tier: models.Tier;
  onStep?: (step: Step) => void;
  /** What to send in place of the request for a model that cannot call tools. */
  gathered: () => models.Message[];
  /** The most tokens to send in one call (T110): what the tools answer is cut to fit, and the rounds end early when it is nearly reached. */
  inputLimit?: number | null;
}

export interface Ran { text: string; cost: number; model: string; spent: Spent; /** Every step, in the order made, across the boxes. */ steps: Step[];
  /** The reply stopped at the output limit: how many tokens that was. */ cut?: number;
  /** The rounds ended early, at the input limit: how many tokens that is. */ full?: number }

/** The rounds: the model is asked, each tool it calls is run and answered, and it is asked again,
 *  until it replies or the tier's rounds are used, when it must reply. */
export async function rounds(o: Run): Promise<Ran> {
  const messages = [...o.messages], most = ROUNDS[o.tier];
  const offered = o.boxes.map((box) => ({ box, names: new Set(box.defs().map((d) => d.function.name)) }));
  const tools = o.boxes.flatMap((box) => box.defs());
  const steps: Step[] = [];
  let text = "", cost = 0, used = o.call.model ?? "", cut: number | undefined, full: number | undefined;
  const limit = o.inputLimit ?? 0;
  let sent = messages.reduce((n, m) => n + size(m), 0), last = false;
  const spent: Spent = { calls: 0, input: 0, output: 0, cached: 0 };
  const add = (u: models.Usage) => { spent.calls++; spent.input += u.prompt_tokens; spent.output += u.completion_tokens; spent.cached += u.cached_tokens; };
  // A provider set not to offer tools (provider.ts, tools = false): one call, with the context gathered for it.
  if (!models.provider().tools) { const r = await models.complete({ ...o.call, messages: o.gathered() }); add(r.usage); return { text: r.text, cost: r.usage.cost, model: r.usage.model, spent, steps, ...(r.cut ? { cut: r.cut } : {}) }; }
  for (let round = 0; ; round++) {
    let r: models.Reply;
    try {
      r = await models.complete({ ...o.call, messages, tools, toolChoice: round < most && !last ? "auto" : "none" });
    } catch (err) {
      if (round > 0 || !noTools(err)) throw err;
      r = await models.complete({ ...o.call, messages: o.gathered() });
      r.calls = [];
    }
    cost += r.usage.cost; used = r.usage.model; text = r.text; cut = r.cut;
    add(r.usage);
    if (!r.calls.length || round >= most || last) break;
    const said: models.Message = { role: "assistant", content: r.text, calls: r.calls };
    messages.push(said);
    sent += size(said);
    for (const c of r.calls) {
      // A tool no box offers is answered by the first, which says there is none.
      const box = (offered.find((x) => x.names.has(c.name)) ?? offered[0]!).box;
      let { text: out, step } = await box.call(c.name, c.arguments);
      if (limit) {
        // What is left under the limit, less room for it to be told to stop and for the calls still to answer.
        const room = Math.max(0, limit - sent - STOP_ROOM);
        if (estimate(out) > room) { out = out.slice(0, room * 4).trimEnd() + FULL; last = true; full = limit; }
        else if (limit - sent - estimate(out) < Math.max(STOP_ROOM * 2, limit * 0.1)) { out += NEARLY; last = true; full = limit; }
      }
      messages.push({ role: "tool", callId: c.id, content: out });
      sent += estimate(out);
      steps.push(step);
      o.onStep?.(step);
    }
  }
  return { text, cost, model: used, spent, steps, ...(cut ? { cut } : {}), ...(full ? { full } : {}) };
}

/** What to tell the person when a limit shaped the reply (T110): said under it, and kept with it. */
export function notices(r: { cut?: number; full?: number }, tier: models.Tier): string[] {
  const out: string[] = [];
  if (r.full) out.push(`It stopped looking things up at the input limit set for the ${tier} tier (${r.full} tokens), so the reply rests on what it had read by then. Limits are on the Teacher page.`);
  if (r.cut) out.push(models.limits()[tier].output
    ? `The reply was cut off at the output limit set for the ${tier} tier (${r.cut} tokens). Raise it on the Teacher page, or ask for less at once.`
    : `The reply was cut off at ${r.cut} tokens, the most rdstudio asks for here. Ask for less at once, or set an output limit for the ${tier} tier on the Teacher page.`);
  return out;
}

/** The code read, from the steps: each file and line once. */
export function codeRead(steps: Step[]): Source[] {
  const out: Source[] = [];
  for (const s of steps) if (!s.failed && s.tool === "read_code" && s.code && !out.some((x) => x.id === s.code!.path && x.line === s.code!.line)) out.push({ kind: "code", id: s.code.path, title: s.code.path, line: s.code.line });
  return out;
}
