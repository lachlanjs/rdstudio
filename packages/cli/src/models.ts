// Calling models for the teacher (T50), through OpenRouter or, where the user
// config names one, an organisation's own gateway (provider.ts): the key, the
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
import { authHeaders, endpoint, explain, forgetToken, ownTransport, priced, provider, providerKey, request, type KeyFrom, type Provider } from "./provider.ts";

export { provider } from "./provider.ts";

/** OpenRouter's API (RDSTUDIO_OPENROUTER_URL points it elsewhere, for tests). */
export const OPENROUTER = process.env.RDSTUDIO_OPENROUTER_URL || "https://openrouter.ai/api/v1";
export const JOBS = ["hint", "feedback", "discuss", "marking", "write", "check"] as const;
export type Job = (typeof JOBS)[number];
export const DEFAULT_MODELS: Record<Job, string> = {
  hint: "google/gemini-3.8-flash",
  feedback: "anthropic/claude-sonnet-5.5",
  discuss: "anthropic/claude-sonnet-5.5",
  marking: "anthropic/claude-sonnet-5.5",
  write: "anthropic/claude-sonnet-5.5", // was the editor's (assist.ts); it goes by tier now (T83), and this is kept so that old settings still read
  check: "google/gemini-3.8-flash",
};
// The editor's agent (assist.ts) does not go by job: the person picks how strong
// a model each request is worth (T83). Three tiers, each a model, set in
// [teacher.tiers] in the user config or from the app.
export const TIERS = ["low", "mid", "max"] as const;
export type Tier = (typeof TIERS)[number];
export const DEFAULT_TIERS: Record<Tier, string> = {
  low: "anthropic/claude-haiku-4.5",
  mid: "anthropic/claude-sonnet-5.5",
  max: "anthropic/claude-opus-5.5",
};
export const DEFAULT_WEEKLY_BUDGET = 10;
/** Warn once this share of the week's budget is spent. */
export const WARN_AT = 0.8;

export class ModelError extends Error {
  readonly status: number;
  /** What the provider sent with a refusal, as it came (the check's --verbose). */
  raw?: string;
  constructor(message: string, status = 502) { super(message); this.status = status; }
}

// Tests swap the network out.
const plainFetch: typeof fetch = (...a) => fetch(...a);
let fetcher: typeof fetch = plainFetch, swapped = false;
/** Put another fetch in the network's place (tests); null puts the network back. */
export function setFetch(f: typeof fetch | null): void { fetcher = f ?? plainFetch; swapped = f !== null; }

// ------------------------------------------------------------------ settings and the key

const table = (v: unknown): Table => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Table) : {});
const teacherSettings = (): Table => table(readToml(userConfigPath()).teacher);

/** The tier a job's model is taken from on a gateway, where the job has none of its own. */
const JOB_TIER: Record<Job, Tier> = { hint: "low", check: "low", feedback: "mid", discuss: "mid", marking: "mid", write: "mid" };

/** Each job's model: [teacher.models]; on a gateway, else the job's tier where [teacher.tiers] sets it (three names
 *  to set, not nine); else rdstudio's own, which are OpenRouter's names. */
export function models(): Record<Job, string> {
  const set = table(teacherSettings().models), tier = provider().custom ? table(teacherSettings().tiers) : {};
  const one = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  return Object.fromEntries(JOBS.map((j) => [j, one(set[j]) ?? one(tier[JOB_TIER[j]]) ?? DEFAULT_MODELS[j]])) as Record<Job, string>;
}

/** On a gateway, the tiers and jobs still at rdstudio's own models, which are OpenRouter's names and are seldom a gateway's. */
export function unnamed(): string[] {
  if (!provider().custom) return [];
  const t = table(teacherSettings().tiers), m = table(teacherSettings().models);
  const has = (v: unknown) => typeof v === "string" && !!v;
  return [...TIERS.filter((k) => !has(t[k])).map((k) => `tier ${k}`), ...JOBS.filter((j) => j !== "write" && !has(m[j]) && !has(t[JOB_TIER[j]])).map((j) => `job ${j}`)];
}
/** Whether a model's name is rdstudio's own and not one set in the user config. */
function ownName(model: string): boolean {
  const s = teacherSettings(), set = [...Object.values(table(s.tiers)), ...Object.values(table(s.models))];
  return !set.includes(model) && [...Object.values(DEFAULT_TIERS), ...Object.values(DEFAULT_MODELS)].includes(model);
}

export function tiers(): Record<Tier, string> {
  const set = table(teacherSettings().tiers);
  return Object.fromEntries(TIERS.map((t) => [t, typeof set[t] === "string" && set[t] ? (set[t] as string) : DEFAULT_TIERS[t]])) as Record<Tier, string>;
}

/** Set the tiers' models in the user config: the [teacher.tiers] table is written whole, the rest of the file left as it is. */
export function setTiers(next: Partial<Record<Tier, string>>): Record<Tier, string> {
  const now = tiers();
  for (const t of TIERS) {
    const m = next[t];
    if (m === undefined) continue;
    const id = String(m).trim();
    // OpenRouter's ids are vendor/model. A gateway names its models as it likes: anything without spaces or quotes.
    const p = provider();
    if (p.custom ? !/^[^\s"'\\]{1,200}$/.test(id) : !/^[\w.-]+\/[\w.:-]+$/.test(id))
      throw new ModelError(p.custom ? `"${id}" is not a model's id: write it as ${p.name} names the model, with no spaces or quotes` : `"${id}" is not a model's id: it is written as OpenRouter lists it, like ${DEFAULT_TIERS[t]}`, 400);
    now[t] = id;
  }
  const path = userConfigPath();
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = text.split("\n");
  const block = ["[teacher.tiers]", ...TIERS.map((t) => `${t} = "${now[t]}"`)];
  const head = lines.findIndex((l) => /^\s*\[teacher\.tiers\]\s*(#.*)?$/.test(l));
  let out: string;
  if (head < 0) out = `${text.replace(/\s*$/, "")}${text.trim() ? "\n\n" : ""}# The models Axis uses in the editor, by how strong a request is worth.\n${block.join("\n")}\n`;
  else {
    let end = lines.findIndex((l, i) => i > head && /^\s*\[/.test(l));
    if (end < 0) end = lines.length;
    while (end > head + 1 && !lines[end - 1]!.trim()) end--; // the blank lines before the next table stay
    lines.splice(head, end - head, ...block);
    out = lines.join("\n");
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, out, "utf8");
  return now;
}

export function weeklyBudget(): number {
  const b = teacherSettings().weekly_budget;
  return typeof b === "number" && b >= 0 ? b : DEFAULT_WEEKLY_BUDGET;
}

export const keyFile = (): string => join(dirname(userConfigPath()), "openrouter.key");

/** The key requests are made with, and where it comes from: the provider's own (provider.ts), or OpenRouter's. Null when there is none. */
export function apiKey(): { key: string; from: KeyFrom } | null {
  const p = provider();
  if (p.custom) { try { return providerKey(p); } catch { return null; } }
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
  role: "system" | "user" | "assistant" | "tool";
  /** Text, or parts (a part marked cache: true asks providers that support it to cache up to there). */
  content: string | { text: string; cache?: boolean }[];
  /** assistant: the tools it called in this turn. */
  calls?: ToolCall[];
  /** tool: the call this is the result of. */
  callId?: string;
}

/** A tool the model may call (T84), as OpenRouter takes it: a function with a JSON schema. */
export interface ToolDef { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }
/** A call the model made: the arguments are JSON, as it wrote them. */
export interface ToolCall { id: string; name: string; arguments: string }

export interface Call {
  cfg: Config;
  job: Job;
  feature?: string; // defaults to the job
  messages: Message[];
  maxTokens?: number;
  /** The model to use, where it is not the job's (a tier's, in the editor). */
  model?: string;
  exercise?: string;
  /** Tools the model may call; what it calls comes back in the reply's `calls`, to be run and answered. */
  tools?: ToolDef[];
  /** With tools: "none" makes it reply without calling one. */
  toolChoice?: "auto" | "none";
  /** Called with each piece of text as it streams. */
  onText?: (piece: string) => void;
  signal?: AbortSignal;
}

export interface Reply {
  text: string;
  usage: Usage;
  /** The tools it called instead of finishing; empty when the reply is whole. */
  calls: ToolCall[];
}

const plain = (m: Message) => (typeof m.content === "string" ? m.content : m.content.map((p) => p.text).join("\n\n"));
/** A message as it is sent. Cache marks are Anthropic's, passed on by OpenRouter; a provider that does not take them is sent plain text. */
const wire = (marks: boolean) => (m: Message) => m.role === "tool" ? { role: "tool", tool_call_id: m.callId ?? "", content: plain(m) }
  : m.role === "assistant" && m.calls?.length ? { role: "assistant", content: plain(m) || null, tool_calls: m.calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments || "{}" } })) }
  : {
    role: m.role,
    content: typeof m.content === "string" || !marks ? plain(m)
      : m.content.map((p) => ({ type: "text", text: p.text, ...(p.cache ? { cache_control: { type: "ephemeral" } } : {}) })),
  };

/** What the provider is called in a message to the person. */
const called = (p: Provider) => (p.custom ? p.name : "OpenRouter");

/** The models a gateway says it offers (GET <url>/models, as the OpenAI API has it); null where it has no such list or does not answer. */
export async function offered(): Promise<string[] | null> {
  const p = provider();
  try {
    const k = p.custom ? providerKey(p) : apiKey();
    if (!k) return null;
    const u = new URL(p.url + "/models");
    for (const [q, v] of Object.entries(p.query)) u.searchParams.set(q, v);
    const { "Content-Type": _none, ...headers } = authHeaders(p, k.key);
    const init = { method: "GET", headers, signal: AbortSignal.timeout(20_000) };
    const res = await (ownTransport(p) && !swapped ? request(p, u.href, init) : fetcher(u.href, init));
    if (!res.ok) return null;
    const j = JSON.parse(await res.text()) as { data?: { id?: unknown }[] } | { id?: unknown }[];
    const ids = (Array.isArray(j) ? j : j.data ?? []).map((m) => m?.id).filter((id): id is string => typeof id === "string");
    return ids.length ? ids : null;
  } catch { return null; }
}

/** Call the model for a job, streaming; the usage is logged and the budget kept. */
export async function complete(call: Call): Promise<Reply> {
  const p = provider();
  let k: { key: string } | null;
  try { k = p.custom ? providerKey(p) : apiKey(); } catch (err) { throw new ModelError((err as Error).message, 409); }
  if (!k) throw new ModelError(p.custom ? `No key for ${p.name}: set ${p.keyEnv ?? "RDSTUDIO_PROVIDER_KEY"}, or key_file or key_command under [teacher.provider] in the user config (or auth = "none", where the gateway wants no key).`
    : "No OpenRouter key: connect an account on the Teacher page, or set OPENROUTER_API_KEY.", 409);
  const s = spending(call.cfg);
  if (s.stopped) throw new ModelError(`This week's budget ($${s.budget.toFixed(2)}) is spent. It renews on Monday; [teacher] weekly_budget in the user config changes it.`, 402);
  const model = call.model || models()[call.job];
  const body = JSON.stringify({ model, messages: call.messages.map(wire(p.cacheMarks)), stream: p.stream, ...(p.stream && p.streamUsage ? { stream_options: { include_usage: true } } : {}),
    ...(call.maxTokens ? { [p.maxTokensField]: call.maxTokens } : {}),
    ...(call.tools?.length && p.tools ? { tools: call.tools, tool_choice: call.toolChoice ?? "auto" } : {}) });
  const send = async (key: string): Promise<Response> => {
    const init = { method: "POST", headers: authHeaders(p, key), body, signal: call.signal };
    try {
      // Authorities, a client certificate or a proxy of the provider's own need more than fetch takes (tests put their own fetch in its place).
      return await (ownTransport(p) && !swapped ? request(p, endpoint(p), init) : fetcher(endpoint(p), init));
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      throw new ModelError(explain(err, p), 502);
    }
  };
  let res = await send(k.key);
  // A token a command gave may have run out: ask the command once more.
  if (res.status === 401 && p.custom && p.keyCommand) {
    forgetToken();
    let again: { key: string } | null = null;
    try { again = providerKey(p); } catch { /* the first refusal is reported */ }
    if (again && again.key !== k.key) res = await send(again.key);
  }
  if (!res.ok || !res.body) {
    let detail = "", raw = "";
    try {
      const said = raw = await res.text();
      try { const j = JSON.parse(said) as { error?: { message?: string } | string; message?: string }; detail = (typeof j.error === "string" ? j.error : j.error?.message) ?? j.message ?? ""; } catch { detail = said.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300); }
    } catch { /* none */ }
    // What to change, by the kind of refusal: one setting each.
    let advice = "";
    if (p.custom) {
      const from = k && "from" in k ? (k as { from: KeyFrom }).from : "none";
      if (res.status === 401) advice = from === "none" ? `No key is sent (auth = "none"), and ${p.name} wants one in a header all the same. Where a client certificate is what says who you are, any value often does: set auth = "bearer" under [teacher.provider], and ${p.keyEnv ?? "RDSTUDIO_PROVIDER_KEY"} in the environment.` : `The key (from ${from === "environment" ? `the environment, ${p.keyEnv ?? "RDSTUDIO_PROVIDER_KEY"}` : from === "file" ? `the file ${p.keyFile}` : "the key command"}) was not accepted: it may have run out, or be sent in the wrong header (auth, auth_header).`;
      else if (res.status === 403) advice = "The key was read but is not allowed this: the model, or the gateway itself, may need access granted to you.";
      else if (res.status === 407) advice = "A proxy on the way wants a sign-in: set proxy under [teacher.provider].";
      else if ((res.status === 404 || res.status === 400) && ownName(model)) advice = `${model} is rdstudio's own choice, an OpenRouter name: set the models as ${p.name} names them under [teacher.tiers] (low, mid, max) in the user config.`;
      else if (res.status === 404) advice = `Either ${p.name} has no model called ${model} (rdstudio provider check lists the ones it offers), or the address is not its chat completions (url and path under [teacher.provider]: ${endpoint(p)}).`;
    }
    const failed = new ModelError(`${called(p)} said ${res.status}${detail ? `: ${detail}` : ""}${advice ? `${detail && !/[.!?]$/.test(detail) ? "." : ""} ${advice}` : ""}`, res.status === 401 || res.status === 403 ? 409 : 502);
    failed.raw = raw.slice(0, 2000);
    throw failed;
  }
  let text = "", usage: Record<string, unknown> | null = null;
  const calls: ToolCall[] = []; // a call arrives in pieces, by its index
  type Called = { index?: number; id?: string; function?: { name?: string; arguments?: string } };
  const take = (list: Called[] | undefined) => {
    for (const t of list ?? []) {
      const c = (calls[t.index ?? 0] ??= { id: "", name: "", arguments: "" });
      if (t.id) c.id = t.id;
      if (t.function?.name) c.name += t.function.name;
      if (t.function?.arguments) c.arguments += t.function.arguments;
    }
  };
  if (!p.stream || (res.headers.get("content-type") ?? "").includes("application/json")) {
    // One reply, whole: asked for (stream = false), or what a gateway that does not stream sent anyway.
    let whole: { choices?: { message?: { content?: string | null; tool_calls?: Called[] } }[]; usage?: Record<string, unknown>; error?: { message?: string } };
    try { whole = JSON.parse(await res.text()); } catch { throw new ModelError(`${called(p)} sent a reply that could not be read`); }
    if (whole.error) throw new ModelError(`${called(p)}: ${whole.error.message ?? "an error"}`);
    text = whole.choices?.[0]?.message?.content ?? "";
    if (text) call.onText?.(text);
    take(whole.choices?.[0]?.message?.tool_calls?.map((t, index) => ({ ...t, index })));
    usage = whole.usage ?? null;
  } else {
    // Server-sent events: data lines of JSON chunks, the last carrying the usage.
    let buffer = "";
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
        let chunk: { choices?: { delta?: { content?: string; tool_calls?: Called[] } }[]; usage?: Record<string, unknown>; error?: { message?: string } };
        try { chunk = JSON.parse(data); } catch { continue; }
        if (chunk.error) throw new ModelError(`${called(p)}: ${chunk.error.message ?? "an error"}`);
        const piece = chunk.choices?.[0]?.delta?.content;
        if (piece) { text += piece; call.onText?.(piece); }
        take(chunk.choices?.[0]?.delta?.tool_calls);
        if (chunk.usage) usage = chunk.usage;
      }
    }
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const details = table(usage?.prompt_tokens_details);
  const promptTokens = num(usage?.prompt_tokens), completionTokens = num(usage?.completion_tokens);
  const u: Usage = {
    at: new Date().toISOString(), project: learner.projectId(call.cfg.root), feature: call.feature ?? call.job, model,
    prompt_tokens: promptTokens, completion_tokens: completionTokens, cached_tokens: num(details.cached_tokens),
    // What the provider says it cost (OpenRouter does); else worked out from the prices set for it; else nothing is known.
    cost: typeof usage?.cost === "number" ? num(usage.cost) : priced(p, model, promptTokens, completionTokens) ?? 0, ...(call.exercise ? { exercise: call.exercise } : {}),
  };
  logUsage(u);
  return { text, usage: u, calls: calls.filter((c) => c && c.name).map((c, k) => ({ ...c, id: c.id || `call_${k}` })) };
}
