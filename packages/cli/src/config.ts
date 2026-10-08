// Project (rdstudio.toml) and user (~/.config/rdstudio/config.toml)
// configuration.

import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parse } from "smol-toml";

export const PROJECT_FILE = "rdstudio.toml";

export const DEFAULT_CATEGORIES: Record<string, string[]> = {
  knowledge: ["{knowledge}/**"],
  reports: ["{reports}/**"],
  agent: [".claude/**", ".mcp.json", "CLAUDE.md", "AGENTS.md", ".opencode/**", "opencode.json",
    "opencode.jsonc", "rdstudio.toml"],
  code: [
    "**/*.py", "**/*.pyi", "**/*.ts", "**/*.js", "**/*.svelte", "**/*.rs", "**/*.c",
    "**/*.cpp", "**/*.h", "**/*.jl", "**/*.go", "**/*.java", "**/*.sh", "**/*.css",
    "**/*.html", "**/*.toml", "**/*.lock", "**/pyproject.toml", "**/package.json",
  ],
};

export type Table = Record<string, unknown>;

export function userConfigPath(): string {
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "rdstudio", "config.toml");
}

export function readToml(path: string): Table {
  if (!existsSync(path) || !statSync(path).isFile()) return {};
  return parse(readFileSync(path, "utf8")) as Table;
}

const table = (v: unknown): Table => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Table) : {});
const str = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);

/** The nearest folder holding rdstudio.toml, from `start` upwards. */
export function findProjectRoot(start = process.cwd()): string | null {
  for (let here = resolve(start); ; here = dirname(here)) {
    const candidate = join(here, PROJECT_FILE);
    if (existsSync(candidate) && statSync(candidate).isFile()) return here;
    if (dirname(here) === here) return null;
  }
}

export interface Config {
  root: string;
  title: string;
  knowledge: string;
  reports: string;
  output: string;
  human: string; // such as "human:lachlan"
  agent: string;
  categories: Record<string, string[]>;
  globalBundle: string | null;
  useGlobal: boolean;
  isProject: boolean;
  raw: Table;
  knowledgeDir: string;
  reportsDir: string;
  outputDir: string;
  siteDir: string;
}

/** Configuration for the project containing `start` (default: the working
 *  folder). Outside a project, the root is `start` and defaults apply. */
export function loadConfig(start?: string): Config {
  const user = readToml(userConfigPath());
  const found = findProjectRoot(start);
  const root = found ?? resolve(start ?? process.cwd());
  const project = readToml(join(root, PROJECT_FILE));
  const proj = table(project.project), paths = table(project.paths);
  const actors = { ...table(user.actors), ...table(project.actors) };
  const globalPath = table(user.global).path;
  const knowledge = str(paths.knowledge, "knowledge"), reports = str(paths.reports, "reports");
  const output = str(paths.output, ".rdstudio");
  const outputDir = join(root, output);
  return {
    root,
    title: str(proj.title, "") || basename(root),
    knowledge,
    reports,
    output,
    human: str(actors.human, ""),
    agent: str(actors.agent, "claude-code/unknown"),
    categories: table(table(project.changes).categories) as Record<string, string[]>,
    globalBundle: typeof globalPath === "string" && globalPath ? expandUser(globalPath) : null,
    useGlobal: table(project.global).enabled !== false,
    isProject: found !== null,
    raw: project,
    knowledgeDir: join(root, knowledge),
    reportsDir: join(root, reports),
    outputDir,
    siteDir: join(outputDir, "site"),
  };
}

export function categoryGlobs(cfg: Config): Record<string, string[]> {
  const cats = Object.keys(cfg.categories).length ? cfg.categories : DEFAULT_CATEGORIES;
  const fill = (g: string) => g.replaceAll("{knowledge}", cfg.knowledge).replaceAll("{reports}", cfg.reports);
  return Object.fromEntries(Object.entries(cats).map(([name, globs]) => [name, globs.map(fill)]));
}

export function expandUser(path: string): string {
  return path === "~" ? homedir() : path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}
