// What a terminal agent does through the MCP server is kept as steps (T107),
// for the Atlas to draw: what was searched, opened and written, and how each
// note was reached. Nothing of what was read or written is kept.

import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test } from "vitest";
import { loadConfig, type Config } from "../src/config.ts";
import { createServer } from "../src/mcp.ts";
import { brief } from "../src/brief.ts";
import * as inbox from "../src/inbox.ts";
import * as trace from "../src/trace.ts";
import { loadBundle } from "@rdstudio/core/node";

function project(config = ""): Config {
  const tmp = mkdtempSync(join(tmpdir(), "rdstudio-trace-"));
  mkdirSync(join(tmp, "config", "rdstudio"), { recursive: true });
  writeFileSync(join(tmp, "config", "rdstudio", "config.toml"), config);
  process.env.XDG_CONFIG_HOME = join(tmp, "config");
  process.env.XDG_DATA_HOME = join(tmp, "data");
  mkdirSync(join(tmp, "project", "knowledge", "forms"), { recursive: true });
  writeFileSync(join(tmp, "project", "rdstudio.toml"), "[project]\ntitle = 'T'\n");
  writeFileSync(join(tmp, "project", "knowledge", "forms", "stokes.md"), "---\ntype: Theorem\ntitle: Stokes\n---\n\n# Statement\n\nThe integral of dω over M is the integral of ω over ∂M. A secret sentence.\n");
  writeFileSync(join(tmp, "project", "knowledge", "forms", "orientation.md"), "---\ntype: Definition\ntitle: Orientation\n---\n\nA consistent choice. See [Stokes](stokes.md).\n");
  return loadConfig(join(tmp, "project"));
}
async function connect(cfg: Config, name = "claude-code") {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(cfg, "test").connect(a);
  const client = new Client({ name, version: "2.1" });
  await client.connect(b);
  return async (tool: string, args: Record<string, unknown> = {}) => ((await client.callTool({ name: tool, arguments: args })).content as { text: string }[])[0]!.text;
}

test("each call is kept as a step: what was searched, opened and written, and how it was reached", async () => {
  const cfg = project(), call = await connect(cfg);
  await call("brief");
  await call("search", { query: "consistent orientation" });
  await call("outline", { id: "forms/orientation" });
  await call("read", { id: "forms/stokes", section_heading: "Statement" });
  await call("read", { id: "forms/nowhere" });
  await call("read", { id: "forms/stokes", section_heading: "Proof" });
  await call("record", { id: "forms/boundary", type: "Definition", title: "Boundary", description: "The edge.", body: "The edge of M. A private thought." });
  await call("record", { id: "forms/stokes", append: "See [Boundary](boundary.md)." });
  await call("record", { id: "forms/index", type: "X", body: "no" });
  await call("learner_state");
  const got = trace.events(cfg);
  expect(new Set(got.map((e) => e.session)).size).toBe(1);
  expect(got.every((e) => e.client === "claude-code 2.1" && e.source === "mcp")).toBe(true);
  expect(got.map((e) => [e.step.tool, e.step.how, e.step.said, !!e.step.failed])).toEqual([
    ["brief", "read", "Read the brief", false],
    ["search", "search", 'Searched the notes for "consistent orientation": 1 found', false],
    ["outline", "read", "Looked at the outline of Orientation", false],
    ["read", "link", 'Read "Statement" in Stokes', false], // Orientation, in hand, links to it
    ["read", "read", "Looked for forms/nowhere, which is not a note", true],
    ["read", "link", 'Looked for "Proof" in Stokes, which has no such section', true],
    ["record", "write", "Wrote a new note: Boundary", false],
    ["record", "write", "Added to Stokes", false],
    ["record", "write", "Tried to write forms/index: index.md is reserved by OKF", true],
    ["learner_state", "read", "Called learner_state", false],
  ]);
  expect(got[1]!.step.notes).toEqual(["forms/orientation"]);
  expect(got[3]!.step).toMatchObject({ opened: "forms/stokes", from: "forms/orientation", section: "Statement", notes: ["forms/stokes"] });
  expect(got[6]!.step).toMatchObject({ opened: "forms/boundary", notes: ["forms/boundary"] });
  // What was touched, never what was said: no body read or written is in the log.
  const raw = readFileSync(trace.tracePath(cfg), "utf8");
  expect(raw).not.toMatch(/secret sentence|private thought|integral of/);
  expect(trace.tracePath(cfg).startsWith(cfg.root)).toBe(false); // beside the learner record, outside the repository

  expect(trace.sessions(cfg)).toEqual([expect.objectContaining({ client: "claude-code 2.1", sources: ["mcp"], steps: 10, notes: 3, wrote: 2 })]);
  // A second agent is a second session, the latest first.
  const other = await connect(cfg, "opencode");
  await other("read", { id: "forms/orientation" });
  expect(trace.sessions(cfg).map((s) => [s.client, s.steps])).toEqual([["opencode 2.1", 1], ["claude-code 2.1", 10]]);
  expect(trace.events(cfg, trace.sessions(cfg)[0]!.id)).toHaveLength(1);
});

test("the log is followed as it grows, and is not kept where it is turned off", async () => {
  const cfg = project(), call = await connect(cfg);
  await call("read", { id: "forms/stokes" }); // before following: not given again
  const seen: string[] = [];
  const stop = trace.follow(cfg, (e) => seen.push(e.step.said), 20);
  await call("read", { id: "forms/orientation" });
  await call("search", { query: "integral" });
  await new Promise((ok) => setTimeout(ok, 120));
  expect(seen).toEqual(["Read Orientation", 'Searched the notes for "integral": 1 found']);
  stop();
  await call("read", { id: "forms/stokes" });
  await new Promise((ok) => setTimeout(ok, 80));
  expect(seen).toHaveLength(2);

  const off = project("[agents]\ntrace = false\n"), quiet = await connect(off);
  expect(await quiet("read", { id: "forms/stokes" })).toContain("Stokes"); // the call is answered all the same
  expect(existsSync(trace.tracePath(off))).toBe(false);
});

test("a file of the base read or edited with an agent's own tools is a step; any other file is not (T108)", () => {
  const cfg = project();
  expect(trace.fileStep(cfg, "read", join(cfg.knowledgeDir, "forms/stokes.md"))).toMatchObject({ how: "read", opened: "forms/stokes", notes: ["forms/stokes"], said: "Read forms/stokes as a file" });
  expect(trace.fileStep(cfg, "write", "knowledge/forms/stokes.md")).toMatchObject({ how: "write", opened: "forms/stokes", said: "Edited forms/stokes as a file" });
  for (const p of ["rdstudio.toml", "src/main.ts", "knowledge/forms/index.md", "knowledge/forms/fig.html", "/etc/passwd", "knowledge/../secret.md", "knowledge/.hidden/x.md"]) expect(trace.fileStep(cfg, "read", p)).toBeNull();
  expect(trace.fileStep(cfg, "search", "knowledge", "Stokes")).toMatchObject({ how: "search", notes: [], said: 'Searched the files of the base for "Stokes"' });
  expect(trace.fileStep(cfg, "search", cfg.root, "Stokes")).not.toBeNull(); // the whole repository holds the base
  expect(trace.fileStep(cfg, "search", "src", "Stokes")).toBeNull();
});

test("a harness's report joins the agent's own session where it has one at work, and is its own otherwise (T108)", async () => {
  const cfg = project();
  const read = (extra: Record<string, unknown> = {}) => ({ session_id: "abc-123", hook_event_name: "PostToolUse", cwd: cfg.root, tool_name: "Read", tool_input: { file_path: join(cfg.knowledgeDir, "forms/stokes.md") }, ...extra });
  // No MCP session: the harness's own, named for it.
  expect(trace.hookEvent(cfg, read())).toMatchObject({ session: "claude-code-abc-123", client: "claude-code", source: "hook", step: { how: "read", opened: "forms/stokes" } });
  expect(trace.hookEvent(cfg, read({ tool_name: "Edit" }))!.step.how).toBe("write");
  expect(trace.hookEvent(cfg, read({ tool_name: "Grep", tool_input: { pattern: "Stokes", path: cfg.knowledgeDir } }))!.step).toMatchObject({ how: "search", args: { query: "Stokes" } });
  expect(trace.hookEvent(cfg, read({ tool_name: "Grep", tool_input: { pattern: "Stokes" } }))!.step.how).toBe("search"); // no folder named: where the agent is
  for (const none of [read({ tool_name: "Bash", tool_input: { command: "cat knowledge/forms/stokes.md" } }), read({ tool_input: { file_path: join(cfg.root, "rdstudio.toml") } }), read({ tool_input: {} }), null, "text", {}]) expect(trace.hookEvent(cfg, none)).toBeNull();
  // The plain form, for a harness that is not Claude Code.
  expect(trace.hookEvent(cfg, { tool: "read", path: "knowledge/forms/stokes.md", session: "s 1/../x", client: "opencode 0.9" })).toMatchObject({ session: "opencode-s1..x", client: "opencode 0.9" });

  const call = await connect(cfg, "claude-code");
  await call("read", { id: "forms/orientation" });
  const own = trace.sessions(cfg)[0]!;
  const joined = trace.hookEvent(cfg, read())!;
  expect(joined).toMatchObject({ session: own.id, client: "claude-code 2.1", source: "hook" });
  expect(trace.hookEvent(cfg, { tool: "read", path: "knowledge/forms/stokes.md", session: "s1", client: "opencode" })!.session).toBe("opencode-s1"); // another agent's is not joined to it
  trace.append(cfg, joined);
  expect(trace.sessions(cfg)).toEqual([expect.objectContaining({ id: own.id, sources: ["mcp", "hook"], steps: 2, notes: 2 })]);
  expect(trace.forget(cfg, own.id)).toEqual({ id: own.id });
  expect(trace.sessions(cfg)).toEqual([]);
});

test("what the developer sends from the app waits for an agent to ask, and is given once (T109)", async () => {
  const cfg = project(), b = loadBundle(cfg.knowledgeDir), call = await connect(cfg);
  expect(await call("from_developer")).toBe("Nothing waits from the developer.");
  expect(brief(cfg)).not.toMatch(/from_developer/);
  expect(() => inbox.send(cfg, { text: "  " }, b)).toThrow(/write what to send/);
  expect(() => inbox.send(cfg, { text: "x".repeat(inbox.MAX_TEXT + 1) }, b)).toThrow(/too long/);
  const one = inbox.send(cfg, { text: "Tighten the statement here.", ref: "/forms/stokes.md", passage: "The integral of dω\nover M" }, b);
  expect(one).toMatchObject({ ref: "forms/stokes", kind: "note" });
  inbox.send(cfg, { text: "Is this folder complete?", ref: "forms" }, b);
  expect(inbox.send(cfg, { text: "From nowhere.", ref: "no/such" }, b).ref).toBeUndefined(); // a place that is not there is left out
  expect(brief(cfg)).toMatch(/The developer sent 3 things from the app: call the rdstudio from_developer tool to read them\./);
  const got = await call("from_developer");
  expect(got).toContain("They were on the note Stokes (/forms/stokes.md).");
  expect(got).toContain("> The integral of dω\n> over M");
  expect(got).toContain("Tighten the statement here.");
  expect(got).toContain("They were on the folder forms/.");
  expect(got).toContain("From nowhere.");
  expect(await call("from_developer")).toBe("Nothing waits from the developer."); // each once
  expect(brief(cfg)).not.toMatch(/from_developer/);
  expect(inbox.list(cfg).map((s) => s.taken?.by)).toEqual(["claude-code 2.1", "claude-code 2.1", "claude-code 2.1"]);
  expect(trace.events(cfg).map((e) => e.step.said)).toEqual(["Asked what the developer had sent: nothing", "Took what the developer sent from the app", "Asked what the developer had sent: nothing"]);
  expect(readFileSync(trace.tracePath(cfg), "utf8")).not.toContain("Tighten"); // what was sent is not in the trace
  // Taken back before it is taken: never given.
  const later = inbox.send(cfg, { text: "Never mind." }, b);
  inbox.drop(cfg, later.id);
  expect(await call("from_developer")).toBe("Nothing waits from the developer.");
});
