// The teacher: the agent's side of learning, in a private folder beside the
// learner record (learners/<project>/teacher/). Its skills ship as defaults in
// the templates (templates/teacher/skills/<name>.md); an override of the same
// name in teacher/skills/ wins, and keeps a copy of the default it was made
// from (skills/.base/) so a later change to the default can be shown. The
// harness reads them through MCP (teacher_skills, teacher_skill), so overrides
// stay private on a shared repository. See knowledge/design/teacher.md.
//
// The learner folder becomes a git repository on first write here, and each
// write is a commit, so how the teacher's picture changed is its history.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { LearnerError, splitFrontmatter } from "@rdstudio/core";
import { PROJECT_FILE, readToml, type Config } from "./config.ts";
import * as learner from "./learner.ts";
import { fileURLToPath } from "node:url";
import { assetDir } from "./files.ts";

export const PROFILES = ["topic", "codebase", "project"] as const;
export type Profile = (typeof PROFILES)[number];
const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_SKILL_BYTES = 200_000;

export const teacherDir = (cfg: Config): string => join(learner.recordDir(cfg), "teacher");
// The same folder as scaffold.ts's TEMPLATES (not imported from there: init imports this).
const TEMPLATES = assetDir("templates", "RDSTUDIO_TEMPLATES_DIR", fileURLToPath(new URL("../../../src/rdstudio/templates/", import.meta.url)));
const defaultsDir = (): string => join(TEMPLATES, "teacher", "skills");
const read = (path: string): string => readFileSync(path, "utf8").replace(/\r\n?/g, "\n");

// ------------------------------------------------------------------ profile

/** Files that say a repository holds code, for the default profile. */
const CODE_MARKERS = ["package.json", "pyproject.toml", "setup.py", "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "CMakeLists.txt", "Makefile", "mix.exs", "Gemfile", "src"];

export function guessProfile(cfg: Config): Profile {
  return CODE_MARKERS.some((f) => existsSync(join(cfg.root, f))) ? "codebase" : "topic";
}

/** The profile is the project's, not the learner's (a codebase is a codebase
 *  for everyone), so it lives in rdstudio.toml: [teacher] profile. */
export function profile(cfg: Config): { profile: Profile; set: boolean } {
  // Read afresh: a long-running server sees a profile set since it started.
  const t = cfg.isProject ? readToml(join(cfg.root, PROJECT_FILE)).teacher : cfg.raw.teacher;
  const p = typeof t === "object" && t !== null ? (t as Record<string, unknown>).profile : undefined;
  return (PROFILES as readonly unknown[]).includes(p) ? { profile: p as Profile, set: true } : { profile: guessProfile(cfg), set: false };
}

/** Set [teacher] profile in rdstudio.toml, changing only that line (or adding the table). */
export function setProfile(cfg: Config, p: string): Profile {
  if (!(PROFILES as readonly string[]).includes(p)) throw new LearnerError(`a profile is one of ${PROFILES.join(", ")}`);
  const path = join(cfg.root, PROJECT_FILE);
  const text = existsSync(path) ? read(path) : "";
  const lines = text.split("\n");
  const head = lines.findIndex((l) => /^\s*\[teacher\]\s*(#.*)?$/.test(l));
  let out: string;
  if (head < 0) {
    out = `${text.replace(/\s*$/, "")}${text.trim() ? "\n\n" : ""}# How the teacher works here: topic, codebase or project.\n[teacher]\nprofile = "${p}"\n`;
  } else {
    let end = lines.findIndex((l, i) => i > head && /^\s*\[/.test(l));
    if (end < 0) end = lines.length;
    const at = lines.findIndex((l, i) => i > head && i < end && /^\s*profile\s*=/.test(l));
    if (at >= 0) lines[at] = `profile = "${p}"`;
    else lines.splice(head + 1, 0, `profile = "${p}"`);
    out = lines.join("\n");
  }
  writeFileSync(path, out, "utf8");
  return p as Profile;
}

// ------------------------------------------------------------------ skills

export interface SkillInfo {
  name: string;
  description: string;
  /** default: rdstudio's; changed: customised here; own: written here, with no default. */
  status: "default" | "changed" | "own";
  /** Customised, and rdstudio's default has changed since. */
  defaultChanged: boolean;
}

export interface Skill extends SkillInfo {
  text: string; // what the agent reads
  default: string | null; // rdstudio's current default
  base: string | null; // the default the customisation was made from
}

const describeSkill = (text: string): string => {
  const [meta] = splitFrontmatter(text);
  return typeof meta?.description === "string" ? meta.description : "";
};
function checkName(name: string): string {
  if (!SKILL_NAME.test(name)) throw new LearnerError("a skill's name is lowercase letters, digits and dashes");
  return name;
}
const mdNames = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md") && SKILL_NAME.test(f.slice(0, -3))).map((f) => f.slice(0, -3)) : [];
const maybe = (path: string): string | null => (existsSync(path) ? read(path) : null);

export function skill(cfg: Config, name: string): Skill | null {
  checkName(name);
  const own = cfg.isProject ? maybe(join(teacherDir(cfg), "skills", `${name}.md`)) : null;
  const def = maybe(join(defaultsDir(), `${name}.md`));
  const text = own ?? def;
  if (text === null) return null;
  const base = own !== null && def !== null ? maybe(join(teacherDir(cfg), "skills", ".base", `${name}.md`)) : null;
  return {
    name, description: describeSkill(text), text, default: def, base,
    status: own === null ? "default" : def === null ? "own" : "changed",
    defaultChanged: base !== null && def !== null && base !== def,
  };
}

/** Every skill: the defaults (teach first), then any written here. */
export function skills(cfg: Config): SkillInfo[] {
  const names = new Set([...mdNames(defaultsDir()), ...(cfg.isProject ? mdNames(join(teacherDir(cfg), "skills")) : [])]);
  const order = (n: string) => (n === "teach" ? "" : n);
  return [...names].sort((a, b) => (order(a) < order(b) ? -1 : 1)).map((n) => {
    const { text: _t, default: _d, base: _b, ...info } = skill(cfg, n)!;
    return info;
  });
}

/** Customise a skill (or write one of your own): the text replaces the default for the agent. */
export function saveSkill(cfg: Config, name: string, text: unknown): Skill {
  checkName(name);
  if (typeof text !== "string" || !text.trim()) throw new LearnerError("a skill needs some text");
  if (Buffer.byteLength(text) > MAX_SKILL_BYTES) throw new LearnerError("that skill is too long");
  const body = text.replace(/\r\n?/g, "\n").replace(/\s*$/, "\n");
  const def = maybe(join(defaultsDir(), `${name}.md`));
  const files: [string, string][] = [[`skills/${name}.md`, body]];
  // The default it was made from, kept once (on customising) and refreshed only by a reset.
  if (def !== null && !existsSync(join(teacherDir(cfg), "skills", ".base", `${name}.md`))) files.push([`skills/.base/${name}.md`, def]);
  writeMany(cfg, files, `Skill ${name}: ${def === null ? "written" : "customised"}`);
  return skill(cfg, name)!;
}

/** Back to rdstudio's default (or, for a skill of your own, delete it). */
export function resetSkill(cfg: Config, name: string): Skill | null {
  checkName(name);
  const dir = join(teacherDir(cfg), "skills");
  const gone = [join(dir, `${name}.md`), join(dir, ".base", `${name}.md`)].filter(existsSync);
  for (const p of gone) unlinkSync(p);
  if (gone.length) commit(cfg, `Skill ${name}: reset to the default`);
  return skill(cfg, name);
}

/** The skill as the agent reads it: a line on the profile, then the text. */
export function skillForAgent(cfg: Config, name: string): string {
  const s = skill(cfg, name);
  if (!s) return `No skill '${name}'. teacher_skills lists them.`;
  const p = profile(cfg);
  const note = s.status === "default" ? "rdstudio's default" : s.status === "changed" ? "customised by the developer" : "written by the developer";
  return `Profile: ${p.profile}${p.set ? "" : " (guessed; not set)"}. This skill: ${note}.\n\n${s.text}`;
}

// ------------------------------------------------------------------ writing, with history

function writeMany(cfg: Config, files: [string, string][], message: string): void {
  if (!cfg.isProject) throw new LearnerError("not in an rdstudio project");
  for (const [rel, text] of files) {
    const path = join(teacherDir(cfg), rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, "utf8");
  }
  commit(cfg, message);
}

const git = (dir: string, args: string[]): string =>
  execFileSync("git", args, { cwd: dir, encoding: "utf8", timeout: 15_000, stdio: ["ignore", "pipe", "pipe"] });

/** Whether the learner folder keeps its own history: a repository of its own,
 *  made here if it is in none. Inside another repository (a learner path set
 *  in a private knowledge base, say) its history is left to that one. */
export function versioned(cfg: Config): boolean {
  const dir = learner.recordDir(cfg);
  if (existsSync(join(dir, ".git"))) return true;
  mkdirSync(dir, { recursive: true });
  try {
    git(dir, ["rev-parse", "--show-toplevel"]);
    return false; // inside another repository
  } catch { /* in none */ }
  try {
    git(dir, ["init", "-q"]);
    return true;
  } catch {
    return false; // no git
  }
}

/** Commit everything in the learner folder (the record with it). Best effort:
 *  without git or an identity, the files are still written. */
export function commit(cfg: Config, message: string): boolean {
  if (!versioned(cfg)) return false;
  const dir = learner.recordDir(cfg);
  try {
    git(dir, ["add", "-A"]);
    if (!git(dir, ["status", "--porcelain"]).trim()) return false;
    const commitArgs = ["-c", "commit.gpgsign=false", "commit", "-q", "--no-verify", "-m", message];
    try {
      git(dir, commitArgs);
    } catch {
      // No identity configured: commit as rdstudio rather than lose the history.
      git(dir, ["-c", "user.name=rdstudio", "-c", "user.email=rdstudio@localhost", ...commitArgs]);
    }
    return true;
  } catch {
    return false;
  }
}

/** The teacher's history, newest first. */
export function history(cfg: Config, limit = 30): { at: string; message: string }[] {
  const dir = learner.recordDir(cfg);
  if (!existsSync(join(dir, ".git"))) return [];
  try {
    return git(dir, ["log", `-${limit}`, "--format=%cI%x09%s"]).split("\n").filter(Boolean).map((l) => {
      const [at, ...rest] = l.split("\t");
      return { at: at!, message: rest.join("\t") };
    });
  } catch {
    return [];
  }
}
