// Stage the rdstudio npm package in .release/npm/ and pack it:
//   node packages/cli/scripts/npm-package.ts      (mise run release:npm)
// The package is one bundled file (the core and every dependency inside), the
// dashboard's files, the init templates, a README and the licence. Nothing is
// published: `npm publish` in .release/npm/ does that (see
// knowledge/procedures/publish-npm.md).

import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = join(REPO, ".release", "npm");
const cli = JSON.parse(readFileSync(join(REPO, "packages", "cli", "package.json"), "utf8"));
const version: string = cli.version;

// One version everywhere.
const python = /^version = "([^"]+)"/m.exec(readFileSync(join(REPO, "pyproject.toml"), "utf8"))?.[1];
const main = /export const VERSION = "([^"]+)"/.exec(readFileSync(join(REPO, "packages", "cli", "src", "main.ts"), "utf8"))?.[1];
if (python !== version || main !== version) {
  console.error(`versions differ: packages/cli ${version}, pyproject.toml ${python}, main.ts VERSION ${main}`);
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
execFileSync(join(REPO, "node_modules", ".bin", "esbuild"), [
  join(REPO, "packages", "cli", "src", "main.ts"), "--bundle", "--platform=node", "--target=node24", "--format=esm",
  `--outfile=${join(OUT, "rdstudio.mjs")}`, "--legal-comments=none",
  "--banner:js=import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
], { stdio: "inherit" });
chmodSync(join(OUT, "rdstudio.mjs"), 0o755);
cpSync(join(REPO, "src", "rdstudio", "web"), join(OUT, "web"), { recursive: true });
cpSync(join(REPO, "src", "rdstudio", "templates"), join(OUT, "templates"), { recursive: true });
cpSync(join(REPO, "LICENSE"), join(OUT, "LICENSE"));

writeFileSync(join(OUT, "package.json"), JSON.stringify({
  name: "rdstudio",
  version,
  description: cli.description,
  license: "MIT",
  author: "Lachlan Stewart",
  homepage: "https://github.com/lachlanjs/rdstudio",
  repository: { type: "git", url: "git+https://github.com/lachlanjs/rdstudio.git" },
  bugs: "https://github.com/lachlanjs/rdstudio/issues",
  keywords: ["knowledge-base", "okf", "mcp", "agents", "research", "claude-code", "opencode", "learning"],
  type: "module",
  bin: { rdstudio: "rdstudio.mjs" },
  files: ["rdstudio.mjs", "web/", "templates/"],
  engines: { node: ">=24" },
}, null, 2) + "\n");

writeFileSync(join(OUT, "README.md"), `# rdstudio

A knowledge base, dashboard and agent toolkit for research projects, which you
add to any repository. You and your agents write notes, decisions, tasks and
procedures as Markdown in \`knowledge/\` (Open Knowledge Format), and a local
dashboard lets you browse them as a map, a graph and a reading order.

Needs Node 24 or later and git.

\`\`\`sh
cd my-project
npx rdstudio init --human human:<your-name>
npx rdstudio serve                # dashboard at http://localhost:8000
\`\`\`

or install it: \`npm install -g rdstudio\`, then \`rdstudio --help\`.

\`init\` sets up Claude Code and OpenCode (skills, subagents, and the MCP server
\`rdstudio mcp\`). It also installs with Python tooling: \`uv tool install rdstudio\`.

See https://github.com/lachlanjs/rdstudio for everything else. MIT licence.
`);

const packed = execFileSync("npm", ["pack", "--json"], { cwd: OUT, encoding: "utf8" });
const [info] = JSON.parse(packed) as { filename: string; size: number; unpackedSize: number; entryCount: number }[];
console.log(`\n${OUT}/${info!.filename}: ${info!.entryCount} files, ${(info!.size / 1e6).toFixed(1)} MB packed, ${(info!.unpackedSize / 1e6).toFixed(1)} MB unpacked`);
console.log("Publish with: cd .release/npm && npm publish   (after npm login; see knowledge/procedures/publish-npm.md)");
