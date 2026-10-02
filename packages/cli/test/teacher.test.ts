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
