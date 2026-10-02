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

test("an agent records, lists and marks answers to exercises; goals are in the state", async () => {
  const { cfg, call } = await connect(true);
  const k = join(cfg.root, "knowledge");
  writeFileSync(join(k, "forms", "goal.md"), "---\ntype: Goal\ntitle: Use Stokes\n---\n\nApply [Stokes](stokes.md \"requires\").\n");
  writeFileSync(join(k, "forms", "ex1.md"), "---\ntype: Exercise\ntitle: Boundary of a disc\ntests: [stokes.md]\ngoals: [/forms/goal.md]\n---\n\nWhat is the boundary of a disc?\n\n# Solution\n\nA circle.\n");
  writeFileSync(join(k, "forms", "ex2.md"), "---\ntype: Exercise\ntitle: Two\ngoals: [goal.md]\nanswer: { kind: value, value: 2 }\n---\n\nOne plus one.\n");

  const before = JSON.parse(await call("learner_state"));
  expect(before.goals).toEqual([{ id: "forms/goal", title: "Use Stokes", met: false, exercises: { "forms/ex1": "untried", "forms/ex2": "untried" },
    notes: { undiscovered: 1, discovered: 0, processed: 0, understood: 0, total: 1 } }]);
  expect(before.by_folder.forms.total).toBe(2); // goals and exercises are not notes to cover

  expect(await call("exercise_record", { id: "forms/stokes", answer: "x" })).toMatch(/not an Exercise note/);
  expect(await call("exercise_record", { id: "forms/ex1", answer: " " })).toMatch(/An answer is needed/);
  const rec = JSON.parse(await call("exercise_record", { id: "forms/ex1", answer: "A circle, its rim." }));
  expect(rec).toMatchObject({ exercise: "forms/ex1", tests: ["forms/stokes"] });
  const pending = JSON.parse(await call("exercise_pending"));
  expect(pending).toEqual([{ ref: rec.ref, exercise: "forms/ex1", title: "Boundary of a disc", tests: ["forms/stokes"], answer: "A circle, its rim.",
    at: expect.any(String), notes_changed_since: [] }]);
  expect(await call("exercise_mark", { ref: rec.ref, result: "got", feedback: " " })).toMatch(/Feedback is needed/);
  expect(JSON.parse(await call("exercise_mark", { ref: rec.ref, result: "got", feedback: "Right: the circle bounds it.", actor: "agent/test" }))).toMatchObject({ marked: rec.ref, result: "got" });
  expect(await call("exercise_mark", { ref: rec.ref, result: "got", feedback: "Again." })).toMatch(/already marked \(got, agent\/test\)/);
  expect(await call("exercise_pending")).toBe("No exercise answers are waiting.");

  // The developer checks the value one in the dashboard.
  learner.append(cfg, { event: "attempt", exercise: "forms/ex2", tests: [], answer: "2", result: "got", by: "dashboard", kind: "interactive" });
  const after = JSON.parse(await call("learner_state"));
  expect(after.goals[0]).toMatchObject({ met: true, exercises: { "forms/ex1": "passed", "forms/ex2": "passed" }, notes: { understood: 1 } });
  expect(JSON.parse(await call("learner_state", { id: "forms/stokes" }))).toMatchObject({ state: "understood", by: "ai" });
});

test("recording an Exercise note warns about answer settings the dashboard cannot use", async () => {
  const { call } = await connect(false);
  const out = JSON.parse(await call("record", { id: "forms/ex3", type: "Exercise", title: "Three", description: "d", body: "One plus two?\n", meta: { answer: { kind: "value" } } }));
  expect(out.issues).toEqual(["warning: answer: a value exercise needs a number as its value", "warning: an Exercise note should end with a Solution section (a heading named Solution)"]);
  const ok = JSON.parse(await call("record", { id: "forms/ex4", type: "Exercise", title: "Four", description: "d", body: "Two plus two?\n\n## Solution\n\n4.\n", meta: { answer: { kind: "value", value: 4 } } }));
  expect(ok.issues).toBeUndefined();
});
