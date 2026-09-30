// A short orientation for the start of an agent session (rdstudio brief).
// Printed by a Claude Code SessionStart hook and returned by the MCP brief
// tool, so it must stay small. A port of src/rdstudio/brief.py.

import { cmp } from "@rdstudio/core";
import { loadBundle } from "@rdstudio/core/node";
import { categoryGlobs, type Config } from "./config.ts";
import { history } from "./gitlog.ts";
import { globalConfig } from "./scopes.ts";

export function brief(cfg: Config, commits = 3): string {
  const b = loadBundle(cfg.knowledgeDir);
  if (!b.concepts.size) return `rdstudio: no knowledge base found in ${cfg.knowledge}/ (run \`rdstudio init\`).`;
  const concepts = [...b.concepts.values()];
  const lines = [`Project knowledge base (${cfg.title}): ${b.concepts.size} concepts in ${cfg.knowledge}/, OKF format.`];
  const dirs = [...b.directories.get("")!.children].sort(cmp).map((d) => `${d} (${[...b.concepts.keys()].filter((id) => id.startsWith(d + "/")).length})`);
  if (dirs.length) lines.push("Directories: " + dirs.join(", "));
  const active = concepts.filter((c) => c.type.toLowerCase() === "task" && c.tags.includes("active"));
  if (active.length) lines.push("Active tasks: " + active.slice(0, 5).map((c) => `${c.title} [${c.id}]`).join("; "));
  const stale = concepts.filter((c) => c.verificationStale).length;
  const questions = concepts.filter((c) => c.type.toLowerCase() === "question" && !c.tags.includes("answered")).length;
  const unverified = concepts.filter((c) => c.trust === "unverified").length;
  lines.push(`Awaiting the developer: ${stale} changed since review, ${questions} open questions, ${unverified} unverified.`);
  const log = history(cfg.root, categoryGlobs(cfg), commits, [cfg.output.replace(/^\/+|\/+$/g, "") + "/"]) as { commits?: { subject: string; pending?: boolean }[] };
  const recent = (log.commits ?? []).filter((c) => !c.pending).slice(0, commits).map((c) => c.subject);
  if (recent.length) lines.push("Recent commits: " + recent.join(" | "));
  const g = globalConfig(cfg);
  if (g) lines.push(`A global knowledge base (cross-project; ${loadBundle(g.knowledgeDir).concepts.size} concepts) is searchable with scope="global".`);
  lines.push("Search it (rdstudio MCP tools, the search-okf skill, or the librarian subagent) before re-deriving; "
    + "record decisions, questions and findings as you go.");
  return lines.join("\n");
}
