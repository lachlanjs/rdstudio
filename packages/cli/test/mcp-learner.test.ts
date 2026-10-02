// The learner tools of the MCP server: reading where the developer stands,
// setting a question, and marking an explain-back answer written in the
// dashboard, against a throwaway record.

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test } from "vitest";
import { loadConfig } from "../src/config.ts";
import * as learner from "../src/learner.ts";
import { createServer } from "../src/mcp.ts";

async function connect(enabled: boolean) {
  const tmp = mkdtempSync(join(tmpdir(), "rdstudio-mcp-learner-"));
  mkdirSync(join(tmp, "config", "rdstudio"), { recursive: true });
  writeFileSync(join(tmp, "config", "rdstudio", "config.toml"), `[learner]\nenabled = ${enabled}\n`);
  process.env.XDG_CONFIG_HOME = join(tmp, "config");
  process.env.XDG_DATA_HOME = join(tmp, "data");
  mkdirSync(join(tmp, "project", "knowledge", "forms"), { recursive: true });
  writeFileSync(join(tmp, "project", "rdstudio.toml"), "[project]\ntitle = 'T'\n");
  writeFileSync(join(tmp, "project", "knowledge", "forms", "stokes.md"), "---\ntype: Theorem\ntitle: Stokes\n---\n\nThe integral of dω over M is the integral of ω over ∂M.\n");
  writeFileSync(join(tmp, "project", "knowledge", "forms", "orientation.md"), "---\ntype: Definition\ntitle: Orientation\n---\n\nA consistent choice of orientation. See [Stokes](stokes.md).\n");
  const cfg = loadConfig(join(tmp, "project"));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(cfg, "test").connect(a);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(b);
  const call = async (name: string, args: Record<string, unknown> = {}) =>
    ((await client.callTool({ name, arguments: args })).content as { text: string }[])[0]!.text;
  return { cfg, call };
}

test("the learner tools say the record is off until it is on", async () => {
  const { call } = await connect(false);
  expect(await call("learner_state")).toMatch(/learner record is off/);
  expect(await call("explain_pending")).toMatch(/learner record is off/);
});

test("an agent reads the state, sets a question and marks an answer", async () => {
  const { cfg, call } = await connect(true);
  learner.append(cfg, { event: "seen", concept: "forms/stokes", hash: "h" });
  const overall = JSON.parse(await call("learner_state"));
  expect(overall.by_folder.forms).toMatchObject({ discovered: 1, undiscovered: 1, total: 2 });
  expect(overall.explain_waiting).toBe(0);

  expect(JSON.parse(await call("explain_question", { id: "forms/stokes", question: "Why does the boundary appear?", actor: "agent/test" })).concept).toBe("forms/stokes");
  const question = learner.events(cfg).at(-1)!;
  expect(question).toMatchObject({ event: "question", concept: "forms/stokes", kind: "ai", by: "agent/test" });

  // The developer answers in the dashboard.
  const answer = learner.append(cfg, { event: "explain", concept: "forms/stokes", hash: "h", question: question.question, answer: "Integrating a derivative gives boundary values.", kind: "ai" });
  const waiting = JSON.parse(await call("explain_pending"));
  expect(waiting).toMatchObject([{ ref: answer.id, title: "Stokes", answer: "Integrating a derivative gives boundary values.", note_changed_since: true }]);

  expect(await call("explain_mark", { ref: answer.id, result: "partly", feedback: "" })).toMatch(/Feedback is needed/);
  expect(await call("explain_mark", { ref: "nope", result: "got", feedback: "x" })).toMatch(/No explain-back answer/);
  const marked = JSON.parse(await call("explain_mark", { ref: answer.id, result: "got", feedback: "Right: the fundamental theorem, generalised.", gaps: [] }));
  expect(marked).toMatchObject({ marked: answer.id, result: "got" });
  expect(await call("explain_mark", { ref: answer.id, result: "got", feedback: "again" })).toMatch(/already marked/);
  expect(await call("explain_pending")).toBe("No explain-back answers are waiting.");
  const one = JSON.parse(await call("learner_state", { id: "forms/stokes" }));
  expect(one).toMatchObject({ id: "forms/stokes", state: "understood", by: "ai", review: { box: 0 } });

  // An answer given in the conversation is recorded, then marked the same way.
  const { ref } = JSON.parse(await call("explain_record", { id: "forms/orientation", answer: "Choosing a side consistently.", question: "What is an orientation?" }));
  expect(learner.events(cfg).at(-1)).toMatchObject({ id: ref, event: "explain", concept: "forms/orientation", via: "harness" });
  expect(JSON.parse(await call("explain_pending"))[0].ref).toBe(ref);
});
