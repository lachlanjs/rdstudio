// rdstudio init: scaffold rdstudio into a repository, idempotently.
// A port of src/rdstudio/scaffold.py. The templates are src/rdstudio/templates,
// copied beside the program in a release.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { splitFrontmatter } from "@rdstudio/core";
import { loadBundle, writeIndexes } from "@rdstudio/core/node";
import { stringify } from "yaml";
import { PROJECT_FILE, loadConfig } from "./config.ts";
import { assetDir, walkFiles } from "./files.ts";
import { pyDumps } from "./pyjson.ts";

export const TEMPLATES = assetDir("templates", "RDSTUDIO_TEMPLATES_DIR", fileURLToPath(new URL("../../../src/rdstudio/templates/", import.meta.url)));
const SECTION_START = "<!-- rdstudio:start";
const SECTION_END = "<!-- rdstudio:end -->";
const HOOK_COMMAND = "rdstudio brief";
const OPENCODE_AGENT = "opencode/unknown";

// OpenCode subagent permissions; Claude Code's equivalent is each agent's `tools` list.
const OPENCODE_PERMISSIONS: Record<string, Record<string, string>> = {
  librarian: { edit: "deny", bash: "deny", webfetch: "deny" },
  critic: { edit: "deny", bash: "deny", webfetch: "deny" },
  searcher: { edit: "deny" },
};

const fill = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v), text);
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n?/g, "\n");

function write(path: string, content: string, root: string, force = false): string | null {
  const rel = relative(root, path).split("\\").join("/");
  if (existsSync(path)) {
    if (!force || read(path) === content) return null;
    writeFileSync(path, content, "utf8");
    return `updated ${rel}`;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
  return `created ${rel}`;
}

function onPath(cmd: string): boolean {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function mcpCommand(root: string): { command: string; args: string[] } {
  const pyproject = join(root, "pyproject.toml");
  const dev = existsSync(pyproject) && /["']rdstudio\b/.test(read(pyproject));
  return dev || !onPath("rdstudio") ? { command: "uv", args: ["run", "rdstudio", "mcp"] } : { command: "rdstudio", args: ["mcp"] };
}

/** Translate a Claude Code subagent file into an OpenCode one. */
export function opencodeAgent(src: string, name: string): string {
  const [meta, body] = splitFrontmatter(src);
  const out: Record<string, unknown> = { description: meta?.description ?? name, mode: "subagent" };
  if (OPENCODE_PERMISSIONS[name]) out.permission = OPENCODE_PERMISSIONS[name];
  return `---\n${stringify(out, { version: "1.2", lineWidth: 100 })}---\n${body}`;
}

type Json = Record<string, unknown>;

function sortedJson(v: unknown): string {
  const sort = (x: unknown): unknown => Array.isArray(x) ? x.map(sort)
    : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, y]) => [k, sort(y)])) : x;
  return JSON.stringify(sort(v));
}

function mergeJson(path: string, root: string, update: (data: Json) => void): string | null {
  const rel = relative(root, path).split("\\").join("/");
  let data: Json = {};
  if (existsSync(path)) {
    try { data = JSON.parse(read(path) || "{}") as Json; } catch { return `skipped ${rel} (not valid JSON; add rdstudio by hand)`; }
  }
  const before = sortedJson(data);
  update(data);
  if (sortedJson(data) === before) return null;
  const existed = existsSync(path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, pyDumps(data, { indent: 2 }) + "\n", "utf8");
  return `${existed ? "updated" : "created"} ${rel}`;
}

function managedSection(path: string, section: string, root: string, create: boolean): string | null {
  const rel = relative(root, path).split("\\").join("/");
  if (!existsSync(path)) {
    if (!create) return null;
    writeFileSync(path, `# ${basename(root)}\n\n${section}`, "utf8");
    return `created ${rel}`;
  }
  const text = read(path);
  let updated: string;
  if (text.includes(SECTION_START) && text.includes(SECTION_END)) {
    const start = text.indexOf(SECTION_START), end = text.indexOf(SECTION_END) + SECTION_END.length;
    updated = text.slice(0, start) + section.trim() + text.slice(end);
  } else {
    updated = text.replace(/\s+$/u, "") + "\n\n" + section;
  }
  if (updated === text) return null;
  writeFileSync(path, updated, "utf8");
  return `updated ${rel}`;
}

/** The user's name as Python's getpass.getuser() finds it: the environment first. */
function username(): string {
  for (const key of ["LOGNAME", "USER", "LNAME", "USERNAME"]) if (process.env[key]) return process.env[key]!;
  return userInfo().username;
}

const obj = (parent: Json, key: string): Json => (parent[key] ??= {}) as Json;
const arr = (parent: Json, key: string): unknown[] => (parent[key] ??= []) as unknown[];

export function init(target: string, { title, human, force = false }: { title?: string; human?: string; force?: boolean } = {}): string[] {
  const root = resolve(target);
  mkdirSync(root, { recursive: true });
  const out: string[] = [];
  const push = (msg: string | null) => { if (msg) out.push(msg); };

  const toml = join(root, PROJECT_FILE);
  if (!existsSync(toml)) {
    let who = human || loadConfig(root).human || `human:${username()}`;
    if (!who.startsWith("human:")) who = `human:${who}`;
    writeFileSync(toml,
      "# rdstudio project configuration\n" +
      "[project]\n" +
      `title = "${title || basename(root)}"\n\n` +
      "[paths]\n" +
      'knowledge = "knowledge"\n\n' +
      "[actors]\n" +
      `human = "${who}"\n` +
      'agent = "claude-code/claude"\n\n' +
      "# Which files count as which kind of change in the Changes tab.\n" +
      "# [changes.categories]\n" +
      '# code = ["src/**", "tests/**"]\n', "utf8");
    out.push(`created ${PROJECT_FILE}`);
  }
  const cfg = loadConfig(root);
  const values = { title: cfg.title, knowledge: cfg.knowledge, reports: cfg.reports, human: cfg.human || "human:<you>", agent: cfg.agent };

  // Knowledge bundle placeholders (never overwritten).
  for (const rel of walkFiles(join(TEMPLATES, "knowledge")).filter((p) => p.endsWith(".md"))) {
    push(write(join(cfg.knowledgeDir, rel), fill(read(join(TEMPLATES, "knowledge", rel)), values), root));
  }

  // Skills and agents (rdstudio-managed: --force refreshes them).
  for (const rel of walkFiles(join(TEMPLATES, "skills"))) {
    push(write(join(root, ".claude", "skills", rel), fill(read(join(TEMPLATES, "skills", rel)), values), root, force));
  }
  for (const rel of walkFiles(join(TEMPLATES, "agents")).filter((p) => !p.includes("/") && p.endsWith(".md") && !p.startsWith("."))) {
    const text = fill(read(join(TEMPLATES, "agents", rel)), values);
    push(write(join(root, ".claude", "agents", rel), text, root, force));
    push(write(join(root, ".opencode", "agents", rel), opencodeAgent(text, rel.slice(0, -3)), root, force));
  }

  // MCP registration and Claude Code settings.
  const command = mcpCommand(root);
  push(mergeJson(join(root, ".mcp.json"), root, (data) => { obj(data, "mcpServers").rdstudio = command; }));
  push(mergeJson(join(root, ".claude", "settings.json"), root, (data) => {
    const enabled = arr(data, "enabledMcpjsonServers");
    if (!enabled.includes("rdstudio")) enabled.push("rdstudio");
    const allow = arr(obj(data, "permissions"), "allow");
    if (!allow.includes("mcp__rdstudio")) allow.push("mcp__rdstudio");
    const hooks = arr(obj(data, "hooks"), "SessionStart") as { hooks?: { command?: string }[] }[];
    const brief = command.command === "rdstudio" ? HOOK_COMMAND : "uv run " + HOOK_COMMAND;
    const present = hooks.some((entry) => (entry.hooks ?? []).some((h) => (h.command ?? "").endsWith(HOOK_COMMAND)));
    if (!present) hooks.push({ hooks: [{ type: "command", command: brief }] } as never);
  }));

  // OpenCode: MCP registration. It reads skills from .claude/skills directly.
  const addOpencode = (data: Json) => {
    data.$schema ??= "https://opencode.ai/config.json";
    obj(data, "mcp").rdstudio = { type: "local", command: [command.command, ...command.args, "--agent", OPENCODE_AGENT], enabled: true };
  };
  const jsonc = join(root, "opencode.jsonc");
  push(existsSync(jsonc) && !existsSync(join(root, "opencode.json"))
    ? mergeJson(jsonc, root, addOpencode) : mergeJson(join(root, "opencode.json"), root, addOpencode));

  // Instructions: the shared section lives in AGENTS.md (read by OpenCode,
  // Codex and others); CLAUDE.md imports it.
  push(managedSection(join(root, "AGENTS.md"), fill(read(join(TEMPLATES, "agents_section.md")), values), root, true));
  const claudeMd = join(root, "CLAUDE.md");
  const linked = existsSync(claudeMd) && lstatSync(claudeMd).isSymbolicLink() && realpathSync(claudeMd) === realpathSync(join(root, "AGENTS.md"));
  if (!linked) push(managedSection(claudeMd, read(join(TEMPLATES, "claude_section.md")), root, true));

  const gitignore = join(root, ".gitignore");
  const ignoreLine = cfg.output.replace(/^\/+|\/+$/g, "") + "/";
  const lines = existsSync(gitignore) ? read(gitignore).split("\n").filter((l, i, a) => i < a.length - 1 || l) : [];
  if (!lines.includes(ignoreLine) && !lines.includes(`/${ignoreLine}`)) {
    const prefix = lines.length && lines[lines.length - 1]!.trim() ? "\n" : "";
    appendFileSync(gitignore, `${prefix}# rdstudio build output\n${ignoreLine}\n`, "utf8");
    out.push("updated .gitignore");
  }

  for (const rel of writeIndexes(loadBundle(cfg.knowledgeDir), cfg.knowledgeDir)) out.push(`wrote ${cfg.knowledge}/${rel}`);
  out.push("done. Next: `rdstudio serve` for the dashboard; start an agent session (Claude Code, OpenCode, ...) and run the bootstrap task.");
  return out;
}
