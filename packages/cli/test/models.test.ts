// Calling models through OpenRouter (T50), against a fake: streaming, the
// usage log by feature, the weekly budget, and the key.

import { existsSync, mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { loadConfig } from "../src/config.ts";
import * as models from "../src/models.ts";

function project(config = "[learner]\nenabled = true\n") {
  const tmp = mkdtempSync(join(tmpdir(), "rdstudio-models-"));
  mkdirSync(join(tmp, "config", "rdstudio"), { recursive: true });
  writeFileSync(join(tmp, "config", "rdstudio", "config.toml"), config);
  process.env.XDG_CONFIG_HOME = join(tmp, "config");
  process.env.XDG_DATA_HOME = join(tmp, "data");
  delete process.env.OPENROUTER_API_KEY;
  mkdirSync(join(tmp, "project"));
  writeFileSync(join(tmp, "project", "rdstudio.toml"), "[project]\ntitle = 'T'\n");
  return loadConfig(join(tmp, "project"));
}

/** A fake OpenRouter that streams `pieces`, then usage. */
function fakeStream(pieces: string[], usage: Record<string, unknown>, seen: { body?: Record<string, unknown>; auth?: string } = {}) {
  models.setFetch((async (_url: unknown, init?: RequestInit) => {
    seen.body = JSON.parse(String(init?.body));
    seen.auth = (init?.headers as Record<string, string>).Authorization;
    const lines = [...pieces.map((p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`),
      ": OPENROUTER PROCESSING\n\n", `data: ${JSON.stringify({ choices: [{ delta: {} }], usage })}\n\n`, "data: [DONE]\n\n"];
    const enc = new TextEncoder();
    // Split across chunks mid-line, as a network would.
    const all = enc.encode(lines.join(""));
    const body = new ReadableStream({ start(c) { for (let i = 0; i < all.length; i += 17) c.enqueue(all.slice(i, i + 17)); c.close(); } });
    return new Response(body, { status: 200 });
  }) as typeof fetch);
}
afterEach(() => models.setFetch((...a) => fetch(...a)));

test("models and the budget come from the user config, with defaults", () => {
  project();
  expect(models.models()).toEqual(models.DEFAULT_MODELS);
  expect(models.weeklyBudget()).toBe(10);
  project('[teacher]\nweekly_budget = 2.5\n[teacher.models]\nhint = "x/cheap"\n');
  expect(models.models().hint).toBe("x/cheap");
  expect(models.models().feedback).toBe(models.DEFAULT_MODELS.feedback);
  expect(models.weeklyBudget()).toBe(2.5);
});

test("the key: from the environment, or a file only you can read", () => {
  project();
  expect(models.apiKey()).toBeNull();
  expect(() => models.saveKey("no")).toThrow(/not a key/);
  models.saveKey("sk-or-v1-abcdef0123456789");
  expect(models.apiKey()).toEqual({ key: "sk-or-v1-abcdef0123456789", from: "file" });
  expect(statSync(models.keyFile()).mode & 0o777).toBe(0o600);
  process.env.OPENROUTER_API_KEY = "sk-env-0123456789";
  expect(models.apiKey()).toEqual({ key: "sk-env-0123456789", from: "environment" });
  delete process.env.OPENROUTER_API_KEY;
  models.forgetKey();
  expect(models.apiKey()).toBeNull();
});

test("a call streams, and its usage is logged by feature, model and exercise", async () => {
  const cfg = project();
  await expect(models.complete({ cfg, job: "hint", messages: [{ role: "user", content: "Hi" }] })).rejects.toThrow(/No OpenRouter key/);
  models.saveKey("sk-or-v1-abcdef0123456789");
  const seen: { body?: Record<string, unknown>; auth?: string } = {};
  fakeStream(["Line", "arity", "."], { prompt_tokens: 900, completion_tokens: 4, cost: 0.0012, prompt_tokens_details: { cached_tokens: 800 } }, seen);
  const pieces: string[] = [];
  const reply = await models.complete({ cfg, job: "hint", exercise: "ex/one", maxTokens: 80, onText: (p) => pieces.push(p),
    messages: [{ role: "system", content: [{ text: "Skill.", cache: true }, { text: "Exercise." }] }, { role: "user", content: "Draft." }] });
  expect(reply.text).toBe("Linearity.");
  expect(pieces).toEqual(["Line", "arity", "."]);
  expect(seen.auth).toBe("Bearer sk-or-v1-abcdef0123456789");
  expect(seen.body).toMatchObject({ model: "google/gemini-3.8-flash", stream: true, max_tokens: 80,
    messages: [{ role: "system", content: [{ type: "text", text: "Skill.", cache_control: { type: "ephemeral" } }, { type: "text", text: "Exercise." }] }, { role: "user", content: "Draft." }] });
  expect(reply.usage).toMatchObject({ feature: "hint", model: "google/gemini-3.8-flash", prompt_tokens: 900, completion_tokens: 4, cached_tokens: 800, cost: 0.0012, exercise: "ex/one" });
  expect(readFileSync(models.usageFile(), "utf8").trim().split("\n")).toHaveLength(1);
  const s = models.spending(cfg);
  expect(s).toMatchObject({ budget: 10, spent: 0.0012, calls: 1, warn: false, stopped: false, byFeature: { hint: 0.0012 }, byExercise: { "ex/one": 0.0012 } });
});

test("the weekly budget warns at 80% and stops at 100%", async () => {
  const cfg = project('[learner]\nenabled = true\n[teacher]\nweekly_budget = 0.01\n');
  models.saveKey("sk-or-v1-abcdef0123456789");
  fakeStream(["ok"], { prompt_tokens: 10, completion_tokens: 1, cost: 0.0085 });
  await models.complete({ cfg, job: "feedback", messages: [{ role: "user", content: "x" }] });
  expect(models.spending(cfg)).toMatchObject({ warn: true, stopped: false });
  fakeStream(["ok"], { prompt_tokens: 10, completion_tokens: 1, cost: 0.002 });
  await models.complete({ cfg, job: "feedback", messages: [{ role: "user", content: "x" }] });
  expect(models.spending(cfg).stopped).toBe(true);
  await expect(models.complete({ cfg, job: "hint", messages: [{ role: "user", content: "x" }] })).rejects.toThrow(/budget \(\$0\.01\) is spent/);
  // Last week's spending does not count.
  const old = { at: new Date(models.weekStart() - 1000).toISOString(), project: "p", feature: "hint", model: "m", prompt_tokens: 1, completion_tokens: 1, cached_tokens: 0, cost: 5 };
  writeFileSync(models.usageFile(), JSON.stringify(old) + "\n");
  expect(models.spending(cfg).spent).toBe(0);
  expect(existsSync(models.usageFile())).toBe(true);
});

test("OpenRouter's errors are said plainly", async () => {
  const cfg = project();
  models.saveKey("sk-or-v1-abcdef0123456789");
  models.setFetch((async () => new Response(JSON.stringify({ error: { message: "Insufficient credits" } }), { status: 402 })) as typeof fetch);
  await expect(models.complete({ cfg, job: "hint", messages: [{ role: "user", content: "x" }] })).rejects.toThrow("OpenRouter said 402: Insufficient credits");
});
