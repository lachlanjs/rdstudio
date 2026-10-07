// Calling models for the teacher (T50), through OpenRouter: the key, the
// model for each job, a usage log of every call by feature, and a weekly
// budget. Only `rdstudio serve` and the command line call these; the key never
// reaches the browser. See knowledge/design/tutor.md.
//
// User configuration (~/.config/rdstudio/config.toml):
//   [teacher]
//   weekly_budget = 10            # US dollars a week, all projects together
//   [teacher.models]
//   hint = "google/gemini-3.8-flash"
//   feedback = "anthropic/claude-sonnet-5.5"
//   discuss = "anthropic/claude-sonnet-5.5"
//   marking = "anthropic/claude-sonnet-5.5"
//   write = "anthropic/claude-sonnet-5.5"
// The key: OPENROUTER_API_KEY, or the file written by connecting from the
// Teacher page (~/.config/rdstudio/openrouter.key, readable only by you).

import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readToml, userConfigPath, type Config, type Table } from "./config.ts";
import * as learner from "./learner.ts";

/** OpenRouter's API (RDSTUDIO_OPENROUTER_URL points it elsewhere, for tests). */
export const OPENROUTER = process.env.RDSTUDIO_OPENROUTER_URL || "https://openrouter.ai/api/v1";
export const JOBS = ["hint", "feedback", "discuss", "marking", "write", "check"] as const;
export type Job = (typeof JOBS)[number];
export const DEFAULT_MODELS: Record<Job, string> = {
  hint: "google/gemini-3.8-flash",
  feedback: "anthropic/claude-sonnet-5.5",
  discuss: "anthropic/claude-sonnet-5.5",
  marking: "anthropic/claude-sonnet-5.5",
  write: "anthropic/claude-sonnet-5.5", // text proposed in the note editor (assist.ts)
  check: "google/gemini-3.8-flash",
};
export const DEFAULT_WEEKLY_BUDGET = 10;
/** Warn once this share of the week's budget is spent. */
export const WARN_AT = 0.8;

export class ModelError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) { super(message); this.status = status; }
}

// Tests swap the network out.
let fetcher: typeof fetch = (...a) => fetch(...a);
export function setFetch(f: typeof fetch): void { fetcher = f; }

// ------------------------------------------------------------------ settings and the key

const table = (v: unknown): Table => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Table) : {});
const teacherSettings = (): Table => table(readToml(userConfigPath()).teacher);

export function models(): Record<Job, string> {
  const set = table(teacherSettings().models);
  return Object.fromEntries(JOBS.map((j) => [j, typeof set[j] === "string" && set[j] ? (set[j] as string) : DEFAULT_MODELS[j]])) as Record<Job, string>;
}

export function weeklyBudget(): number {
  const b = teacherSettings().weekly_budget;
  return typeof b === "number" && b >= 0 ? b : DEFAULT_WEEKLY_BUDGET;
}

export const keyFile = (): string => join(dirname(userConfigPath()), "openrouter.key");

export function apiKey(): { key: string; from: "environment" | "file" } | null {
  const env = process.env.OPENROUTER_API_KEY;
  if (env) return { key: env.trim(), from: "environment" };
  try {
    const k = readFileSync(keyFile(), "utf8").trim();
    return k ? { key: k, from: "file" } : null;
  } catch {
    return null;
  }
}

export function saveKey(key: string): void {
  if (!/^[\x21-\x7e]{10,300}$/.test(key)) throw new ModelError("that is not a key", 400);
  mkdirSync(dirname(keyFile()), { recursive: true });
  writeFileSync(keyFile(), key + "\n", { encoding: "utf8", mode: 0o600 });
  chmodSync(keyFile(), 0o600);
}

export function forgetKey(): void {
  if (existsSync(keyFile())) unlinkSync(keyFile());
}

// ------------------------------------------------------------------ usage and budget
// One log for every project (the budget is the developer's, not a project's):
// learners/usage.jsonl, beside the records, never in a repository.

export interface Usage {
  at: string;
  project: string;
  feature: string; // the job, or a later feature's own name
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  cost: number; // US dollars (OpenRouter credits)
  exercise?: string;
}

export const usageFile = (): string => join(learner.learnersRoot(), "usage.jsonl");

export function usageLog(): Usage[] {
  try {
    return readFileSync(usageFile(), "utf8").split("\n").filter(Boolean).flatMap((l) => {
      try { return [JSON.parse(l) as Usage]; } catch { return []; }
    });
  } catch {
    return [];
  }
}

function logUsage(u: Usage): void {
  mkdirSync(dirname(usageFile()), { recursive: true });
  appendFileSync(usageFile(), JSON.stringify(u) + "\n", "utf8");
}

/** The start of this week (Monday, 00:00 local time). */
export function weekStart(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export interface Spending {
  budget: number;
  spent: number; // this week, every project
  left: number;
  warn: boolean;
  stopped: boolean;
  weekStart: string;
  /** This week's spending, by feature, model and exercise (this project's for exercises). */
  byFeature: Record<string, number>;
  byModel: Record<string, number>;
  byExercise: Record<string, number>;
  calls: number;
}

export function spending(cfg: Config | null, now = Date.now()): Spending {
  const since = weekStart(now);
  const week = usageLog().filter((u) => Date.parse(u.at) >= since);
  const project = cfg ? learner.projectId(cfg.root) : null;
  const add = (to: Record<string, number>, k: string, v: number) => { to[k] = (to[k] ?? 0) + v; };
  const byFeature: Record<string, number> = {}, byModel: Record<string, number> = {}, byExercise: Record<string, number> = {};
  let spent = 0;
  for (const u of week) {
    spent += u.cost;
    add(byFeature, u.feature, u.cost);
    add(byModel, u.model, u.cost);
    if (u.exercise && u.project === project) add(byExercise, u.exercise, u.cost);
  }
  const budget = weeklyBudget();
  return { budget, spent, left: Math.max(0, budget - spent), warn: spent >= budget * WARN_AT, stopped: spent >= budget, weekStart: new Date(since).toISOString(),
    byFeature, byModel, byExercise, calls: week.length };
}

// ------------------------------------------------------------------ calling

export interface Message {
  role: "system" | "user" | "assistant";
  /** Text, or parts (a part marked cache: true asks providers that support it to cache up to there). */
  content: string | { text: string; cache?: boolean }[];
}

export interface Call {
  cfg: Config;
  job: Job;
  feature?: string; // defaults to the job
  messages: Message[];
  maxTokens?: number;
  exercise?: string;
  /** Called with each piece of text as it streams. */
  onText?: (piece: string) => void;
  signal?: AbortSignal;
}

export interface Reply {
  text: string;
  usage: Usage;
}

const wire = (m: Message) => ({
  role: m.role,
  content: typeof m.content === "string" ? m.content
    : m.content.map((p) => ({ type: "text", text: p.text, ...(p.cache ? { cache_control: { type: "ephemeral" } } : {}) })),
});

/** Call the model for a job, streaming; the usage is logged and the budget kept. */
export async function complete(call: Call): Promise<Reply> {
  const k = apiKey();
  if (!k) throw new ModelError("No OpenRouter key: connect an account on the Teacher page, or set OPENROUTER_API_KEY.", 409);
  const s = spending(call.cfg);
  if (s.stopped) throw new ModelError(`This week's budget ($${s.budget.toFixed(2)}) is spent. It renews on Monday; [teacher] weekly_budget in the user config changes it.`, 402);
  const model = models()[call.job];
  const res = await fetcher(`${OPENROUTER}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${k.key}`, "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/lachlanjs/rdstudio", "X-Title": "rdstudio",
    },
    body: JSON.stringify({ model, messages: call.messages.map(wire), stream: true, ...(call.maxTokens ? { max_tokens: call.maxTokens } : {}) }),
    signal: call.signal,
  });
  if (!res.ok || !res.body) {
    let detail = "";
    try { detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? ""; } catch { /* none */ }
    throw new ModelError(`OpenRouter said ${res.status}${detail ? `: ${detail}` : ""}`, res.status === 401 ? 409 : 502);
  }
  // Server-sent events: data lines of JSON chunks, the last carrying the usage.
  let text = "", usage: Record<string, unknown> | null = null, buffer = "";
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let chunk: { choices?: { delta?: { content?: string } }[]; usage?: Record<string, unknown>; error?: { message?: string } };
      try { chunk = JSON.parse(data); } catch { continue; }
      if (chunk.error) throw new ModelError(`OpenRouter: ${chunk.error.message ?? "an error"}`);
      const piece = chunk.choices?.[0]?.delta?.content;
      if (piece) { text += piece; call.onText?.(piece); }
      if (chunk.usage) usage = chunk.usage;
    }
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const details = table(usage?.prompt_tokens_details);
  const u: Usage = {
    at: new Date().toISOString(), project: learner.projectId(call.cfg.root), feature: call.feature ?? call.job, model,
    prompt_tokens: num(usage?.prompt_tokens), completion_tokens: num(usage?.completion_tokens), cached_tokens: num(details.cached_tokens),
    cost: num(usage?.cost), ...(call.exercise ? { exercise: call.exercise } : {}),
  };
  logUsage(u);
  return { text, usage: u };
}
