// An agent in the editor (T74): what the model is given, how its reply is
// read, and how a note says a model wrote part of it.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import * as assist from "../src/assist.ts";
import { loadConfig } from "../src/config.ts";
import { noteSource, saveNote, withModels } from "../src/edit.ts";
import * as models from "../src/models.ts";

const put = (root: string, rel: string, text: string) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
const note = (title: string, body: string, extra = "") => `---\ntype: Design\ntitle: ${title}\ndescription: About ${title.toLowerCase()}.\n${extra}---\n\n${body}\n`;

function project() {
  const tmp = mkdtempSync(join(tmpdir(), "rdstudio-assist-"));
  mkdirSync(join(tmp, "config", "rdstudio"), { recursive: true });
  writeFileSync(join(tmp, "config", "rdstudio", "config.toml"), "");
  process.env.XDG_CONFIG_HOME = join(tmp, "config");
  process.env.XDG_DATA_HOME = join(tmp, "data");
  process.env.OPENROUTER_API_KEY = "sk-test-0123456789";
  const root = join(tmp, "project");
  put(root, "rdstudio.toml", "[project]\ntitle = 'T'\n\n[teacher]\nprofile = \"codebase\"\n");
  put(root, "knowledge/index.md", "---\nokf_version: \"0.2\"\n---\n");
  put(root, "knowledge/design/integrator.md", note("The integrator", "Steps the system forward. See [the forces](/design/forces.md) and [units](units.md).\n\nIt uses velocity Verlet."));
  put(root, "knowledge/design/forces.md", note("The forces", "Gravity is softened so close pairs do not blow up."));
  put(root, "knowledge/design/units.md", note("Units", "Lengths in nanometres."));
  put(root, "knowledge/design/thermostat.md", note("The thermostat", "A Berendsen thermostat rescales velocities towards a target temperature."));
  put(root, "src/sim.py", "import math\n\n\ndef kinetic_energy(masses, velocities):\n    \"\"\"Half the sum of m v squared.\"\"\"\n    return 0.5 * sum(m * v * v for m, v in zip(masses, velocities))\n\n\nclass Thermostat:\n    def rescale(self, velocities):\n        return velocities\n");
  put(root, "src/step.rs", "pub fn leapfrog_step(dt: f64) -> f64 {\n    dt * 2.0\n}\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "-A"], { cwd: root });
  return { root, cfg: loadConfig(root) };
}
const said = (p: assist.Prepared) => p.seen.map((s) => s.text).join("\n\n");
afterEach(() => models.setFetch((...a) => fetch(...a)));

test("the place is marked in the note: a passage, or a point; a long note is cut to a window round it", () => {
  expect(assist.marked("one two three", 4, 7)).toBe("one ⟦two⟧ three");
  expect(assist.marked("one two three", 7, 4)).toBe("one ⟦two⟧ three");
  expect(assist.marked("one two", 4, 4)).toBe("one ⟦HERE⟧two");
  const long = "a ".repeat(20000) + "TARGET" + " b".repeat(20000), at = long.indexOf("TARGET");
  const cut = assist.marked(long, at, at + 6);
  expect(cut.length).toBeLessThan(15000);
  expect(cut).toContain("⟦TARGET⟧");
  expect(cut.startsWith("[…]") && cut.endsWith("[…]")).toBe(true);
});

test("names to look up in the code: what is in backticks, and words that look like identifiers or paths", () => {
  expect(assist.codeNames("Show `Thermostat` and kinetic_energy from src/sim.py, the LennardJones force, and nanosim::Vec3. Plain words are not names."))
    .toEqual(["Thermostat", "kinetic_energy", "src/sim.py", "LennardJones", "nanosim::Vec3"]);
});

test("for a model that cannot call tools, it is given the note with the place marked, the notes it links to, notes found by searching, and code by name", () => {
  const { cfg } = project();
  const body = "The integrator keeps the temperature steady with a thermostat.\n\nSee [the forces](/design/forces.md \"requires\") and [units](units.md).\n";
  const at = body.indexOf("thermostat");
  const p = assist.prepare(cfg, { note: "design/integrator", mode: "fill", body, from: at, to: at, prompt: "Insert the code of `kinetic_energy` and of leapfrog_step here." }, { gather: true });
  const text = said(p);
  expect(text).not.toContain("## Looking things up");
  expect(text).toContain("with a ⟦HERE⟧thermostat");
  expect(text).toContain("Gravity is softened"); // linked, by a bundle-absolute path
  expect(text).toContain("Lengths in nanometres"); // linked, relative to the note
  expect(text).toContain("Berendsen"); // found by searching
  expect(text).toContain("def kinetic_energy(masses, velocities)"); // from the index (Python)
  expect(text).toContain("pub fn leapfrog_step"); // from the files (a language the index does not read)
  expect(text).toMatch(/src\/sim\.py:\d+/);
  expect(p.sources.filter((s) => s.kind === "note").map((s) => s.id)).toEqual(expect.arrayContaining(["design/forces", "design/units", "design/thermostat"]));
  expect(p.sources.filter((s) => s.kind === "code").map((s) => s.id)).toEqual(expect.arrayContaining(["src/sim.py", "src/step.rs"]));
  expect(p.job).toBe("write");
  expect(p.messages.at(-1)!.role).toBe("user");
  // A note not yet saved can be asked about too.
  expect(() => assist.prepare(cfg, { note: "design/new-note", mode: "ask", body: "Draft.", from: 0, to: 5 })).not.toThrow();
  expect(() => assist.prepare(cfg, { note: "design/new-note", mode: "ask", body: "Draft.", from: 0, to: 0 })).toThrow(/ask something/);
});

test("a fill's reply is the text proposed and why; the marks never come back in it", () => {
  expect(assist.parseFill("<insert>\n```python\nx = 1\n```\n</insert>\n<why>\nFrom `src/sim.py:4`.\n</why>")).toEqual({ insert: "```python\nx = 1\n```", why: "From `src/sim.py:4`." });
  expect(assist.parseFill("<insert>⟦HERE⟧New text⟧</insert>").insert).toBe("New text");
  expect(assist.parseFill("I cannot find that function.")).toEqual({ insert: null, why: "I cannot find that function." });
});

test("asking streams the reply and logs the cost by feature; nothing is written", async () => {
  const { root, cfg } = project();
  const before = readFileSync(join(root, "knowledge/design/integrator.md"), "utf8");
  const seen: { body?: Record<string, unknown> } = {};
  const reply = "<insert>\nIt conserves energy well.\n</insert>\n<why>\nFrom the note on forces.\n</why>";
  models.setFetch((async (_u: unknown, init?: RequestInit) => {
    seen.body = JSON.parse(String(init?.body));
    const enc = new TextEncoder(), lines = [`data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 900, completion_tokens: 30, cost: 0.004 } })}\n\n`, "data: [DONE]\n\n"];
    return new Response(new ReadableStream({ start(c) { for (const l of lines) c.enqueue(enc.encode(l)); c.close(); } }), { status: 200 });
  }) as typeof fetch);
  let streamed = "";
  const body = "It uses velocity Verlet.";
  const { reply: r } = await assist.ask(cfg, { note: "design/integrator", mode: "fill", body, from: body.length, to: body.length, prompt: "Say why." }, (t) => { streamed += t; });
  expect(streamed).toBe(reply);
  expect(r).toMatchObject({ mode: "fill", insert: "It conserves energy well.", answer: "From the note on forces.", from: body.length, to: body.length, cost: 0.004 });
  expect(seen.body!.model).toBe(models.DEFAULT_TIERS.mid); // a tier's model, not a job's (T83)
  expect(r.tier).toBe("mid");
  expect(models.usageLog().at(-1)).toMatchObject({ feature: "note-fill", cost: 0.004 });
  expect(readFileSync(join(root, "knowledge/design/integrator.md"), "utf8")).toBe(before);
});

test("a note says a model wrote part of it: the stamp names it, and a small edit does not move the stamp's time", () => {
  expect(withModels("human:me", ["anthropic/claude-sonnet-5.5"])).toBe("human:me with openrouter/anthropic/claude-sonnet-5.5");
  expect(withModels("human:me with openrouter/a/b", ["a/b", "c/d"])).toBe("human:me with openrouter/a/b, openrouter/c/d");
  expect(withModels("human:me", [])).toBe("human:me");
  expect(withModels("human:me", ["bad name; rm"])).toBe("human:me");
  const { root } = project();
  const k = join(root, "knowledge");
  put(root, "knowledge/design/stamped.md", note("Stamped", "One line here.\n\nAnd a second paragraph with enough in it to be a real note about the integrator.", "generated: { by: claude-code/x, at: 2026-01-01T00:00:00Z }\n"));
  // A small edit with accepted text: the time stays, the model is named.
  let src = noteSource(k, "design/stamped");
  let r = saveNote(k, "design/stamped", { actor: "human:me", base: src.version, body: src.body.replace("One line here.", "One line here!"), assist: ["anthropic/claude-sonnet-5.5"] });
  expect(r.significant).toBe(false);
  expect(r.note.meta.generated).toMatchObject({ by: "claude-code/x with openrouter/anthropic/claude-sonnet-5.5" });
  expect(new Date((r.note.meta.generated as { at: string }).at).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  // A significant one: the person's edit, with the model named.
  src = r.note;
  r = saveNote(k, "design/stamped", { actor: "human:me", base: src.version, body: "# Rewritten\n\nA completely different account, proposed in the editor and accepted by the person writing.\n", assist: ["anthropic/claude-sonnet-5.5"] });
  expect(r.significant).toBe(true);
  expect((r.note.meta.generated as { by: string }).by).toBe("human:me with openrouter/anthropic/claude-sonnet-5.5");
  expect((r.note.meta.generated as { at: string }).at).not.toMatch(/^2026-01-01/);
  // Without accepted text nothing changes in how a save is stamped.
  src = r.note;
  r = saveNote(k, "design/stamped", { actor: "human:me", base: src.version, body: "# Rewritten again\n\nA third account, typed by hand this time and saved as any other edit would be.\n" });
  expect((r.note.meta.generated as { by: string }).by).toBe("human:me");
});

test("the model is told how notes work here: a rating is a link's title, and a change of form changes only that (T81)", () => {
  const { cfg } = project();
  const body = "- [x] [The forces](/design/forces.md)\n- [ ] [Units](/design/units.md)\n";
  const p = assist.prepare(cfg, { note: "design/integrator", mode: "fill", body, from: 0, to: body.length, prompt: "make these see also links" });
  const text = said(p);
  expect(text).toContain("## How notes work here");
  expect(text).toContain('(/tasks/T01.md "see also")');
  for (const r of ["requires", "uses", "see also"]) expect(assist.FORMAT).toContain(`"${r}"`);
  expect(text).toContain("change only that");
  // In every mode, and before the note, where it is cached.
  for (const mode of ["ask", "figure"] as const) expect(said(assist.prepare(cfg, { note: "design/integrator", mode, body, from: 0, to: body.length, prompt: "x" }))).toContain("## How notes work here");
  expect(text.indexOf("## How notes work here")).toBeLessThan(text.indexOf("## The note being written"));
});

test("a long passage is sent whole with room for it to come back; one too long is refused; a reply cut short proposes nothing (T81)", () => {
  const { cfg } = project();
  const line = (i: number) => `- [x] [T${i} A task with a fairly long title](/tasks/T${i}-a-task.md)\n`;
  const body = "# Start\n\n" + Array.from({ length: 400 }, (_, i) => line(i)).join("") + "\n# End\n";
  expect(body.length).toBeGreaterThan(20_000);
  const p = assist.prepare(cfg, { note: "tasks/roadmap", mode: "fill", body, from: 0, to: body.length, prompt: "rate them see also" });
  const sent = p.seen.find((s) => s.name.startsWith("The note being written"))!;
  expect(sent.shortened).toBe(false);
  expect(sent.text).toContain("T0 A task");
  expect(sent.text).toContain("T399 A task");
  expect(sent.text).toContain("# End");
  expect(assist.fillTokens(body.length) * 3).toBeGreaterThan(body.length * 1.3);
  expect(assist.fillTokens(10)).toBe(2000);
  const huge = "x ".repeat(assist.MAX_PASSAGE);
  expect(() => assist.prepare(cfg, { note: "a", mode: "fill", body: huge, from: 0, to: huge.length, prompt: "tidy" })).toThrow(/too long to rewrite at once/);
  expect(assist.prepare(cfg, { note: "a", mode: "ask", body: huge, from: 0, to: huge.length, prompt: "what is this" }).job).toBe("discuss");
  const cut = assist.parseFill("<insert>\n- [x] [T0](/tasks/T0.md \"see also\")\n- [x] [T1");
  expect(cut.insert).toBeNull();
  expect(cut.why).toMatch(/cut short/);
});

test("a request is asked at a tier, each a model the person sets; a figure is asked at the highest unless told otherwise (T83)", async () => {
  const { cfg } = project();
  const conf = join(process.env.XDG_CONFIG_HOME!, "rdstudio", "config.toml");
  writeFileSync(conf, "[actors]\nhuman = \"human:me\"\n\n[teacher]\nweekly_budget = 5\n");
  expect(models.tiers()).toEqual(models.DEFAULT_TIERS);
  expect(models.setTiers({ low: "google/gemini-3.8-flash" })).toEqual({ ...models.DEFAULT_TIERS, low: "google/gemini-3.8-flash" });
  expect(models.setTiers({ max: " openai/gpt-x:thinking " }).max).toBe("openai/gpt-x:thinking");
  // The table is written once, whole; the rest of the file is as it was.
  const text = readFileSync(conf, "utf8");
  expect(text.startsWith("[actors]\nhuman = \"human:me\"\n\n[teacher]\nweekly_budget = 5\n")).toBe(true);
  expect(text.match(/\[teacher\.tiers\]/g)).toHaveLength(1);
  expect(models.tiers()).toEqual({ low: "google/gemini-3.8-flash", mid: models.DEFAULT_TIERS.mid, max: "openai/gpt-x:thinking" });
  expect(models.weeklyBudget()).toBe(5);
  expect(() => models.setTiers({ mid: "not a model" })).toThrow(/not a model's id/);
  expect(() => models.setTiers({ mid: "" })).toThrow(/not a model's id/);

  const asked: string[] = [];
  models.setFetch((async (_u: unknown, init?: RequestInit) => {
    asked.push(JSON.parse(String(init?.body)).model);
    const enc = new TextEncoder(), lines = [`data: ${JSON.stringify({ choices: [{ delta: { content: "Yes." } }] })}\n\n`, `data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { cost: 0.001 } })}\n\n`, "data: [DONE]\n\n"];
    return new Response(new ReadableStream({ start(c) { for (const l of lines) c.enqueue(enc.encode(l)); c.close(); } }), { status: 200 });
  }) as typeof fetch);
  const body = "It uses velocity Verlet.";
  const base = { note: "design/integrator", body, from: 0, to: body.length, prompt: "Is it?" };
  expect((await assist.ask(cfg, { ...base, mode: "ask", tier: "low" })).reply).toMatchObject({ tier: "low", model: "google/gemini-3.8-flash" });
  await assist.ask(cfg, { ...base, mode: "ask" });
  await assist.ask(cfg, { ...base, mode: "figure" });
  await assist.ask(cfg, { ...base, mode: "figure", tier: "low" });
  expect(asked).toEqual(["google/gemini-3.8-flash", models.DEFAULT_TIERS.mid, "openai/gpt-x:thinking", "google/gemini-3.8-flash"]);
});

// ------------------------------------------------------------------ looking things up (T84)

/** A fake OpenRouter that plays a script: each turn is text, or the tools to call. */
type Turn = string | { name: string; args: Record<string, unknown> }[];
function script(turns: Turn[], bodies: Record<string, any>[] = []) {
  let n = 0;
  models.setFetch((async (_u: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const turn = turns[Math.min(n++, turns.length - 1)]!;
    const enc = new TextEncoder();
    const deltas = typeof turn === "string" ? [{ content: turn }]
      // A call arrives in pieces: its name first, its arguments in two halves.
      : [{ content: "Let me look." }, ...turn.flatMap((t, index) => { const a = JSON.stringify(t.args), h = Math.ceil(a.length / 2);
        return [{ tool_calls: [{ index, id: `c${n}_${index}`, function: { name: t.name, arguments: "" } }] }, { tool_calls: [{ index, function: { arguments: a.slice(0, h) } }] }, { tool_calls: [{ index, function: { arguments: a.slice(h) } }] }]; })];
    const lines = [...deltas.map((delta) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`), `data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 500, completion_tokens: 20, cost: 0.001 } })}\n\n`, "data: [DONE]\n\n"];
    return new Response(new ReadableStream({ start(c) { for (const l of lines) c.enqueue(enc.encode(l)); c.close(); } }), { status: 200 });
  }) as typeof fetch);
  return bodies;
}

test("as a rule the model is given only the note and the titles of what it links to, and told how to look things up (T84)", () => {
  const { cfg } = project();
  const body = "The integrator keeps the temperature steady with a thermostat.\n\nSee [the forces](/design/forces.md \"requires\") and [units](units.md).\n";
  const p = assist.prepare(cfg, { note: "design/integrator", mode: "fill", body, from: 0, to: 14, prompt: "Insert the code of `kinetic_energy` here." });
  const text = said(p);
  expect(text).toContain("## Looking things up");
  expect(text).toContain("You have 6 rounds"); // the usual tier for text, mid
  expect(said(assist.prepare(cfg, { note: "design/integrator", mode: "fill", tier: "low", body, from: 0, to: 14, prompt: "x" }))).toContain("You have 3 rounds");
  expect(text).toContain("- The forces (/design/forces.md): About the forces.");
  expect(text).toContain("- Units (/design/units.md)");
  for (const absent of ["Gravity is softened", "Lengths in nanometres", "Berendsen", "def kinetic_energy", "## Code from the repository", "## Notes found by searching"]) expect(text).not.toContain(absent);
  expect(p.sources).toEqual([]);
  expect(text.length).toBeLessThan(said(assist.prepare(cfg, { note: "design/integrator", mode: "fill", body, from: 0, to: 14, prompt: "Insert the code of `kinetic_energy` here." }, { gather: true })).length + 2500);
});

test("the model looks things up in rounds: each call is run and answered, the steps are kept, and what it opened is what it drew on (T84)", async () => {
  const { cfg } = project();
  const bodies = script([
    [{ name: "search_notes", args: { query: "thermostat temperature" } }, { name: "search_code", args: { text: "kinetic_energy" } }],
    [{ name: "outline_note", args: { id: "/design/forces.md" } }, { name: "read_note", args: { id: "design/thermostat" } }, { name: "read_code", args: { path: "src/sim.py", from: 4, to: 6 } }],
    "It rescales velocities, as [The thermostat](/design/thermostat.md) says.",
  ]);
  const steps: string[] = [];
  let streamed = "";
  const body = "It uses velocity Verlet. See [the forces](/design/forces.md).";
  const { reply: r } = await assist.ask(cfg, { note: "design/integrator", mode: "ask", body, from: 0, to: 5, prompt: "How is temperature held?" }, { onText: (t) => { streamed += t; }, onStep: (s) => steps.push(s.said) });
  expect(bodies).toHaveLength(3);
  // Tools are offered each round, and the conversation carries the calls and their results.
  expect(bodies[0]!.tools.map((t: any) => t.function.name)).toEqual(["search_notes", "outline_note", "read_note", "search_symbols", "outline_code", "search_code", "read_code"]);
  expect(bodies[0]!.tool_choice).toBe("auto");
  const last = bodies[2]!.messages;
  expect(last.filter((m: any) => m.role === "tool")).toHaveLength(5);
  expect(last.find((m: any) => m.role === "assistant").tool_calls[0]).toMatchObject({ id: "c1_0", type: "function", function: { name: "search_notes", arguments: '{"query":"thermostat temperature"}' } });
  const results = last.filter((m: any) => m.role === "tool").map((m: any) => m.content as string);
  expect(results[0]).toContain("The thermostat (/design/thermostat.md)");
  expect(results[1]).toMatch(/src\/sim\.py:4:def kinetic_energy/);
  expect(results[2]).toContain("Linked from: The integrator (/design/integrator.md)");
  expect(results[3]).toContain("Berendsen thermostat rescales");
  expect(results[4]).toContain("4\tdef kinetic_energy(masses, velocities):");
  expect(steps).toEqual(['Searched the notes for "thermostat temperature": 1 found', 'Searched the code for "kinetic_energy": 1 lines found', "Looked at the outline of The forces", "Read The thermostat", "Read src/sim.py, lines 4 to 6"]);
  // How each was reached: the forces by a link from the note being written; the thermostat by reading it outright.
  expect(r.steps.map((s) => [s.tool, s.how, s.from ?? null])).toEqual([["search_notes", "search", null], ["search_code", "code", null], ["outline_note", "link", "design/integrator"], ["read_note", "read", null], ["read_code", "code", null]]);
  expect(r.steps[3]!.excerpt).toContain("Berendsen");
  expect(r.sources).toEqual([{ kind: "note", id: "design/forces", title: "The forces" }, { kind: "note", id: "design/thermostat", title: "The thermostat" }, { kind: "code", id: "src/sim.py", title: "src/sim.py", line: 4 }]);
  expect(r.answer).toBe("It rescales velocities, as [The thermostat](/design/thermostat.md) says.");
  expect(r.cost).toBeCloseTo(0.003);
  expect(streamed.endsWith(r.answer)).toBe(true);
});

test("a request that needs nothing looked up is one call; the rounds run out at the tier's count, and then it must reply (T84)", async () => {
  const { cfg } = project();
  const one = script(["<insert>\n- [The forces](/design/forces.md \"see also\")\n</insert>\n<why>Rated.</why>"]);
  const body = "- [The forces](/design/forces.md)";
  const r1 = (await assist.ask(cfg, { note: "design/integrator", mode: "fill", tier: "low", body, from: 0, to: body.length, prompt: "see also" })).reply;
  expect(one).toHaveLength(1);
  expect(r1).toMatchObject({ insert: '- [The forces](/design/forces.md "see also")', steps: [], sources: [] });
  // A model that never stops looking: low has three rounds, and the fourth call forbids tools.
  const many = script([[{ name: "search_notes", args: { query: "forces" } }], [{ name: "search_notes", args: { query: "units" } }], [{ name: "search_notes", args: { query: "gravity" } }], "Enough."]);
  const r2 = (await assist.ask(cfg, { note: "design/integrator", mode: "ask", tier: "low", body, from: 0, to: 5, prompt: "?" })).reply;
  expect(many.map((b) => b.tool_choice)).toEqual(["auto", "auto", "auto", "none"]);
  expect(r2.steps).toHaveLength(3);
  expect(r2.answer).toBe("Enough.");
});

test("what is looked up stays inside: a wrong id says so, and only files git tracks are read (T84)", async () => {
  const { cfg, root } = project();
  put(root, "secret.env", "TOKEN=abc\n"); // not added to git
  const b = (await import("@rdstudio/core/node")).loadBundle(cfg.knowledgeDir);
  const { Lookup, noteId } = await import("../src/lookup.ts");
  const look = new Lookup(cfg, b, "design/integrator");
  expect(noteId(b, "[the forces](/design/forces.md \"requires\")")).toBe("design/forces");
  expect(noteId(b, "knowledge/design/forces.md")).toBe("design/forces");
  expect(look.run("read_note", '{"id":"design/nowhere"}')).toMatch(/There is no note/);
  expect(look.run("read_note", '{"id":"design/forces","section":"Nope"}')).toMatch(/There is no section "Nope"/);
  for (const path of ["secret.env", "../outside.txt", "/etc/passwd", "knowledge/../../x"]) expect(look.run("read_code", JSON.stringify({ path }))).toMatch(/is not a file of this repository/);
  expect(look.run("read_code", '{"path":"src/step.rs"}')).toContain("pub fn leapfrog_step");
  expect(look.run("search_code", '{"text":"Gravity is softened"}')).toMatch(/Nothing in the code matches/); // the knowledge base is not code
  expect(look.run("search_code", '{"text":"TOKEN"}')).toMatch(/Nothing in the code matches/);
  expect(look.run("delete_everything", "{}")).toMatch(/There is no tool/);
  expect(look.run("search_notes", "not json")).toMatch(/needs a query/);
  expect(look.steps.filter((s) => s.failed)).toHaveLength(8);
});

test("a model that cannot call tools is given what it would have looked up, in one call (T84)", async () => {
  const { cfg } = project();
  const bodies: Record<string, any>[] = [];
  let n = 0;
  models.setFetch((async (_u: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    if (n++ === 0) return new Response(JSON.stringify({ error: { message: "No endpoints found that support tool use." } }), { status: 404 });
    const enc = new TextEncoder(), lines = [`data: ${JSON.stringify({ choices: [{ delta: { content: "Softened." } }] })}\n\n`, `data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { cost: 0.002 } })}\n\n`, "data: [DONE]\n\n"];
    return new Response(new ReadableStream({ start(c) { for (const l of lines) c.enqueue(enc.encode(l)); c.close(); } }), { status: 200 });
  }) as typeof fetch);
  const body = "See [the forces](/design/forces.md).";
  const { reply: r, seen } = await assist.ask(cfg, { note: "design/integrator", mode: "ask", body, from: 0, to: 3, prompt: "Why?" });
  expect(bodies).toHaveLength(2);
  expect(bodies[1]!.tools).toBeUndefined();
  expect(seen.map((s) => s.text).join("\n")).toContain("Gravity is softened");
  expect(r).toMatchObject({ answer: "Softened.", steps: [] });
  expect(r.sources[0]).toMatchObject({ kind: "note", id: "design/forces" });
});

test("where the code is indexed, it is found by what it is for and outlined; where it is not, the tools say so (T86)", async () => {
  const { cfg, root } = project();
  const b = (await import("@rdstudio/core/node")).loadBundle(cfg.knowledgeDir);
  const { Lookup } = await import("../src/lookup.ts");
  const look = new Lookup(cfg, b, "design/integrator");
  // No name given: found by the words of its comment, and by the parts of its name.
  const byDoc = look.run("search_symbols", '{"query":"half the sum of squared velocity"}');
  expect(byDoc.split("\n")[0]).toMatch(/^src\/sim\.py:4 function .*kinetic_energy.* — Half the sum of m v squared\.$/);
  expect(look.run("search_symbols", '{"query":"energy","kind":"class"}')).toMatch(/No function, class or constant matches/);
  expect(look.run("search_symbols", '{"query":"rescale thermostat","path":"src"}')).toMatch(/src\/sim\.py:10 method/);
  expect(look.steps[0]).toMatchObject({ how: "code", code: { path: "src/sim.py", line: 4 }, said: 'Searched the code\'s symbols for "half the sum of squared velocity": 2 found' });
  const top = look.run("outline_code", "{}");
  expect(top).toContain("- src/ (folder,");
  expect(look.run("outline_code", '{"path":"src/"}')).toContain("- src/sim.py (python, 2 at its top)");
  const file = look.run("outline_code", '{"path":"./src/sim.py"}');
  expect(file).toMatch(/- 4 function .*kinetic_energy.*\n- 9 class Thermostat.*\n  - 10 method .*rescale/);
  expect(look.run("outline_code", '{"path":"src/step.rs"}')).toMatch(/No classes, functions or constants|is not a folder or a file in the code index/); // a language the index does not read
  expect(look.run("outline_code", '{"path":"../x"}')).toMatch(/outside the repository/);
  // The code map off: both say so and point to the text search.
  put(root, "rdstudio.toml", "[project]\ntitle = 'T'\n\n[code]\nenabled = false\n");
  const { loadConfig: again } = await import("../src/config.ts");
  const off = new Lookup(again(root), b, "design/integrator");
  for (const [name, args] of [["search_symbols", '{"query":"energy"}'], ["outline_code", "{}"]] as const) expect(off.run(name, args)).toMatch(/not indexed.*Use search_code/);
});

test("without git the code is still searched and read: a walk of the files, leaving out what is hidden, installed or built (T89)", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "rdstudio-nogit-")), root = join(tmp, "project");
  put(root, "rdstudio.toml", "[project]\ntitle = 'T'\n");
  put(root, "knowledge/index.md", "---\nokf_version: \"0.2\"\n---\n");
  put(root, "knowledge/design/forces.md", note("The forces", "leapfrog_step is mentioned here."));
  put(root, "src/step.rs", "pub fn leapfrog_step(dt: f64) -> f64 {\n    dt * 2.0\n}\n");
  put(root, "node_modules/x/index.js", "function leapfrog_step() {}\n");
  put(root, ".env", "leapfrog_step=1\n");
  process.env.GIT_CEILING_DIRECTORIES = tmp; // so that no repository above the temporary folder is found
  try {
    const cfg = loadConfig(root);
    const { Lookup } = await import("../src/lookup.ts");
    const look = new Lookup(cfg, (await import("@rdstudio/core/node")).loadBundle(cfg.knowledgeDir), "design/forces");
    expect(look.run("search_code", '{"text":"leapfrog_step"}')).toBe("src/step.rs:1:pub fn leapfrog_step(dt: f64) -> f64 {");
    expect(look.run("read_code", '{"path":"src/step.rs"}')).toContain("dt * 2.0");
    for (const path of [".env", "node_modules/x/index.js", "../x"]) expect(look.run("read_code", JSON.stringify({ path }))).toMatch(/is not a file of this repository/);
  } finally { delete process.env.GIT_CEILING_DIRECTORIES; }
});

// ------------------------------------------------------------------ a chat beside the note (T97, T98)

const answers = (replies: string[], bodies: Record<string, any>[] = []) => models.setFetch((async (_u: unknown, init?: RequestInit) => {
  bodies.push(JSON.parse(String(init?.body)));
  const reply = replies[Math.min(bodies.length, replies.length) - 1]!;
  const enc = new TextEncoder(), lines = [`data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 1200, completion_tokens: 80, cost: 0.003, prompt_tokens_details: { cached_tokens: 400 } } })}\n\n`, "data: [DONE]\n\n"];
  return new Response(new ReadableStream({ start(c) { for (const l of lines) c.enqueue(enc.encode(l)); c.close(); } }), { status: 200 });
}) as typeof fetch);

test("a chat turn marks a passage and a separate place for new text, and is told only the changes it is let make", () => {
  const { cfg } = project();
  const body = "First line.\n\nGravity is softened here.\n\nLast line.";
  const a = body.indexOf("Gravity"), z = a + "Gravity is softened here.".length;
  expect(assist.markedPlaces(body, a, z, body.length)).toBe("First line.\n\n⟦Gravity is softened here.⟧\n\nLast line.⟦HERE⟧");
  expect(assist.markedPlaces(body, a, z, a)).toBe("First line.\n\n⟦HERE⟧⟦Gravity is softened here.⟧\n\nLast line.");
  expect(assist.markedPlaces(body, a, z, z)).toContain("here.⟧⟦HERE⟧");
  expect(assist.markedPlaces(body, 0, 0, null)).toBe(body);
  // A long note is cut round both places, and never when it is to be edited as a whole.
  const long = "start " + "word ".repeat(6000) + "MIDDLE " + "word ".repeat(6000) + "end";
  const m = long.indexOf("MIDDLE"), cut = assist.markedPlaces(long, m, m + 6, 3);
  expect(cut.length).toBeLessThan(16000);
  expect(cut).toContain("⟦MIDDLE⟧");
  expect(cut).toContain("sta⟦HERE⟧rt");
  expect(cut).toContain("\n[…]\n");
  expect(assist.markedPlaces(long, m, m + 6, 3, 14000, true).length).toBe(long.length + 2 + "⟦HERE⟧".length);

  const base = { note: "design/integrator", mode: "chat" as const, body, from: a, to: z, prompt: "Is this right?" };
  const only = said(assist.prepare(cfg, base));
  expect(only).toContain("You may not change the note in this turn");
  expect(only).not.toContain("<passage>");
  expect(assist.prepare(cfg, base).job).toBe("discuss");
  const at = said(assist.prepare(cfg, { ...base, at: body.length }));
  expect(at).toContain("<insert>");
  expect(at).toContain("is there to be read: do not change it");
  expect(at).not.toContain("<change>");
  expect(at).toContain("Last line.⟦HERE⟧");
  const pass = assist.prepare(cfg, { ...base, may: { passage: true } });
  expect(said(pass)).toContain("<passage>");
  expect(said(pass)).not.toContain("<insert>");
  expect(pass.job).toBe("write");
  const whole = said(assist.prepare(cfg, { ...base, from: 0, to: 0, may: { note: true } }));
  expect(whole).toContain("<change>");
  expect(whole).toContain("Choose the places yourself");
  expect(() => assist.prepare(cfg, { ...base, from: 0, to: 0, prompt: "" })).toThrow(/ask something, or mark a passage/);
  expect(() => assist.prepare(cfg, { ...base, body: "x".repeat(assist.MAX_WHOLE + 1), from: 0, to: 0, may: { note: true } })).toThrow(/too long to be edited as a whole/);
  // A marked passage it may change, and no question: it is asked to rewrite it.
  expect(said(assist.prepare(cfg, { ...base, prompt: "", may: { passage: true } }))).toContain("They want the marked passage rewritten");
});

test("a chat turn's reply is read: the answer, and the changes placed in the note; what it was not let do, or cannot be placed, is dropped and said", () => {
  const body = "# Title\n\nGravity is softened here.\n\n- one\n- two\n- two\n\nLast line.\n";
  const a = body.indexOf("Gravity"), z = a + "Gravity is softened here.".length;
  const reply = `<answer>\nTidied, and a line added.\n</answer>\n<passage>\nGravity is ⟦softened⟧ at short range.\n</passage>\n<insert>\nA new last line.\n</insert>\n<change>\n<old>\n- one\n</old>\n<new>\n- one\n- one and a half\n</new>\n</change>\n<change>\n<old>\n# Title\n</old>\n<new>\n</new>\n</change>\n<change><old>- two</old><new>- 2</new></change>\n<change><old>not there</old><new>x</new></change>`;
  const all = assist.parseChat(reply, { body, from: a, to: z, at: body.length, may: { passage: true, note: true } });
  expect(all.answer).toBe("Tidied, and a line added.");
  expect(all.edits).toEqual([
    { kind: "change", from: 0, to: 8, insert: "" }, // the heading goes, with its line break
    { kind: "passage", from: a, to: z, insert: "Gravity is softened at short range." },
    { kind: "change", from: body.indexOf("- one"), to: body.indexOf("- one") + 5, insert: "- one\n- one and a half" },
    { kind: "insert", from: body.length, to: body.length, insert: "A new last line." },
  ]);
  expect(all.dropped).toEqual(["A change could not be placed: “- two” is in the note more than once.", "A change could not be placed: “not there” is not in the note."]);
  // Applied from the end, the edits give the note as proposed.
  let out = body;
  for (const e of [...all.edits].reverse()) out = out.slice(0, e.from) + e.insert + out.slice(e.to);
  expect(out).toBe("\nGravity is softened at short range.\n\n- one\n- one and a half\n- two\n- two\n\nLast line.\nA new last line.");

  // Let nothing: the answer alone, and it is said that changes were proposed.
  const none = assist.parseChat(reply, { body, from: a, to: z });
  expect(none.edits).toEqual([]);
  expect(none.dropped).toEqual(["It proposed a new text for the marked passage, which it was not let change.", "It proposed new text, but no place was set for it.", "It proposed 4 changes elsewhere in the note, which it was not let edit."]);
  // The place only.
  expect(assist.parseChat(reply, { body, from: a, to: z, at: 3 }).edits).toEqual([{ kind: "insert", from: 3, to: 3, insert: "A new last line." }]);
  // No tags: the reply is the answer. Text broken across lines differently is still found. A change cut short is not offered.
  expect(assist.parseChat("Just an answer.", { body, from: 0, to: 0 })).toEqual({ answer: "Just an answer.", edits: [], dropped: [] });
  expect(assist.parseChat("<change><old>Gravity is\nsoftened   here.</old><new>G.</new></change>", { body, from: 0, to: 0, may: { note: true } }).edits).toEqual([{ kind: "change", from: a, to: z, insert: "G." }]);
  const cut = assist.parseChat("<answer>One.</answer>\n<change>\n<old>\nLast line.\n</old>\n<new>\nLast", { body, from: 0, to: 0, may: { note: true } });
  expect(cut).toMatchObject({ answer: "One.", edits: [] });
  expect(cut.dropped[0]).toMatch(/cut short/);
  // Two changes to one text: the first stands.
  expect(assist.parseChat("<passage>A</passage><change><old>softened here</old><new>B</new></change>", { body, from: a, to: z, may: { note: true } })).toMatchObject({ edits: [{ kind: "passage", insert: "A" }], dropped: [expect.stringMatching(/same text/)] });
});

test("a chat goes on from its earlier turns, and its turns are kept in the learner record, listed by note, read back and deleted (T97)", async () => {
  const { cfg } = project();
  const chats = await import("../src/assistchats.ts");
  const bodies: Record<string, any>[] = [];
  answers(["<answer>\nBecause close pairs would blow up.\n</answer>", "<answer>\nAdded.\n</answer>\n<insert>\nSoftening length: 0.1 nm.\n</insert>"], bodies);
  const body = "Gravity is softened here.\n\nLast line.";
  const first = { note: "design/integrator", mode: "chat" as const, title: "The integrator", body, from: 0, to: 25, prompt: "Why $\\epsilon$?" };
  const one = (await assist.ask(cfg, first)).reply;
  expect(one).toMatchObject({ mode: "chat", answer: "Because close pairs would blow up.", edits: [], dropped: [], spent: { calls: 1, input: 1200, output: 80, cached: 400 } });
  expect(models.usageLog().at(-1)).toMatchObject({ feature: "note-ask" });
  // Nothing is kept where the learner record is off.
  expect(chats.keep(cfg, first.note, first.title, chats.turnOf(first, one))).toBeNull();
  expect(chats.list(cfg)).toEqual([]);
  writeFileSync(join(process.env.XDG_CONFIG_HOME!, "rdstudio", "config.toml"), "[learner]\nenabled = true\n");
  const kept = chats.keep(cfg, first.note, first.title, chats.turnOf(first, one))!;
  expect(kept.turns[0]).toMatchObject({ question: "Why $\\epsilon$?", passage: "Gravity is softened here.", here: null, may: { passage: false, note: false }, answer: "Because close pairs would blow up.", edits: [], cost: 0.003 });

  const next = { ...first, from: 0, to: 0, at: body.length, prompt: "Add the length.", thread: [{ question: first.prompt, answer: one.answer }] };
  const two = (await assist.ask(cfg, next)).reply;
  const sent = bodies.at(-1)!.messages as { role: string; content: any }[];
  expect(sent.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
  expect(sent[1]!.content).toBe("Why $\\epsilon$?");
  expect(sent[2]!.content).toBe("Because close pairs would blow up.");
  expect(JSON.stringify(sent[3]!.content)).toContain("This goes on from the conversation above");
  expect(JSON.stringify(sent[3]!.content)).toContain("Their next question");
  expect(two.edits).toEqual([{ kind: "insert", from: body.length, to: body.length, insert: "Softening length: 0.1 nm." }]);
  expect(models.usageLog().at(-1)).toMatchObject({ feature: "note-fill" });
  const more = chats.keep(cfg, next.note, next.title, chats.turnOf(next, two), kept.id)!;
  expect(more.id).toBe(kept.id);
  expect(more.turns).toHaveLength(2);
  expect(more.turns[1]).toMatchObject({ passage: null, here: { line: 3, after: "Last line." }, edits: [{ kind: "insert", line: 3, old: "", new: "Softening length: 0.1 nm." }] });
  // A chat named that is about another note starts a new one.
  const other = chats.keep(cfg, "design/forces", "The forces", chats.turnOf(first, one), kept.id)!;
  expect(other.id).not.toBe(kept.id);
  expect(chats.list(cfg, "design/integrator")).toMatchObject([{ id: kept.id, note: "design/integrator", title: "The integrator", question: "Why $\\epsilon$?", turns: 2, cost: 0.006 }]);
  expect(chats.list(cfg).map((c) => c.note).sort()).toEqual(["design/forces", "design/integrator"]);
  expect(chats.read(cfg, kept.id).turns).toHaveLength(2);
  expect(() => chats.read(cfg, "../../x")).toThrow(/no such kept chat|not a kept chat/);
  expect(chats.forget(cfg, kept.id)).toEqual({ id: kept.id });
  expect(() => chats.read(cfg, kept.id)).toThrow(/no such kept chat/);
  expect(chats.list(cfg, "design/integrator")).toEqual([]);
});
