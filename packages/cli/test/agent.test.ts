// The one loop (T100): tools come in boxes, the box that offers a tool runs
// it, and the steps come back in the order they were made.

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { loadBundle } from "@rdstudio/core/node";
import { ROUNDS, codeRead, notices, rounds, type Toolbox } from "../src/agent.ts";
import { loadConfig } from "../src/config.ts";
import { Lookup, type Step } from "../src/lookup.ts";
import * as models from "../src/models.ts";

const put = (root: string, rel: string, text: string) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };

function project() {
  const tmp = mkdtempSync(join(tmpdir(), "rdstudio-agent-"));
  mkdirSync(join(tmp, "config", "rdstudio"), { recursive: true });
  writeFileSync(join(tmp, "config", "rdstudio", "config.toml"), "");
  process.env.XDG_CONFIG_HOME = join(tmp, "config");
  process.env.XDG_DATA_HOME = join(tmp, "data");
  process.env.OPENROUTER_API_KEY = "sk-test-0123456789";
  const root = join(tmp, "project");
  put(root, "rdstudio.toml", "[project]\ntitle = 'T'\n");
  put(root, "knowledge/index.md", "---\nokf_version: \"0.2\"\n---\n");
  put(root, "knowledge/design/units.md", "---\ntype: Design\ntitle: Units\n---\n\nTemperatures are in kelvin.\n");
  return loadConfig(root);
}
afterEach(() => models.setFetch((...a) => fetch(...a)));

type Turn = string | { name: string; args: Record<string, unknown> }[];
function script(turns: Turn[], bodies: Record<string, any>[] = [], finish = "stop") {
  let n = 0;
  models.setFetch((async (_u: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const turn = turns[Math.min(n++, turns.length - 1)]!;
    const enc = new TextEncoder();
    const deltas = typeof turn === "string" ? [{ content: turn }]
      : turn.map((t, index) => ({ tool_calls: [{ index, id: `c${n}_${index}`, function: { name: t.name, arguments: JSON.stringify(t.args) } }] }));
    const lines = [...deltas.map((delta) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`), `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: typeof turn === "string" ? finish : "tool_calls" }], usage: { prompt_tokens: 100, completion_tokens: 10, cost: 0.001 } })}\n\n`, "data: [DONE]\n\n"];
    return new Response(new ReadableStream({ start(c) { for (const l of lines) c.enqueue(enc.encode(l)); c.close(); } }), { status: 200 });
  }) as typeof fetch);
  return bodies;
}

/** A second box: one tool, which notes what it was asked. */
class Notes implements Toolbox {
  readonly kept: string[] = [];
  defs(): models.ToolDef[] {
    return [{ type: "function", function: { name: "jot", description: "Keep a line.", parameters: { type: "object", properties: { line: { type: "string" } }, required: ["line"], additionalProperties: false } } }];
  }
  async call(name: string, raw: string): Promise<{ text: string; step: Step }> {
    const args = JSON.parse(raw) as { line: string };
    this.kept.push(args.line);
    return { text: "Kept.", step: { tool: name, args, said: `Kept "${args.line}"`, how: "read", notes: [] } };
  }
}

test("each tool is run by the box that offers it, and the steps are in the order made", async () => {
  const cfg = project(), look = new Lookup(cfg, loadBundle(cfg.knowledgeDir), ""), notes = new Notes();
  const bodies = script([
    [{ name: "read_note", args: { id: "design/units" } }, { name: "jot", args: { line: "kelvin" } }],
    [{ name: "jot", args: { line: "done" } }],
    "Temperatures are in kelvin.",
  ]);
  const seen: string[] = [];
  const ran = await rounds({ call: { cfg, job: "discuss", feature: "test" }, messages: [{ role: "user", content: "What units?" }], boxes: [look, notes], tier: "mid",
    onStep: (s) => seen.push(s.tool), gathered: () => [] });
  expect(ran.text).toBe("Temperatures are in kelvin.");
  expect(ran.steps.map((s) => s.tool)).toEqual(["read_note", "jot", "jot"]);
  expect(seen).toEqual(["read_note", "jot", "jot"]);
  expect(notes.kept).toEqual(["kelvin", "done"]);
  expect(look.steps.map((s) => s.tool)).toEqual(["read_note"]); // the lookup box keeps only its own
  expect(ran.spent).toEqual({ calls: 3, input: 300, output: 30, cached: 0 });
  // Both boxes' tools were offered, and each call was answered to the model.
  const offered = (bodies[0]!.tools as { function: { name: string } }[]).map((t) => t.function.name);
  expect(offered).toContain("read_note");
  expect(offered).toContain("jot");
  expect((bodies[2]!.messages as { role: string }[]).filter((m) => m.role === "tool")).toHaveLength(3);
});

test("a tool no box offers is answered, not thrown; and the rounds end with a reply", async () => {
  const cfg = project(), look = new Lookup(cfg, loadBundle(cfg.knowledgeDir), "");
  const bodies = script([[{ name: "delete_everything", args: {} }]]); // it never stops calling
  const ran = await rounds({ call: { cfg, job: "discuss", feature: "test" }, messages: [{ role: "user", content: "?" }], boxes: [look], tier: "low", gathered: () => [] });
  expect(ran.steps).toHaveLength(ROUNDS.low);
  expect(ran.steps.every((s) => s.failed && /no tool delete_everything/.test(s.said))).toBe(true);
  expect(bodies.at(-1)!.tool_choice).toBe("none"); // the last call may not use a tool
  expect(bodies).toHaveLength(ROUNDS.low + 1);
});

test("the code read is listed once for each file and line", () => {
  const step = (path: string, line: number, failed = false): Step => ({ tool: "read_code", args: {}, said: "", how: "code", notes: [], code: { path, line }, failed });
  expect(codeRead([step("a.ts", 1), step("a.ts", 1), step("a.ts", 40), step("b.ts", 1, true)])).toEqual([
    { kind: "code", id: "a.ts", title: "a.ts", line: 1 }, { kind: "code", id: "a.ts", title: "a.ts", line: 40 }]);
});

test("each tier's limits are the person's, kept in the user config; none set changes nothing (T110)", () => {
  project();
  const conf = join(process.env.XDG_CONFIG_HOME!, "rdstudio", "config.toml");
  writeFileSync(conf, "[teacher]\nweekly_budget = 5\n\n[teacher.tiers]\nlow = \"a/b\"\n");
  const none = { input: null, output: null };
  expect(models.limits()).toEqual({ low: none, mid: none, max: none });
  expect(models.setLimits({ mid: { input: 60000, output: 8000 }, low: { output: 4096 } })).toEqual({ low: { input: null, output: 4096 }, mid: { input: 60000, output: 8000 }, max: none });
  let text = readFileSync(conf, "utf8");
  expect(text.startsWith("[teacher]\nweekly_budget = 5\n\n[teacher.tiers]\nlow = \"a/b\"\n")).toBe(true); // the rest is as it was
  expect(text).toContain("[teacher.limits]\nlow = { output = 4096 }\nmid = { input = 60000, output = 8000 }\n");
  expect(models.tiers().low).toBe("a/b");
  // One limit taken off, the other left; a tier not named is left as it is.
  expect(models.setLimits({ mid: { input: null } }).mid).toEqual({ input: null, output: 8000 });
  expect(models.limits().low.output).toBe(4096);
  for (const bad of [1.5, 50, -1, 3_000_000, "9000" as unknown as number]) expect(() => models.setLimits({ max: { output: bad } })).toThrow(/whole number of tokens/);
  expect(() => models.setLimits({ max: { input: 500 } })).toThrow(/from 2000/);
  // All taken off: the table goes, with its comment, and nothing else does.
  models.setLimits({ low: { output: null }, mid: { output: null } });
  text = readFileSync(conf, "utf8");
  expect(text).not.toMatch(/limits|most tokens/);
  expect(text).toContain("[teacher.tiers]\nlow = \"a/b\"");
  expect(models.weeklyBudget()).toBe(5);
});

test("an output limit set for the tier is what is sent; a reply that stops at it says so (T110)", async () => {
  const cfg = project(), look = new Lookup(cfg, loadBundle(cfg.knowledgeDir), "");
  const run = (bodies: Record<string, any>[], finish: string, tier: models.Tier = "mid") => { script(["A reply that"], bodies, finish); return rounds({ call: { cfg, job: "discuss", feature: "test", tier, maxTokens: 900 }, messages: [{ role: "user", content: "?" }], boxes: [look], tier, gathered: () => [] }); };
  let bodies: Record<string, any>[] = [];
  expect((await run(bodies, "stop")).cut).toBeUndefined();
  expect(bodies[0]!.max_tokens).toBe(900); // rdstudio's own figure
  const own = await run(bodies = [], "length");
  expect(own.cut).toBe(900);
  expect(notices(own, "mid")[0]).toMatch(/cut off at 900 tokens, the most rdstudio asks for here/);

  models.setLimits({ mid: { output: 16000 } });
  const set = await run(bodies = [], "length");
  expect(bodies[0]!.max_tokens).toBe(16000); // higher than the request's own: a model that reasons needs it
  expect(set.cut).toBe(16000);
  expect(notices(set, "mid")[0]).toMatch(/output limit set for the mid tier \(16000 tokens\)/);
  await run(bodies = [], "stop", "low"); // another tier is not under it
  expect(bodies[0]!.max_tokens).toBe(900);
  // A job with no tier named takes its own tier's limit: hints are low.
  models.setLimits({ low: { output: 300 } });
  script(["A hint."], bodies = []);
  await models.complete({ cfg, job: "hint", messages: [{ role: "user", content: "?" }], maxTokens: 200 });
  expect(bodies[0]!.max_tokens).toBe(300);
});

test("under an input limit, what a tool answers is cut to fit and the rounds end early (T110)", async () => {
  const cfg = project();
  put(cfg.root, "knowledge/design/long.md", `---\ntype: Design\ntitle: Long\n---\n\n${"A long line about the integrator and its steps. ".repeat(400)}\n`);
  const look = new Lookup(cfg, loadBundle(cfg.knowledgeDir), "");
  const reads = [{ name: "read_note", args: { id: "design/long" } }];
  const bodies = script([reads, reads, reads, "Done."]);
  const ran = await rounds({ call: { cfg, job: "discuss", feature: "test" }, messages: [{ role: "user", content: "What does it say?" }], boxes: [look], tier: "max", inputLimit: 2000, gathered: () => [] });
  expect(ran.steps).toHaveLength(1); // one read, cut, and then it must reply
  expect(ran.full).toBe(2000);
  expect(bodies).toHaveLength(2);
  expect(bodies[1]!.tool_choice).toBe("none");
  const sent = (bodies[1]!.messages as { content: string | null }[]).reduce((n, m) => n + Math.ceil((m.content ?? "").length / 4), 0);
  expect(sent).toBeLessThanOrEqual(2000);
  expect((bodies[1]!.messages as { role: string; content: string }[]).find((m) => m.role === "tool")!.content).toMatch(/input limit set for this tier is reached\. Nothing more can be looked up: reply now/);
  expect(notices(ran, "max")[0]).toMatch(/stopped looking things up at the input limit set for the max tier \(2000 tokens\)/);
  // With no limit, the same script reads three times.
  script([reads, reads, reads, "Done."]);
  const free = await rounds({ call: { cfg, job: "discuss", feature: "test" }, messages: [{ role: "user", content: "?" }], boxes: [new Lookup(cfg, loadBundle(cfg.knowledgeDir), "")], tier: "max", gathered: () => [] });
  expect(free.steps).toHaveLength(3);
  expect(free.full).toBeUndefined();
});
