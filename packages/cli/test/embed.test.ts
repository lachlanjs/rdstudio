// Search by meaning (T89): how notes are cut into pieces, that only what changed is embedded again, and the
// tool Axis is given. The model is replaced by a stand-in that counts its calls; one test runs the real model
// where it is installed.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { tokenize } from "@rdstudio/core";
import { loadBundle } from "@rdstudio/core/node";
import * as assist from "../src/assist.ts";
import { loadConfig } from "../src/config.ts";
import * as embed from "../src/embed.ts";
import { Lookup, toolsFor } from "../src/lookup.ts";

const put = (root: string, rel: string, text: string) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
const note = (title: string, body: string) => `---\ntype: Design\ntitle: ${title}\ndescription: About ${title.toLowerCase()}.\n---\n\n${body}\n`;

function project() {
  const tmp = mkdtempSync(join(tmpdir(), "rdstudio-embed-"));
  process.env.XDG_CONFIG_HOME = join(tmp, "config");
  process.env.XDG_DATA_HOME = join(tmp, "data");
  const root = join(tmp, "project");
  put(root, "rdstudio.toml", "[project]\ntitle = 'T'\n");
  put(root, "knowledge/index.md", "---\nokf_version: \"0.2\"\n---\n");
  put(root, "knowledge/design/thermostat.md", note("The thermostat", "# How\n\nA Berendsen thermostat rescales velocities towards a target temperature, a little each step.\n\n# Why\n\nIt is simple, and good enough while the system settles down.\n\n```\n# not a heading: a comment in code\n```"));
  put(root, "knowledge/design/forces.md", note("The forces", "Gravity between every pair of particles is softened so close pairs do not blow up."));
  put(root, "knowledge/design/long.md", note("A long note", "# Much\n\n" + Array.from({ length: 12 }, (_, k) => `Paragraph ${k} about units of length and time. `.repeat(8)).join("\n\n")));
  execFileSync("git", ["init", "-q"], { cwd: root });
  return { root, cfg: loadConfig(root) };
}

/** In the model's place: a text's words, hashed into the vector. Texts that share words are near. */
function standIn() {
  const calls: string[] = [];
  embed.setEmbedder(async (text) => {
    calls.push(text);
    const v = new Float32Array(embed.DIM);
    for (const w of tokenize(text.replace(/^Represent this sentence for searching relevant passages: /, ""))) { let h = 0; for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0; v[h % embed.DIM]! += 1; }
    return v;
  });
  return calls;
}
afterEach(() => embed.setEmbedder(null));

test("a note is cut at its headings, a long section at its paragraphs, and each piece carries the note's title and description", () => {
  const { cfg } = project();
  const ps = embed.pieces(loadBundle(cfg.knowledgeDir));
  const of = (id: string) => ps.filter((p) => p.note === id);
  expect(of("design/thermostat").map((p) => p.heading)).toEqual(["How", "Why"]); // the fenced line is not a heading
  expect(of("design/thermostat")[0]!.text).toBe("The thermostat. About the thermostat.\nHow\nA Berendsen thermostat rescales velocities towards a target temperature, a little each step.");
  expect(of("design/forces").map((p) => p.heading)).toEqual([""]);
  const long = of("design/long");
  expect(long.length).toBeGreaterThan(2);
  expect(long.every((p) => p.heading === "Much" && p.body.length <= 1800)).toBe(true);
  expect(long.map((p) => p.body).join("\n\n")).toContain("Paragraph 11 about units");
  expect(new Set(ps.map((p) => p.key)).size).toBe(ps.length);
});

test("everything is embedded once; an edited section is the only one embedded again; a moved note costs nothing; a deleted one is forgotten", async () => {
  const { root, cfg } = project();
  const calls = standIn();
  const first = await embed.refresh(cfg);
  expect(first.made).toBe(first.pieces);
  expect(embed.state(cfg)).toEqual({ pieces: first.pieces, missing: 0 });
  expect((await embed.refresh(cfg)).made).toBe(0);
  calls.length = 0;

  // One section edited: one piece made again, and it is the edited one.
  const file = join(root, "knowledge/design/thermostat.md");
  writeFileSync(file, readFileSync(file, "utf8").replace("It is simple,", "It is cheap,"));
  expect(embed.state(cfg).missing).toBe(1);
  expect((await embed.refresh(cfg)).made).toBe(1);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain("Why\nIt is cheap,");

  // Moved: the same text, so nothing to make.
  calls.length = 0;
  mkdirSync(join(root, "knowledge/concepts"), { recursive: true });
  renameSync(join(root, "knowledge/design/forces.md"), join(root, "knowledge/concepts/gravity.md"));
  expect(embed.state(cfg).missing).toBe(0);
  expect((await embed.refresh(cfg)).made).toBe(0);
  expect(calls).toHaveLength(0);

  // A changed title is in every piece of the note: all of it again.
  writeFileSync(file, readFileSync(file, "utf8").replace("title: The thermostat", "title: Temperature control"));
  expect(embed.state(cfg).missing).toBe(2);
  await embed.refresh(cfg);

  // The cache holds a vector for each piece and no more, in the project's .rdstudio/.
  const kept = JSON.parse(readFileSync(embed.cachePath(cfg), "utf8"));
  expect(embed.cachePath(cfg)).toBe(join(root, ".rdstudio", "embeddings.json"));
  expect(kept.model).toBe(embed.MODEL);
  expect(Object.keys(kept.vectors)).toHaveLength(embed.state(cfg).pieces);
  // Another model's cache is not used.
  writeFileSync(embed.cachePath(cfg), JSON.stringify({ ...kept, model: "some-other-model" }));
  expect(embed.state(cfg).missing).toBe(embed.state(cfg).pieces);
});

test("a search by meaning finds the nearest section of each note, and sees an edit made outside the app", async () => {
  const { root, cfg } = project();
  const calls = standIn();
  const b = () => loadBundle(cfg.knowledgeDir);
  const found = await embed.similar(cfg, b(), "rescales velocities towards a temperature");
  expect(found.ready).toBe(true);
  expect(found.pending).toBe(0);
  expect(found.hits[0]).toMatchObject({ note: "design/thermostat", heading: "How" });
  expect(found.hits.map((h) => h.note)).toHaveLength(3); // each note once
  expect(found.hits[0]!.score).toBeGreaterThan(found.hits[1]!.score);
  expect((await embed.similar(cfg, b(), "rescales velocities", { under: "design", limit: 1 })).hits).toHaveLength(1);
  // A note written by another program since: found by the next search, with no step between.
  calls.length = 0;
  put(root, "knowledge/design/barostat.md", note("The barostat", "Pressure is held by scaling the box and the positions together."));
  const again = await embed.similar(cfg, b(), "scaling the box to hold pressure");
  expect(again.hits[0]!.note).toBe("design/barostat");
  expect(calls).toHaveLength(2); // the new piece, and the question
});

test("Axis is offered find_similar only where the model is installed, told it is second, and a note opened after it is marked as found by meaning", async () => {
  const { cfg } = project();
  expect(toolsFor().map((t) => t.function.name)).not.toContain("find_similar");
  const body = "x";
  const plain = assist.prepare(cfg, { note: "design/forces", mode: "ask", body, from: 0, to: 1, prompt: "?" }).seen.map((s) => s.text).join("\n");
  expect(plain).not.toContain("find_similar");
  standIn();
  expect(toolsFor().map((t) => t.function.name).slice(0, 3)).toEqual(["search_notes", "find_similar", "outline_note"]);
  const told = assist.prepare(cfg, { note: "design/forces", mode: "ask", body, from: 0, to: 1, prompt: "?" }).seen.map((s) => s.text).join("\n");
  expect(told).toContain("find_similar finds notes by meaning");
  expect(told).toContain("It is\n  second");

  const look = new Lookup(cfg, loadBundle(cfg.knowledgeDir), "design/forces");
  const out = await look.runAsync("find_similar", '{"text":"how is the temperature kept steady by rescaling velocities?"}');
  expect(out.split("\n")[1]).toMatch(/^- The thermostat \(\/design\/thermostat\.md\), Design, section "How" \(0\.\d\d\): About the thermostat\.$/);
  expect(look.steps[0]).toMatchObject({ tool: "find_similar", how: "meaning", said: expect.stringMatching(/^Looked for notes that mean ".*": 3 found$/) });
  expect(look.steps[0]!.notes[0]).toBe("design/thermostat");
  await look.runAsync("read_note", '{"id":"design/thermostat","section":"How"}');
  expect(look.steps[1]).toMatchObject({ tool: "read_note", how: "meaning", opened: "design/thermostat" });
  // Any other tool is run as before, at once.
  expect(await look.runAsync("search_notes", '{"query":"softened"}')).toContain("The forces");
  expect(await look.runAsync("find_similar", "{}")).toMatch(/needs the text/);
});

const installed = (() => { delete process.env.RDSTUDIO_EMBED; const ok = embed.available(); process.env.RDSTUDIO_EMBED = "off"; return ok; })();
test.skipIf(!installed)("the real model, where it is installed: a question in other words than the note's finds the section", async () => {
  const { cfg } = project();
  delete process.env.RDSTUDIO_EMBED;
  try {
    const found = await embed.similar(cfg, loadBundle(cfg.knowledgeDir), "what stops things overheating as the simulation runs?");
    expect(found.hits[0]).toMatchObject({ note: "design/thermostat" });
    expect(existsSync(embed.cachePath(cfg))).toBe(true);
  } finally { process.env.RDSTUDIO_EMBED = "off"; }
}, 120_000);
