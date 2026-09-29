// Do the Python and Node MCP servers answer agents the same way?
//   node packages/cli/scripts/mcp-agree.ts <python executable>
// (mise run mcp:agree). Each server runs in its own copy of a project (the
// basics fixture), with its own home and global knowledge base; both get the
// same tool calls, and the tool lists and every reply are compared, times
// aside. read(frontmatter=true) differs by design (Node returns the file's
// frontmatter as written) and is compared by what it says.

import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { splitFrontmatter } from "@rdstudio/core";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const python = process.argv[2] ?? "python3";

const CALLS: [string, Record<string, unknown>][] = [
  ["brief", {}],
  ["search", { query: "random matrices" }],
  ["search", { query: "matrices", type: "Design" }],
  ["search", { query: "spectrum", tags: ["rmt"] }],
  ["search", { query: "spectrum", under: "research", limit: 1 }],
  ["search", { query: "shared knowledge", scope: "global" }],
  ["search", { query: "knowledge spectrum", scope: "all" }],
  ["search", { query: "anything", scope: "bogus" }],
  ["search", { query: "zzzz" }],
  ["outline", { id: "design/model" }],
  ["outline", { id: "/design/overview.md" }],
  ["outline", { id: "no/such" }],
  ["outline", { id: "global:shared/fact" }],
  ["read", { id: "design/model" }],
  ["read", { id: "design/model", section_heading: "stability" }],
  ["read", { id: "design/model", section_heading: "Nope" }],
  ["read", { id: "global:shared/fact" }],
  ["read", { id: "research/stale", frontmatter: true }],
  ["list_concepts", {}],
  ["list_concepts", { directory: "/research/" }],
  ["list_concepts", { directory: "nope" }],
  ["list_concepts", { scope: "global" }],
  ["backlinks", { id: "research/spectrum" }],
  ["backlinks", { id: "no/such" }],
  ["study_path", { id: "design/model" }],
  ["review_queue", {}],
  ["review_queue", { limit: 1 }],
  ["procedure_next", { procedure: "add-reference" }],
  ["procedure_next", { procedure: "add-reference", step: "add" }],
  ["procedure_next", { procedure: "procedures/add-reference", step: "adding it to papis", hops: 1 }],
  ["procedure_next", { procedure: "add-reference", step: "completely unrelated words" }],
  ["procedure_next", { procedure: "design/model" }],
  ["procedure_propose", { procedure: "add-reference", rationale: "Dedupe first.", edits: [{ op: "add_node", id: "dedupe" }, { op: "add_edge", from: "find", to: "dedupe" }] }],
  ["procedure_propose", { procedure: "add-reference", rationale: "Broken.", edits: [{ op: "add_edge", from: "find", to: "nowhere" }] }],
  ["procedure_propose", { procedure: "nope", rationale: "x", edits: [{ op: "add_node", id: "x" }] }],
  ["record", { id: "ideas/new", type: "Idea", title: "New", description: "A new idea.", tags: ["a"], body: "# Idea\n\nText." }],
  ["record", { id: "ideas/new", body: "# Idea\n\nText!" }],
  ["record", { id: "ideas/new", section_heading: "More", body: "Much more text about it, several words long." }],
  ["record", { id: "ideas/new", meta: { status: "draft", extra: null }, significant: false, actor: "agent/other" }],
  ["record", { id: "../bad", type: "X" }],
  ["record", { id: "ideas/untyped", title: "No type" }],
  ["record", { id: "shared/new-fact", type: "Fact", title: "Global", scope: "global" }],
  ["record", { id: "ideas/broken-link", type: "Idea", body: "See [missing](/nowhere.md)." }],
  ["promote", { id: "research/spectrum" }],
  ["promote", { id: "research/fresh", keep: true }],
  ["promote", { id: "research/fresh", as_id: "shared/fresh" }],
  ["promote", { id: "no/such" }],
];

function setup(base: string) {
  const home = join(base, "home"), project = join(base, "project"), gk = join(base, "gk");
  mkdirSync(join(home, ".config", "rdstudio"), { recursive: true });
  writeFileSync(join(home, ".config", "rdstudio", "config.toml"), `[global]\npath = "${gk}"\n`);
  cpSync(join(REPO, "fixtures", "bundles", "basics"), join(project, "knowledge"), { recursive: true });
  writeFileSync(join(project, "rdstudio.toml"), '[project]\ntitle = "Basics"\n\n[actors]\nagent = "agent/test"\n');
  mkdirSync(join(gk, "knowledge", "shared"), { recursive: true });
  writeFileSync(join(gk, "rdstudio.toml"), '[project]\ntitle = "Global"\n');
  writeFileSync(join(gk, "knowledge", "shared", "fact.md"), "---\ntype: Fact\ntitle: A shared fact\ndescription: Knowledge shared across projects.\n---\n\n# Fact\n\nShared knowledge.\n");
  return { home, project };
}

async function session(command: string, args: string[], base: string) {
  const { home, project } = setup(base);
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, ".config"), XDG_DATA_HOME: join(home, ".local", "share") } as Record<string, string>;
  const client = new Client({ name: "agree", version: "0" });
  await client.connect(new StdioClientTransport({ command, args, cwd: project, env, stderr: "ignore" }));
  const tools = (await client.listTools()).tools.map((t) => ({
    name: t.name, description: t.description, properties: Object.keys(t.inputSchema.properties ?? {}).sort(),
    required: [...(t.inputSchema.required ?? [])].sort(),
  })).sort((a, b) => (a.name < b.name ? -1 : 1));
  const replies: string[] = [];
  for (const [name, args] of CALLS) {
    const r = await client.callTool({ name, arguments: args });
    const content = r.content as { type: string; text?: string }[];
    const text = content.map((c) => c.text ?? "").join("\n").replaceAll(base, "<base>").replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, "<time>");
    replies.push((r.isError ? "ERROR " : "") + text);
  }
  await client.close();
  return { tools, replies };
}

const tmp = mkdtempSync(join(tmpdir(), "rdstudio-mcp-"));
const py = await session(python, ["-m", "rdstudio.cli", "mcp"], join(tmp, "py"));
const nd = await session("node", [join(REPO, "packages", "cli", "src", "main.ts"), "mcp"], join(tmp, "node"));

const diffs: string[] = [];
const toolNames = (t: typeof py.tools) => t.map((x) => x.name).join(", ");
if (toolNames(py.tools) !== toolNames(nd.tools)) diffs.push(`tools: ${toolNames(py.tools)}\n  vs   ${toolNames(nd.tools)}`);
for (const t of py.tools) {
  const n = nd.tools.find((x) => x.name === t.name);
  if (!n) continue;
  if (t.description !== n.description) diffs.push(`${t.name}: descriptions differ\n  python ${JSON.stringify(t.description)}\n  node   ${JSON.stringify(n.description)}`);
  if (JSON.stringify(t.properties) !== JSON.stringify(n.properties)) diffs.push(`${t.name}: arguments ${t.properties} vs ${n.properties}`);
  if (JSON.stringify(t.required) !== JSON.stringify(n.required)) diffs.push(`${t.name}: required ${t.required} vs ${n.required}`);
}
const meaning = (reply: string) => {
  const m = /^---\n([\s\S]*?)---\n\n([\s\S]*)$/.exec(reply);
  return m ? JSON.stringify([splitFrontmatter(`---\n${m[1]}---\n`)[0], m[2]]) : reply;
};
CALLS.forEach(([name, args], i) => {
  let [a, b] = [py.replies[i]!, nd.replies[i]!];
  if (name === "read" && args.frontmatter) [a, b] = [meaning(a), meaning(b)];
  if (a !== b) diffs.push(`${name} ${JSON.stringify(args)}:\n  python ${JSON.stringify(a).slice(0, 700)}\n  node   ${JSON.stringify(b).slice(0, 700)}`);
});
if (process.env.SHOW) for (const i of process.env.SHOW.split(",").map(Number)) console.log(`--- ${CALLS[i]![0]} ${JSON.stringify(CALLS[i]![1])}\n${nd.replies[i]}`);
console.log(`${py.tools.length} tools, ${CALLS.length} calls: ${diffs.length ? `${diffs.length} differences` : "the same"}`);
if (diffs.length) console.log(diffs.join("\n"));
process.exitCode = diffs.length ? 1 : 0;
