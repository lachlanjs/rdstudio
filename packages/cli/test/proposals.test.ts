// What Axis may propose from the Atlas (T101): each proposal is checked as it
// is made and writes nothing; an accepted one is made as an edit in the app is.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { loadBundle } from "@rdstudio/core/node";
import * as atlasask from "../src/atlasask.ts";
import { loadConfig } from "../src/config.ts";
import * as models from "../src/models.ts";
import { MAX_PROPOSALS, Proposals, apply, changed, read } from "../src/proposals.ts";

const put = (root: string, rel: string, text: string) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
const note = (title: string, body: string) => `---\ntype: Design\ntitle: ${title}\ndescription: About ${title.toLowerCase()}.\ngenerated: {by: "human:ann", at: 2026-01-01T00:00:00Z}\n---\n\n${body}\n`;

function project() {
  const tmp = mkdtempSync(join(tmpdir(), "rdstudio-proposals-"));
  mkdirSync(join(tmp, "config", "rdstudio"), { recursive: true });
  writeFileSync(join(tmp, "config", "rdstudio", "config.toml"), "");
  process.env.XDG_CONFIG_HOME = join(tmp, "config");
  process.env.XDG_DATA_HOME = join(tmp, "data");
  process.env.OPENROUTER_API_KEY = "sk-test-0123456789";
  const root = join(tmp, "project");
  put(root, "rdstudio.toml", "[project]\ntitle = 'T'\n");
  put(root, "knowledge/index.md", "---\nokf_version: \"0.2\"\n---\n");
  put(root, "knowledge/design/thermostat.md", note("The thermostat", "# How\n\nA Berendsen thermostat rescales velocities.\nIt is simple.\n\n# Why\n\nIt is simple."));
  put(root, "knowledge/design/integrator.md", note("The integrator", "Steps the system forward. See [the thermostat](/design/thermostat.md \"requires\")."));
  const cfg = loadConfig(root);
  return { cfg, k: cfg.knowledgeDir, b: loadBundle(cfg.knowledgeDir) };
}
afterEach(() => models.setFetch((...a) => fetch(...a)));
const call = (p: Proposals, name: string, args: Record<string, unknown>) => p.call(name, JSON.stringify(args));
const by = { actor: "human:ann", model: "anthropic/claude-sonnet-5.5" };

test("a proposal is checked as it is made, and nothing is written by making it", async () => {
  const { k, b } = project(), p = new Proposals(k, b);
  const ok = await call(p, "propose_note", { id: "decisions/berendsen", type: "Decision", title: "Use Berendsen", description: "Why  the thermostat\nis Berendsen.", tags: ["thermostat", "not a tag!"], body: "---\ntype: X\n---\n\nIt is simple. See [the thermostat](/design/thermostat.md)." });
  expect(ok.step).toMatchObject({ tool: "propose_note", how: "propose", notes: [], said: "Proposed a new note: Use Berendsen (decisions/berendsen)" });
  expect(ok.text).toMatch(/not written until the person accepts/);
  expect(p.made).toEqual([{ kind: "create", id: "decisions/berendsen", type: "Decision", title: "Use Berendsen", description: "Why the thermostat is Berendsen.", tags: ["thermostat"], body: "It is simple. See [the thermostat](/design/thermostat.md)." }]);
  expect(existsSync(join(k, "decisions/berendsen.md"))).toBe(false);

  const refused = async (name: string, args: Record<string, unknown>, why: RegExp) => { const r = await call(p, name, args); expect(r.step.failed).toBe(true); expect(r.text).toMatch(why); };
  const whole = { type: "Decision", title: "T", description: "D", body: "B" };
  await refused("propose_note", { ...whole, id: "decisions/berendsen" }, /already exists/); // proposed already
  await refused("propose_note", { ...whole, id: "design/thermostat" }, /already exists/);
  await refused("propose_note", { ...whole, id: "loose" }, /goes in a folder/);
  await refused("propose_note", { ...whole, id: "../outside/x" }, /invalid concept id/);
  await refused("propose_note", { ...whole, id: "design/index" }, /reserved/);
  await refused("propose_note", { ...whole, id: "design/new", body: " " }, /needs a body/);
  await refused("propose_change", { id: "design/nowhere", old: "x", new: "y" }, /no note design\/nowhere/);
  await refused("propose_change", { id: "decisions/berendsen", old: "x", new: "y" }, /only proposed so far/);
  await refused("propose_change", { id: "design/thermostat", old: "A Nosé thermostat", new: "y" }, /is not in The thermostat: copy the text exactly/);
  await refused("propose_change", { id: "design/thermostat", old: "It is simple.", new: "y" }, /more than once/);
  await refused("propose_change", { id: "design/thermostat", old: "# Why", new: "# Why" }, /changes nothing/);
  await refused("propose_move", { from: "design/nowhere", to: "design/there" }, /no note/);
  await refused("propose_move", { from: "design/thermostat", to: "design/integrator" }, /already exists/);
  await refused("propose_move", { from: "design/thermostat", to: "decisions/berendsen" }, /already exists/);
  await refused("delete_note", { id: "design/thermostat" }, /no tool delete_note/);
  expect(p.made).toHaveLength(1);
  expect(readFileSync(join(k, "design/thermostat.md"), "utf8")).toContain("A Berendsen thermostat rescales velocities.");
});

test("several changes to one note are one proposal, each found after the ones before it", async () => {
  const { k, b } = project(), p = new Proposals(k, b);
  await call(p, "propose_change", { id: "/design/thermostat.md", old: "A Berendsen thermostat rescales velocities.", new: "A Berendsen thermostat rescales velocities towards a target." });
  // Spacing that differs still finds the text, and the note's own text is what is kept.
  await call(p, "propose_change", { id: "design/thermostat", old: "rescales   velocities towards a target.", new: "scales them." });
  await call(p, "propose_change", { id: "design/thermostat", old: "", new: "# Limits\n\nIt does not sample the canonical ensemble." });
  await call(p, "propose_move", { from: "design/thermostat", to: "design/berendsen-thermostat" });
  expect(p.made).toEqual([
    { kind: "change", id: "design/thermostat", title: "The thermostat", edits: [
      { old: "A Berendsen thermostat rescales velocities.", new: "A Berendsen thermostat rescales velocities towards a target." },
      { old: "rescales velocities towards a target.", new: "scales them." },
      { old: "", new: "# Limits\n\nIt does not sample the canonical ensemble." }] },
    { kind: "move", from: "design/thermostat", to: "design/berendsen-thermostat", title: "The thermostat", links: 1 },
  ]);
  expect((await call(p, "propose_move", { from: "design/thermostat", to: "design/other" })).text).toMatch(/already proposed/);
  // No more than a request's worth, though a note already being changed may be changed further.
  for (let n = p.made.length; n < MAX_PROPOSALS; n++) await call(p, "propose_note", { id: `ideas/n${n}`, type: "Idea", title: `N${n}`, description: "D", body: "B" });
  expect((await call(p, "propose_note", { id: "ideas/one-more", type: "Idea", title: "T", description: "D", body: "B" })).text).toMatch(/12 proposals are the most/);
  expect((await call(p, "propose_change", { id: "design/thermostat", old: "# Why", new: "# Why it was chosen" })).step.failed).toBeUndefined();
});

test("an accepted proposal is made as an edit in the app is, with the model named in the stamp", () => {
  const { k } = project();
  const made = apply(k, { kind: "create", id: "decisions/berendsen", type: "Decision", title: "Use Berendsen", description: "Why.", tags: ["thermostat"], body: "It is simple." }, by);
  expect(made).toMatchObject({ kind: "create", id: "decisions/berendsen" });
  const text = readFileSync(join(k, "decisions/berendsen.md"), "utf8");
  expect(text).toMatch(/^---\ntype: Decision\ntitle: Use Berendsen\ndescription: Why\.\ntags: \[thermostat\]\ngenerated: \{ ?by: human:ann with openrouter\/anthropic\/claude-sonnet-5\.5, at: [^}]+\}\n---\n\nIt is simple\.\n$/);
  expect(() => apply(k, { kind: "create", id: "decisions/berendsen", type: "Decision", title: "T", description: "", tags: [], body: "B" }, by)).toThrow(/already exists/);

  const edits = [{ old: "A Berendsen thermostat rescales velocities.", new: "A Berendsen thermostat rescales velocities towards a target." }, { old: "", new: "# Limits\n\nNot canonical." }];
  apply(k, { kind: "change", id: "design/thermostat", title: "The thermostat", edits }, by);
  const after = readFileSync(join(k, "design/thermostat.md"), "utf8");
  expect(after).toContain("rescales velocities towards a target.\nIt is simple.\n\n# Why\n\nIt is simple.\n\n# Limits\n\nNot canonical.\n");
  expect(after).toMatch(/by: human:ann with openrouter\/anthropic\/claude-sonnet-5\.5/);
  expect(after).toContain("title: The thermostat"); // the rest of the frontmatter is as it was
  // Accepted twice: the text it replaces is gone, so it is refused and nothing is written again.
  expect(() => apply(k, { kind: "change", id: "design/thermostat", title: "", edits }, by)).toThrow(/has changed since this was proposed.*no longer in it/);
  expect(readFileSync(join(k, "design/thermostat.md"), "utf8")).toBe(after);

  const moved = apply(k, { kind: "move", from: "design/thermostat", to: "design/berendsen-thermostat", title: "", links: 1 }, by);
  expect(moved).toMatchObject({ kind: "move", id: "design/berendsen-thermostat", moved: { moved: [{ from: "design/thermostat", to: "design/berendsen-thermostat" }], rewritten: ["design/integrator.md"] } });
  expect(readFileSync(join(k, "design/integrator.md"), "utf8")).toContain('[the thermostat](/design/berendsen-thermostat.md "requires")');
  expect(existsSync(join(k, "design/thermostat.md"))).toBe(false);
  expect(() => apply(k, { kind: "move", from: "design/thermostat", to: "design/x", title: "", links: 0 }, by)).toThrow(/no such note/);
  expect(loadBundle(k).lint().filter((i) => i.level === "error")).toEqual([]);
});

test("a change is still made after the note changed elsewhere, and refused where its own text changed", () => {
  const { k } = project();
  const path = join(k, "design/thermostat.md");
  writeFileSync(path, readFileSync(path, "utf8").replace("# Why\n\nIt is simple.", "# Why\n\nIt was the first one tried."));
  apply(k, { kind: "change", id: "design/thermostat", title: "", edits: [{ old: "A Berendsen thermostat rescales velocities.", new: "A Berendsen thermostat scales them." }] }, by);
  const text = readFileSync(path, "utf8");
  expect(text).toContain("A Berendsen thermostat scales them.");
  expect(text).toContain("It was the first one tried.");
  expect(() => apply(k, { kind: "change", id: "design/thermostat", title: "", edits: [{ old: "It is simple.\n\n# Why\n\nIt is simple.", new: "x" }] }, by)).toThrow(/no longer in it/);
  expect(changed("a b a", [{ old: "b", new: "c" }])).toBe("a c a");
  // New text that holds the old: made once, and known to be made when asked again.
  const grown = changed("One. Two.", [{ old: "One.", new: "One. And a half." }]);
  expect(grown).toBe("One. And a half. Two.");
  expect(() => changed(grown, [{ old: "One.", new: "One. And a half." }])).toThrow(/already made/);
  expect(() => changed(changed("One.\n", [{ old: "", new: "Two." }]), [{ old: "", new: "Two." }])).toThrow(/already made/);
  expect(changed("One. One and all.", [{ old: "One and", new: "One and" + " only" }])).toBe("One. One and only all.");
  expect(() => changed("a b a", [{ old: "a", new: "c" }])).toThrow(/more than once/);
  for (const bad of [null, {}, { kind: "delete", id: "x" }, { kind: "change", id: "x", edits: [] }, { kind: "change", id: "x", edits: [{ old: 1, new: "y" }] }, { kind: "create", id: "x/y", type: "T" }]) expect(() => read(bad)).toThrow(/expected a proposal/);
});

type Turn = string | { name: string; args: Record<string, unknown> }[];
function script(turns: Turn[], bodies: Record<string, any>[] = []) {
  let n = 0;
  models.setFetch((async (_u: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const turn = turns[Math.min(n++, turns.length - 1)]!;
    const enc = new TextEncoder();
    const deltas = typeof turn === "string" ? [{ content: turn }]
      : turn.map((t, index) => ({ tool_calls: [{ index, id: `c${n}_${index}`, function: { name: t.name, arguments: JSON.stringify(t.args) } }] }));
    const lines = [...deltas.map((delta) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`), `data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 500, completion_tokens: 20, cost: 0.001 } })}\n\n`, "data: [DONE]\n\n"];
    return new Response(new ReadableStream({ start(c) { for (const l of lines) c.enqueue(enc.encode(l)); c.close(); } }), { status: 200 });
  }) as typeof fetch);
  return bodies;
}

test("asked on the Atlas, it proposes only where it is let, and the answer carries what it proposed", async () => {
  const { cfg, k } = project();
  const tools = (body: Record<string, any>) => (body.tools as { function: { name: string } }[]).map((t) => t.function.name);
  // Not let: the tools are not offered, and it is not told of them.
  let bodies = script(["<answer>\nIt is Berendsen.\n</answer>"]);
  const plain = await atlasask.ask(cfg, { question: "Which thermostat?" });
  expect(tools(bodies[0]!)).not.toContain("propose_note");
  expect(JSON.stringify(bodies[0]!.messages)).not.toContain("propose_change");
  expect(plain.answer.proposals).toBeUndefined();
  expect(bodies[0]!.max_tokens).toBe(1600);

  bodies = script([
    [{ name: "read_note", args: { id: "design/thermostat" } }],
    [{ name: "propose_change", args: { id: "design/thermostat", old: "A Berendsen thermostat rescales velocities.", new: "A Berendsen thermostat rescales velocities towards a target temperature." } },
      { name: "propose_note", args: { id: "design/thermostat", type: "Design", title: "T", description: "D", body: "B" } }],
    "<answer>\nI propose saying what it rescales towards.\n</answer>\n<used>\n- /design/thermostat.md | How | \"A Berendsen thermostat rescales velocities.\"\n</used>",
  ]);
  const seen: string[] = [];
  const { answer } = await atlasask.ask(cfg, { question: "Say what it rescales towards.", may: { propose: true } }, { onStep: (s) => seen.push(s.tool) });
  expect(tools(bodies[0]!)).toEqual(expect.arrayContaining(["search_notes", "read_note", "propose_note", "propose_change", "propose_move"]));
  expect(JSON.stringify(bodies[0]!.messages)).toContain("Proposing writes nothing");
  expect(bodies[0]!.max_tokens).toBe(8000);
  expect(answer.proposals).toEqual([{ kind: "change", id: "design/thermostat", title: "The thermostat", edits: [{ old: "A Berendsen thermostat rescales velocities.", new: "A Berendsen thermostat rescales velocities towards a target temperature." }] }]);
  expect(answer.steps.map((s) => [s.tool, !!s.failed])).toEqual([["read_note", false], ["propose_change", false], ["propose_note", true]]); // in the order made; the refusal is kept as a step
  expect(seen).toEqual(["read_note", "propose_change", "propose_note"]);
  expect(answer.used.map((u) => u.note)).toEqual(["design/thermostat"]);
  // The refusal went back to the model, to put right.
  expect((bodies[2]!.messages as { role: string; content: string }[]).filter((m) => m.role === "tool").at(-1)!.content).toMatch(/cannot be proposed: design\/thermostat already exists/);
  expect(readFileSync(join(k, "design/thermostat.md"), "utf8")).not.toContain("target temperature"); // asking wrote nothing
});
