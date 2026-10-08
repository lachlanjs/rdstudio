// Ask Atlas (T85): what the model is told, how its answer is read, and that
// what it says it rests on is checked against what it looked at.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { loadBundle } from "@rdstudio/core/node";
import * as atlasask from "../src/atlasask.ts";
import * as atlasasks from "../src/atlasasks.ts";
import { loadConfig } from "../src/config.ts";
import * as models from "../src/models.ts";

const put = (root: string, rel: string, text: string) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
const note = (title: string, body: string) => `---\ntype: Design\ntitle: ${title}\ndescription: About ${title.toLowerCase()}.\n---\n\n${body}\n`;

function project() {
  const tmp = mkdtempSync(join(tmpdir(), "rdstudio-atlasask-"));
  mkdirSync(join(tmp, "config", "rdstudio"), { recursive: true });
  writeFileSync(join(tmp, "config", "rdstudio", "config.toml"), "");
  process.env.XDG_CONFIG_HOME = join(tmp, "config");
  process.env.XDG_DATA_HOME = join(tmp, "data");
  process.env.OPENROUTER_API_KEY = "sk-test-0123456789";
  const root = join(tmp, "project");
  put(root, "rdstudio.toml", "[project]\ntitle = 'T'\n");
  put(root, "knowledge/index.md", "---\nokf_version: \"0.2\"\n---\n");
  put(root, "knowledge/design/integrator.md", note("The integrator", "Steps the system forward. See [the thermostat](/design/thermostat.md).\n\nIt uses velocity Verlet."));
  put(root, "knowledge/design/thermostat.md", note("The thermostat", "# How\n\nA **Berendsen** thermostat rescales velocities towards a target temperature. See [units](/design/units.md).\n\n# Why\n\nIt is simple."));
  put(root, "knowledge/design/units.md", note("Units", "Temperatures are in kelvin."));
  put(root, "knowledge/decisions/forces.md", note("The forces", "Gravity is softened."));
  put(root, "src/sim.py", "def rescale(v, t):\n    return v\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "-A"], { cwd: root });
  return { root, cfg: loadConfig(root) };
}
afterEach(() => models.setFetch((...a) => fetch(...a)));

type Turn = string | { name: string; args: Record<string, unknown> }[] | { error: string };
function script(turns: Turn[], bodies: Record<string, any>[] = []) {
  let n = 0;
  models.setFetch((async (_u: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const turn = turns[Math.min(n++, turns.length - 1)]!;
    if (!Array.isArray(turn) && typeof turn === "object") return new Response(JSON.stringify({ error: { message: turn.error } }), { status: 404 });
    const enc = new TextEncoder();
    const deltas = typeof turn === "string" ? [{ content: turn }]
      : turn.map((t, index) => ({ tool_calls: [{ index, id: `c${n}_${index}`, function: { name: t.name, arguments: JSON.stringify(t.args) } }] }));
    const lines = [...deltas.map((delta) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`), `data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 500, completion_tokens: 20, cost: 0.001 } })}\n\n`, "data: [DONE]\n\n"];
    return new Response(new ReadableStream({ start(c) { for (const l of lines) c.enqueue(enc.encode(l)); c.close(); } }), { status: 200 });
  }) as typeof fetch);
  return bodies;
}
const said = (p: atlasask.Prepared) => p.seen.map((s) => s.text).join("\n\n");

test("the model is told where the asker is: a selected note, a folder, or the whole map", () => {
  const { cfg } = project();
  const whole = said(atlasask.prepare(cfg, { question: "How is temperature held?" }));
  expect(whole).toContain("the whole map: 4 notes. Its folders: decisions (1), design (3).");
  expect(whole).toContain("You have 6 rounds");
  expect(whole).toContain("## Their question\n\nHow is temperature held?");
  expect(whole).not.toContain("Berendsen"); // nothing is looked up for it
  const onNote = atlasask.prepare(cfg, { question: "?", start: "/design/integrator.md", tier: "low" });
  expect(onNote.note).toBe("design/integrator");
  expect(said(onNote)).toContain("They have this note selected: The integrator (/design/integrator.md): About the integrator.");
  expect(said(onNote)).toContain("- The thermostat (/design/thermostat.md)");
  expect(said(onNote)).toContain("You have 3 rounds");
  const onFolder = atlasask.prepare(cfg, { question: "?", start: "design" });
  expect(onFolder.note).toBe("");
  expect(said(onFolder)).toContain("the folder design/ (3 notes)");
  expect(() => atlasask.prepare(cfg, { question: "  " })).toThrow(/ask a question/);
  expect(() => atlasask.prepare(cfg, { question: "x".repeat(2001) })).toThrow(/too long/);
});

test("an answer names the notes it rests on, each with how it was reached; a quote not in the note is not shown as one", async () => {
  const { cfg } = project();
  const bodies = script([
    [{ name: "search_notes", args: { query: "thermostat temperature" } }],
    [{ name: "read_note", args: { id: "/design/thermostat.md", section: "How" } }],
    [{ name: "read_note", args: { id: "/design/units.md" } }, { name: "read_code", args: { path: "src/sim.py" } }],
    "<answer>\nA Berendsen thermostat holds it, see [The thermostat](/design/thermostat.md).\n</answer>\n<used>\n" +
      "- /design/thermostat.md | How | \"A **Berendsen** thermostat rescales velocities towards a target temperature. See [units](/design/units.md).\"\n" +
      "- /design/units.md | | \"Temperatures are in celsius.\"\n" +
      "- /decisions/forces.md | | \"Gravity is softened.\"\n" +
      "- /design/nowhere.md | | \"Nothing.\"\n</used>",
  ]);
  const steps: string[] = [];
  let streamed = "";
  const { answer: a } = await atlasask.ask(cfg, { question: "How is temperature held?", start: "design/integrator" }, { onStep: (s) => steps.push(s.said), onText: (t) => { streamed += t; } });
  expect(bodies).toHaveLength(4);
  expect(steps).toEqual(['Searched the notes for "thermostat temperature": 3 found', 'Read "How" in The thermostat', "Read Units", "Read src/sim.py, lines 1 to 3"]);
  expect(a.answer).toBe("A Berendsen thermostat holds it, see [The thermostat](/design/thermostat.md).");
  expect(a.used).toEqual([
    // Reached by a link from the note selected; the quote is in the note, and is shown as plain words.
    { note: "design/thermostat", title: "The thermostat", section: "How", quote: "A Berendsen thermostat rescales velocities towards a target temperature. See units.", checked: true, how: "link", from: "design/integrator" },
    // A chain: units is linked from the thermostat. Its quote is not in the note, so what was read is shown instead.
    { note: "design/units", title: "Units", quote: "Temperatures are in kelvin.", checked: false, how: "link", from: "design/thermostat" },
  ]); // forces was never looked at, and nowhere is no note: neither is rested on
  expect(a.code).toEqual([{ kind: "code", id: "src/sim.py", title: "src/sim.py", line: 1 }]);
  expect(a).toMatchObject({ question: "How is temperature held?", tier: "mid", model: models.DEFAULT_TIERS.mid });
  expect(a.cost).toBeCloseTo(0.004);
  expect(streamed).toContain("<answer>");
});

test("a reply not in the form is still an answer, and the notes it links to are what it rests on", () => {
  const { cfg } = project();
  const b = loadBundle(cfg.knowledgeDir);
  const steps = [{ tool: "search_notes", args: {}, said: "", how: "search" as const, notes: ["design/units", "design/thermostat"] }];
  const r = atlasask.parseAnswer("Kelvin, says [Units](/design/units.md \"uses\").\n<used>\n- design/thermostat | Why | \"It is simple.\"", b, steps);
  expect(r.answer).toBe('Kelvin, says [Units](/design/units.md "uses").');
  expect(r.used.map((u) => [u.note, u.how, u.checked, u.quote])).toEqual([["design/thermostat", "search", true, "It is simple."], ["design/units", "search", false, "About units."]]);
});

test("a model that cannot call tools is given a search's finds, and the steps are still kept for the map", async () => {
  const { cfg } = project();
  const bodies = script([{ error: "No endpoints found that support tool use." }, "<answer>Berendsen.</answer>\n<used>\n- /design/thermostat.md | | \"It is simple.\"\n</used>"]);
  const { answer: a } = await atlasask.ask(cfg, { question: "thermostat", tier: "low" });
  expect(bodies).toHaveLength(2);
  expect(bodies[1]!.tools).toBeUndefined();
  const sent = JSON.stringify(bodies[1]!.messages);
  expect(sent).toContain("Looked up for you");
  expect(sent).toContain("Berendsen");
  expect(a.steps.map((s) => s.tool)).toEqual(["search_notes", "read_note", "read_note"]);
  expect(a.used).toMatchObject([{ note: "design/thermostat", checked: true }]);
});

test("a finished answer is kept in the learner record with what it used, and read back with what has changed since (T93, T94)", async () => {
  const { root, cfg } = project();
  const turns: Turn[] = [[{ name: "search_notes", args: { query: "thermostat" } }], [{ name: "read_note", args: { id: "/design/integrator.md" } }], [{ name: "read_note", args: { id: "/design/thermostat.md", section: "How" } }],
    '<answer>\nBy [the thermostat](/design/thermostat.md).\n</answer>\n<used>\n- /design/thermostat.md | How | "A Berendsen thermostat rescales velocities towards a target temperature."\n</used>'];
  script(turns);
  const status = () => execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  const before = status();
  const { answer } = await atlasask.ask(cfg, { question: "How is temperature held?", tier: "low" });
  // What it used, over every round: four calls to the model.
  expect(answer.spent).toEqual({ calls: 4, input: 2000, output: 80, cached: 0 });
  expect(answer.cost).toBeCloseTo(0.004);

  // Nothing is kept where the learner record is off.
  expect(atlasasks.keep(cfg, answer, "design")).toBeNull();
  expect(atlasasks.list(cfg)).toEqual([]);
  writeFileSync(join(process.env.XDG_CONFIG_HOME!, "rdstudio", "config.toml"), "[learner]\nenabled = true\n");
  const kept = atlasasks.keep(cfg, answer, "design")!;
  expect(kept.from).toEqual({ ref: "design", kind: "folder" });
  expect(Object.keys(kept.notes).sort()).toEqual(["design/integrator", "design/thermostat"]);
  expect(atlasasks.keep(cfg, answer, "/design/units.md")!.from).toEqual({ ref: "design/units", kind: "note" });
  expect(atlasasks.list(cfg).map((a) => a.question)).toEqual(["How is temperature held?", "How is temperature held?"]);
  expect(status()).toBe(before); // not in the repository

  // As it was: nothing has changed, and its sentence is still in the note.
  expect(atlasasks.read(cfg, kept.id).since).toEqual({ gone: [], changed: [], links: [], quotes: { "design/thermostat": true } });
  // The note is reworded: changed, and the sentence is no longer in it.
  put(root, "knowledge/design/thermostat.md", note("The thermostat", "# How\n\nVelocities are rescaled."));
  expect(atlasasks.read(cfg, kept.id).since).toEqual({ gone: [], changed: ["design/thermostat"], links: [], quotes: { "design/thermostat": false } });
  // The link it followed is taken out of the note it was followed from.
  put(root, "knowledge/design/integrator.md", note("The integrator", "Steps the system forward."));
  expect(atlasasks.read(cfg, kept.id).since.links).toEqual([{ from: "design/integrator", to: "design/thermostat" }]);
  // The note is gone.
  rmSync(join(root, "knowledge/design/thermostat.md"));
  const since = atlasasks.read(cfg, kept.id).since;
  expect(since.gone).toEqual(["design/thermostat"]);
  expect(since.links).toEqual([]);

  expect(() => atlasasks.read(cfg, "../../etc/passwd")).toThrow("not a kept question's id");
  atlasasks.forget(cfg, kept.id);
  expect(atlasasks.list(cfg)).toHaveLength(1);
  expect(() => atlasasks.read(cfg, kept.id)).toThrow("no such kept question");
});
