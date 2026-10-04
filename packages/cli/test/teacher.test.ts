// The teacher: skills served with their defaults and the developer's private
// customisations, the profile in rdstudio.toml, and the teacher folder's own
// history, against a throwaway project and learner folder.

import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test } from "vitest";
import { loadConfig } from "../src/config.ts";
import * as learner from "../src/learner.ts";
import { createServer } from "../src/mcp.ts";
import * as teacher from "../src/teacher.ts";

function project(toml = "[project]\ntitle = 'T'\n") {
  const tmp = mkdtempSync(join(tmpdir(), "rdstudio-teacher-"));
  mkdirSync(join(tmp, "config", "rdstudio"), { recursive: true });
  writeFileSync(join(tmp, "config", "rdstudio", "config.toml"), "[learner]\nenabled = true\n");
  process.env.XDG_CONFIG_HOME = join(tmp, "config");
  process.env.XDG_DATA_HOME = join(tmp, "data");
  mkdirSync(join(tmp, "project", "knowledge"), { recursive: true });
  writeFileSync(join(tmp, "project", "rdstudio.toml"), toml);
  return join(tmp, "project");
}

async function connect(root: string) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(loadConfig(root), "test").connect(a);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(b);
  return async (name: string, args: Record<string, unknown> = {}) =>
    ((await client.callTool({ name, arguments: args })).content as { text: string }[])[0]!.text;
}

test("the default skills are listed, teach first, and read with the profile", async () => {
  const cfg = loadConfig(project());
  const all = teacher.skills(cfg);
  expect(all[0]).toMatchObject({ name: "teach", status: "default", defaultChanged: false });
  expect(all[0]!.description).toMatch(/rules every teaching skill keeps/);

  const call = await connect(cfg.root);
  const listed = JSON.parse(await call("teacher_skills"));
  expect(listed).toMatchObject({ profile: "topic", profile_set: false, record: "on" });
  expect(listed.skills.map((s: { name: string }) => s.name)).toContain("teach");
  const text = await call("teacher_skill", { name: "teach" });
  expect(text).toMatch(/^Profile: topic \(guessed; not set\)\. This skill: rdstudio's default\./);
  expect(text).toMatch(/Understanding is claimed only on evidence/);
  expect(await call("teacher_skill", { name: "nope" })).toMatch(/No skill 'nope'/);
  expect(await call("teacher_skill", { name: "../x" })).toMatch(/lowercase letters/);
});

test("a customised skill is what the agent reads, privately, until it is reset", async () => {
  const cfg = loadConfig(project());
  const def = teacher.skill(cfg, "teach")!.text;
  const saved = teacher.saveSkill(cfg, "teach", "---\nname: teach\ndescription: Mine.\n---\n\nAsk me one question at a time.\r\n");
  expect(saved).toMatchObject({ status: "changed", description: "Mine.", defaultChanged: false, base: def, default: def });
  expect(saved.text).toBe("---\nname: teach\ndescription: Mine.\n---\n\nAsk me one question at a time.\n");
  // Nothing in the project: the override is beside the learner record.
  expect(existsSync(join(cfg.root, "teacher"))).toBe(false);
  expect(teacher.teacherDir(cfg).startsWith(learner.recordDir(cfg))).toBe(true);

  const call = await connect(cfg.root);
  expect(await call("teacher_skill", { name: "teach" })).toMatch(/customised by the developer\.\n\n---\nname: teach\ndescription: Mine\./);

  // rdstudio's default moves on: the customisation says so.
  writeFileSync(join(teacher.teacherDir(cfg), "skills", ".base", "teach.md"), "an older default\n");
  expect(teacher.skill(cfg, "teach")).toMatchObject({ defaultChanged: true, base: "an older default\n" });

  // A second save keeps the base it was made from.
  teacher.saveSkill(cfg, "teach", "Two questions.");
  expect(teacher.skill(cfg, "teach")!.base).toBe("an older default\n");

  const reset = teacher.resetSkill(cfg, "teach")!;
  expect(reset).toMatchObject({ status: "default", text: def, base: null });
  expect(existsSync(join(teacher.teacherDir(cfg), "skills", ".base", "teach.md"))).toBe(false);
});

test("a skill of your own is listed as own and deleted by a reset", () => {
  const cfg = loadConfig(project());
  expect(() => teacher.saveSkill(cfg, "Bad Name", "x")).toThrow(/lowercase/);
  expect(() => teacher.saveSkill(cfg, "drill", "  ")).toThrow(/needs some text/);
  teacher.saveSkill(cfg, "drill", "---\nname: drill\ndescription: Flash cards.\n---\n\nDrill me.\n");
  expect(teacher.skills(cfg).find((s) => s.name === "drill")).toMatchObject({ status: "own", description: "Flash cards." });
  expect(teacher.skill(cfg, "drill")!.default).toBeNull();
  expect(teacher.resetSkill(cfg, "drill")).toBeNull();
  expect(teacher.skills(cfg).some((s) => s.name === "drill")).toBe(false);
});

test("the learner folder keeps its own history, a commit per change", () => {
  const cfg = loadConfig(project());
  learner.append(cfg, { event: "seen", concept: "a", hash: "h" });
  teacher.saveSkill(cfg, "teach", "Mine.");
  teacher.resetSkill(cfg, "teach");
  expect(existsSync(join(learner.recordDir(cfg), ".git"))).toBe(true);
  const log = teacher.history(cfg);
  expect(log.map((l) => l.message)).toEqual(["Skill teach: reset to the default", "Skill teach: customised"]);
  expect(log[0]!.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  // A reset of a skill never customised changes nothing, and commits nothing.
  teacher.resetSkill(cfg, "teach");
  expect(teacher.history(cfg)).toHaveLength(2);
});

test("the profile is guessed from the repository, and set in rdstudio.toml", () => {
  const root = project("# mine\n[project]\ntitle = 'T'\n\n[actors]\nhuman = \"human:me\"\n");
  expect(teacher.profile(loadConfig(root))).toEqual({ profile: "topic", set: false });
  writeFileSync(join(root, "package.json"), "{}");
  expect(teacher.profile(loadConfig(root))).toEqual({ profile: "codebase", set: false });

  expect(() => teacher.setProfile(loadConfig(root), "course")).toThrow(/topic, codebase, project/);
  teacher.setProfile(loadConfig(root), "project");
  expect(readFileSync(join(root, "rdstudio.toml"), "utf8")).toBe(
    "# mine\n[project]\ntitle = 'T'\n\n[actors]\nhuman = \"human:me\"\n\n# How the teacher works here: topic, codebase or project.\n[teacher]\nprofile = \"project\"\n");
  expect(teacher.profile(loadConfig(root))).toEqual({ profile: "project", set: true });

  // Changed in place, with the rest of the table and file kept.
  const toml = readFileSync(join(root, "rdstudio.toml"), "utf8").replace("[teacher]\n", "[teacher] # here\nother = 1\n") + "\n[paths]\nknowledge = \"knowledge\"\n";
  writeFileSync(join(root, "rdstudio.toml"), toml);
  teacher.setProfile(loadConfig(root), "topic");
  expect(readFileSync(join(root, "rdstudio.toml"), "utf8")).toBe(toml.replace('profile = "project"', 'profile = "topic"'));
});

test("the profile and sources log: written by agents, edited by the developer, each a commit", async () => {
  const cfg = loadConfig(project());
  expect(() => teacher.readFile(cfg, "secrets.md")).toThrow(/profile.md and sources.md/);
  expect(teacher.readFile(cfg, "profile.md")).toEqual({ name: "profile.md", text: null, history: [] });

  const call = await connect(cfg.root);
  const a = learner.append(cfg, { event: "attempt", exercise: "ex/one", tests: ["n"], answer: "2", result: "missed", by: "dashboard" });
  expect(await call("teacher_read", { name: "profile.md" })).toBe("profile.md: not written yet. History: none.");
  expect(await call("teacher_write", { name: "profile.md", text: " " })).toBe("Text is needed.");
  expect(await call("teacher_write", { name: "notes.md", text: "x" })).toMatch(/profile.md and sources.md/);
  const written = `# Struggling\n\n- Values off by one [e:${a.id}].\n`;
  expect(JSON.parse(await call("teacher_write", { name: "profile.md", text: written.replace("\n", "\r\n"), message: "First picture", actor: "agent/test" })))
    .toEqual({ written: "profile.md", characters: written.length });
  let read = await call("teacher_read", { name: "profile.md" });
  expect(read.startsWith(`profile.md: ${written.length} characters. History: `)).toBe(true);
  expect(read).toMatch(/^profile\.md: \d+ characters\. History: \d{4}-\d\d-\d\dT\d\d:\d\d profile\.md: First picture \(agent\/test\)\.\n\n# Struggling/);

  // The developer disputes it in the dashboard; the agent is told, and reads the edit.
  teacher.writeFile(cfg, "profile.md", "# Struggling\n\n- Nothing: that was a typo.\n", teacher.BY_DEVELOPER);
  read = await call("teacher_read", { name: "profile.md" });
  expect(read).toMatch(/The developer edited it on \d{4}-\d\d-\d\d: read that with developer_edit=true\./);
  const edit = await call("teacher_read", { name: "profile.md", developer_edit: true });
  expect(edit).toMatch(/The developer's edit of .*:\n/);
  expect(edit).toContain(`-- Values off by one [e:${a.id}].`);
  expect(edit).toContain("+- Nothing: that was a typo.");
  expect(teacher.history(cfg).map((h) => h.message)).toEqual(["profile.md: edited by the developer", "profile.md: First picture (agent/test)"]);
  expect(teacher.developerEdit(cfg, "sources.md")).toBeNull();
});

test("learner_events gives the evidence with ids, filtered by note, event and time", async () => {
  const root = project();
  mkdirSync(join(root, "knowledge", "f"), { recursive: true });
  writeFileSync(join(root, "knowledge", "f", "n.md"), "---\ntype: Definition\ntitle: N\n---\n\nN.\n");
  writeFileSync(join(root, "knowledge", "f", "ex.md"), "---\ntype: Exercise\ntitle: Ex\ntests: [n.md]\n---\n\nQ\n\n# Solution\n\nA\n");
  const cfg = loadConfig(root);
  const call = await connect(root);
  const seen = learner.append(cfg, { event: "seen", concept: "f/n", hash: "h" });
  const att = learner.append(cfg, { event: "attempt", exercise: "f/ex", tests: ["f/n"], hashes: { "f/n": "h" }, answer: "A", kind: "ai" });
  const mark = learner.append(cfg, { event: "attempt_marked", ref: att.id, result: "got", feedback: "Yes.", by: "agent/x" });
  learner.append(cfg, { event: "seen", concept: "f/other", hash: "h" });
  const about = JSON.parse(await call("learner_events", { about: "f/n" }));
  expect(about.map((e: { id: string }) => e.id)).toEqual([mark.id, att.id, seen.id]);
  expect(about[1]).toEqual({ id: att.id, at: att.at, event: "attempt", exercise: "f/ex", tests: ["f/n"], answer: "A", kind: "ai", title: "Ex" });
  expect(about[2]).toMatchObject({ concept: "f/n", title: "N" });
  expect(JSON.parse(await call("learner_events", { events: ["attempt_marked"] })).map((e: { id: string }) => e.id)).toEqual([mark.id]);
  expect(await call("learner_events", { since: "2999-01-01" })).toBe("No events match.");
  expect(JSON.parse(await call("learner_events", { limit: 1 }))).toHaveLength(1);
});

test("drafts: saved as typed, versions kept, restored undoably, filed when submitted", () => {
  const cfg = loadConfig(project());
  expect(teacher.readDraft(cfg, "ex/one")).toEqual({ exercise: "ex/one", text: "", working: "", updated: null, versions: [], turns: [] });
  expect(() => teacher.readDraft(cfg, "../x")).toThrow(/not an exercise id/);
  teacher.saveDraft(cfg, "ex/one", { text: "First go.\r\n", working: "" });
  expect(teacher.history(cfg)).toEqual([]); // typing does not commit
  let d = teacher.keepVersion(cfg, "ex/one", "hint");
  expect(d.versions).toMatchObject([{ id: "v1", reason: "hint", text: "First go.\n" }]);
  expect(teacher.keepVersion(cfg, "ex/one", "feedback").versions).toHaveLength(2); // each teacher moment is kept…
  expect(teacher.keepVersion(cfg, "ex/one", undefined).versions).toHaveLength(2); // …but keeping it yourself, unchanged, adds nothing
  teacher.saveDraft(cfg, "ex/one", { text: "Second go.", working: "w" });
  d = teacher.restoreVersion(cfg, "ex/one", "v1");
  expect(d.text).toBe("First go.\n");
  expect(d.versions.at(-1)).toMatchObject({ id: "v3", reason: "before restoring", text: "Second go.", working: "w" });
  expect(() => teacher.restoreVersion(cfg, "ex/one", "v9")).toThrow(/no version v9/);
  expect(teacher.history(cfg).map((h) => h.message)).toEqual(["Draft of ex/one: v3 (before restoring)", "Draft of ex/one: v2 (feedback)", "Draft of ex/one: v1 (hint)"]);

  const attempt = learner.append(cfg, { event: "attempt", exercise: "ex/one", tests: [], answer: "First go." });
  expect(() => teacher.fileDraft(cfg, "ex/one", "nope")).toThrow(/attempt's id/);
  expect(teacher.fileDraft(cfg, "ex/one", attempt.id)).toEqual({ filed: attempt.id });
  expect(teacher.readDraft(cfg, "ex/one").versions).toEqual([]); // a fresh start next time
  expect(teacher.submittedDraft(cfg, attempt.id)).toMatchObject({ exercise: "ex/one", attempt: attempt.id, versions: [{ id: "v1" }, { id: "v2" }, { id: "v3" }] });
  expect(teacher.fileDraft(cfg, "ex/two", attempt.id)).toEqual({ filed: null });
});

// ------------------------------------------------------------------ work together (T51)

import * as tutor from "../src/tutor.ts";
import * as models from "../src/models.ts";

test("a reply's pins are read, and each quote found in the draft", () => {
  const draft = "Each term has mean 0.\nSo   the variance of h is the sum of variances, g^2 q.";
  const { general, pins } = tutor.parseReply([
    "Mostly sound.",
    "[green] \"Each term has mean 0\"",
    "Right, and it is what lets the cross terms vanish.",
    "[red] “the variance of h is the sum”: only for independent terms.",
    "Say why they are independent.",
    "[blue] \"not in the draft\"",
    "Unanchored.",
  ].join("\n"), draft);
  expect(general).toBe("Mostly sound.");
  expect(pins.map((p) => [p.colour, p.from, p.to, p.comment])).toEqual([
    ["green", 0, 20, "Right, and it is what lets the cross terms vanish."],
    ["red", 27, 55, "only for independent terms.\nSay why they are independent."],
    ["blue", null, null, "Unanchored."],
  ]);
  expect(draft.slice(27, 55)).toBe("the variance of h is the sum");
  expect(tutor.locate(draft, "So the variance")).toEqual({ from: 22, to: 39 }); // runs of spaces match
});

test("asking: the draft is kept as a version, the context built, the reply kept as a turn", async () => {
  const root = project();
  mkdirSync(join(root, "knowledge", "dmft"), { recursive: true });
  writeFileSync(join(root, "knowledge", "dmft", "gaussian.md"), "---\ntype: Definition\ntitle: Gaussian field\n---\n\nSums of many independent terms are Gaussian. Needs [Variance](variance.md \"requires\").\n");
  writeFileSync(join(root, "knowledge", "dmft", "variance.md"), "---\ntype: Definition\ntitle: Variance\ndescription: The mean square deviation.\n---\n\nVar.\n");
  writeFileSync(join(root, "knowledge", "dmft", "ex.md"), "---\ntype: Exercise\ntitle: Why Gaussian\ntests: [gaussian.md]\n---\n\nWhy is $h$ Gaussian?\n\n# Solution\n\nThe central limit theorem.\n");
  const cfg = loadConfig(root);
  teacher.writeFile(cfg, "profile.md", "# Struggling\n\n- Gaussian field: forgets independence [e:01M42A1M17H4XR0KNVYHBDKDPW].\n- Something else entirely.\n", "test");
  models.saveKey("sk-or-v1-abcdef0123456789");
  let sent: { model?: string; messages?: { role: string; content: { text: string }[] }[] } = {};
  models.setFetch((async (_u: unknown, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body));
    const body = `data: ${JSON.stringify({ choices: [{ delta: { content: "Independence.\n[hint] \"many terms\"" } }] })}\n\ndata: ${JSON.stringify({ usage: { prompt_tokens: 900, completion_tokens: 6, cost: 0.0009 } })}\n\n`;
    return new Response(body, { status: 200 });
  }) as typeof fetch);
  try {
    expect(() => tutor.prepare(cfg, { exercise: "dmft/gaussian", mode: "hint", text: "" })).toThrow(/not an Exercise note/);
    expect(() => tutor.prepare(cfg, { exercise: "dmft/ex", mode: "discuss", text: "x" })).toThrow(/ask something/);
    const pieces: string[] = [];
    const { turn, seen } = await tutor.ask(cfg, { exercise: "dmft/ex", mode: "hint", text: "It is a sum of many terms." }, (p) => pieces.push(p));
    expect(pieces.join("")).toBe("Independence.\n[hint] \"many terms\"");
    expect(turn).toMatchObject({ id: "t1", mode: "hint", rung: 1, version: "v1", general: "Independence.", model: "google/gemini-3.8-flash", cost: 0.0009,
      pins: [{ colour: "hint", quote: "many terms", from: 15, to: 25 }] });
    expect(sent.model).toBe("google/gemini-3.8-flash");
    const all = sent.messages!.flatMap((m) => m.content.map((c) => c.text)).join("\n");
    expect(all).toContain("## How to teach"); // the tutor skill
    expect(all).toContain("Sums of many independent terms are Gaussian."); // the note it tests
    expect(all).toContain("- Variance: The mean square deviation."); // what that builds on
    expect(all).toContain("forgets independence"); // the relevant struggle, without its citation
    expect(all).not.toContain("Something else entirely");
    expect(all).not.toContain("[e:");
    expect(all).toContain("rung 1 of 3");
    expect(seen.map((s) => s.name)).toContain("The developer's draft");
    // The second hint climbs a rung; the session so far is in the context.
    await tutor.ask(cfg, { exercise: "dmft/ex", mode: "hint", text: "It is a sum of many terms, each small." });
    const again = sent.messages!.flatMap((m) => m.content.map((c) => c.text)).join("\n");
    expect(again).toContain("rung 2 of 3");
    expect(again).toContain("## Earlier in this session");
    const d = teacher.readDraft(cfg, "dmft/ex");
    expect(d.versions.map((v) => [v.id, v.reason])).toEqual([["v1", "hint"], ["v2", "hint"]]);
    expect(d.turns.map((t) => [t.id, t.version])).toEqual([["t1", "v1"], ["t2", "v2"]]);
    expect(tutor.helpOf(cfg, "dmft/ex")).toEqual({ hint: 2, feedback: 0, discuss: 0 });
    expect(models.spending(cfg).byFeature).toEqual({ hint: 0.0018 });
  } finally {
    models.setFetch((...a) => fetch(...a));
  }
});
