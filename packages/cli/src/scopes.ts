// The global knowledge base, promotion between bundles, and skill scopes.
// A port of src/rdstudio/scopes.py.
//
// The global knowledge base is an ordinary rdstudio root (by default
// ~/knowledge, a private git repository) named in the user configuration:
//
//   # ~/.config/rdstudio/config.toml
//   [global]
//   path = "~/knowledge"
//
// Bundles never link to each other. Knowledge moves from a project to the
// global base by promotion; the project export never includes global content.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, cpSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { isSeq } from "yaml";
import { cmp } from "@rdstudio/core";
import { loadBundle, writeIndexes } from "@rdstudio/core/node";
import { PROJECT_FILE, expandUser, loadConfig, userConfigPath, type Config } from "./config.ts";
import { init } from "./scaffold.ts";
import { conceptPath, node, readNote, writeNote } from "./store.ts";

export class ScopeError extends Error {}

/** The global knowledge base's configuration, if one is set up and enabled. */
export function globalConfig(cfg: Config): Config | null {
  if (!cfg.useGlobal || !cfg.globalBundle) return null;
  const root = expandUser(cfg.globalBundle);
  if (!existsSync(join(root, PROJECT_FILE))) return null;
  if (cfg.isProject && resolve(root) === resolve(cfg.root)) return null; // we are the global base
  return loadConfig(root);
}

/** [name, config] for "project" | "global" | "all". */
export function scoped(cfg: Config, scope: string): [string, Config][] {
  if (!["project", "global", "all"].includes(scope)) throw new ScopeError(`unknown scope '${scope}'; use project, global or all`);
  const out: [string, Config][] = [];
  if (scope === "project" || scope === "all") out.push(["project", cfg]);
  if (scope === "global" || scope === "all") {
    const g = globalConfig(cfg);
    if (g) out.push(["global", g]);
    else if (scope === "global") throw new ScopeError("no global knowledge base (run `rdstudio global init`)");
  }
  return out;
}

function setUserGlobal(path: string): string {
  const user = userConfigPath();
  let text = existsSync(user) ? readFileSync(user, "utf8") : "";
  const line = `path = "${path}"`;
  if (text.includes("[global]")) {
    const lines = text.split(/\r?\n/);
    if (lines[lines.length - 1] === "") lines.pop();
    const start = lines.indexOf("[global]");
    let end = lines.findIndex((l, i) => i > start && l.startsWith("["));
    if (end < 0) end = lines.length;
    const block = lines.slice(start + 1, end).filter((l) => !l.trim().startsWith("path"));
    lines.splice(start + 1, end - start - 1, line, ...block);
    text = lines.join("\n") + "\n";
  } else {
    text = (text.trim() ? text.replace(/\s+$/u, "") + "\n\n" : "") + `[global]\n${line}\n`;
  }
  mkdirSync(dirname(user), { recursive: true });
  writeFileSync(user, text, "utf8");
  return `set [global] path in ${user}`;
}

export function initGlobal(path: string, human?: string): string[] {
  const root = resolve(expandUser(path));
  const out = init(root, { title: "Global knowledge", human });
  if (!existsSync(join(root, ".git"))) {
    try { execFileSync("git", ["init", "-q", "-b", "main", root], { stdio: "ignore" }); } catch { /* as Python: check=False */ }
    out.push(`initialised a git repository in ${root} (private: add no remote unless you mean to)`);
  }
  out.push(setUserGlobal(root));
  return out;
}

/** Move (or copy, with `keep`) a project concept into the global base. */
export function promote(cfg: Config, cid: string, { asId, keep = false, force = false }: { asId?: string; keep?: boolean; force?: boolean } = {}) {
  const g = globalConfig(cfg);
  if (!g) throw new ScopeError("no global knowledge base (run `rdstudio global init`)");
  const project = loadBundle(cfg.knowledgeDir);
  const sourceId = project.resolveId(cid);
  if (sourceId === null) throw new ScopeError(`no project concept '${cid}'`);
  const backlinks = project.backlinks(sourceId);
  if (backlinks.length && !keep && !force) {
    throw new ScopeError(`project concepts link to it: ${backlinks.join(", ")}. Use --keep to copy instead of move, or --force to move anyway.`);
  }
  const target = conceptPath(g.knowledgeDir, asId ?? sourceId);
  if (existsSync(target)) throw new ScopeError(`the global base already has ${relative(g.knowledgeDir, target)}`);
  const src = conceptPath(cfg.knowledgeDir, sourceId);
  const note = readNote(src);
  const source = node(note.doc, { resource: `project ${cfg.title}: ${sourceId}`, title: "Promoted from a project" });
  const sources = note.doc.get("sources", true);
  if (isSeq(sources)) sources.items.push(source);
  else note.doc.set("sources", note.doc.createNode([source]));
  writeNote(target, note);
  if (!keep) unlinkSync(src);
  const newId = relative(g.knowledgeDir, target).split("\\").join("/").slice(0, -3);
  const global = loadBundle(g.knowledgeDir);
  const unresolved = global.concepts.get(newId)!.links.filter((l) => l.broken).map((l) => l.target);
  writeIndexes(global, g.knowledgeDir);
  writeIndexes(loadBundle(cfg.knowledgeDir), cfg.knowledgeDir);
  return { from: sourceId, to: newId, moved: !keep, broken_links_in_global: unresolved, project_backlinks: backlinks };
}

// ------------------------------------------------------------------ skill scopes

export const userSkillsDir = (): string => join(homedir(), ".claude", "skills");

export function skillDirs(cfg: Config): Record<"project" | "user", Map<string, string>> {
  const out = { project: new Map<string, string>(), user: new Map<string, string>() };
  for (const [scope, base] of [["project", join(cfg.root, ".claude", "skills")], ["user", userSkillsDir()]] as const) {
    if (!existsSync(base) || !statSync(base).isDirectory()) continue;
    for (const name of readdirSync(base).sort(cmp)) {
      const skill = join(base, name, "SKILL.md");
      if (existsSync(skill) && statSync(skill).isFile()) out[scope].set(name, join(base, name));
    }
  }
  return out;
}

export function moveSkill(cfg: Config, name: string, to: "user" | "project"): string {
  const dirs = skillDirs(cfg);
  const from = to === "user" ? "project" : "user";
  if (!dirs[from].has(name)) throw new ScopeError(`no ${from} skill '${name}'`);
  if (dirs[to].has(name)) throw new ScopeError(`a ${to} skill '${name}' already exists`);
  const destBase = to === "user" ? userSkillsDir() : join(cfg.root, ".claude", "skills");
  mkdirSync(destBase, { recursive: true });
  const dest = join(destBase, name);
  try {
    renameSync(dirs[from].get(name)!, dest);
  } catch { // across file systems, as shutil.move does
    cpSync(dirs[from].get(name)!, dest, { recursive: true, preserveTimestamps: true });
    rmSync(dirs[from].get(name)!, { recursive: true });
  }
  return `moved skill ${name} to ${to} scope (${dest})`;
}
