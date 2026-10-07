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

test("the model is given the note with the place marked, the notes it links to, notes found by searching, and code by name", () => {
  const { cfg } = project();
  const body = "The integrator keeps the temperature steady with a thermostat.\n\nSee [the forces](/design/forces.md \"requires\") and [units](units.md).\n";
  const at = body.indexOf("thermostat");
  const p = assist.prepare(cfg, { note: "design/integrator", mode: "fill", body, from: at, to: at, prompt: "Insert the code of `kinetic_energy` and of leapfrog_step here." });
  const text = said(p);
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
