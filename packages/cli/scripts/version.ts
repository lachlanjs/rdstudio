// rdstudio's version, kept the same in pyproject.toml, packages/cli/package.json,
// VERSION in packages/cli/src/main.ts and __version__ in src/rdstudio/__init__.py:
//   node packages/cli/scripts/version.ts            print it (and fail if they differ)
//   node packages/cli/scripts/version.ts 0.2.0      set it everywhere (mise run version 0.2.0)
//   node packages/cli/scripts/version.ts --tag v0.2.0   fail unless the tag names this version (CI)

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const FILES = [
  { path: "pyproject.toml", re: /^(version = ")([^"]+)(")/m },
  { path: "packages/cli/package.json", re: /^( {2}"version": ")([^"]+)(")/m },
  { path: "packages/cli/src/main.ts", re: /^(export const VERSION = ")([^"]+)(")/m },
  { path: "src/rdstudio/__init__.py", re: /^(__version__ = ")([^"]+)(")/m },
];

const read = (p: string) => readFileSync(join(REPO, p), "utf8");
const found = FILES.map((f) => ({ ...f, version: f.re.exec(read(f.path))?.[2] }));

const [arg, value] = process.argv.slice(2);
if (arg && arg !== "--tag") {
  if (!/^\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.]+)?$/.test(arg)) { console.error(`not a version: ${arg}`); process.exit(2); }
  for (const f of FILES) writeFileSync(join(REPO, f.path), read(f.path).replace(f.re, `$1${arg}$3`));
  console.log(`set ${arg} in ${FILES.map((f) => f.path).join(", ")}; now run uv lock and npm install to update the lock files`);
  process.exit(0);
}
const versions = new Set(found.map((f) => f.version));
if (versions.size !== 1 || found.some((f) => !f.version)) {
  for (const f of found) console.error(`${f.path}: ${f.version ?? "no version found"}`);
  process.exit(1);
}
const version = found[0]!.version!;
if (arg === "--tag" && value !== `v${version}`) {
  console.error(`the tag ${value} does not match the version ${version} (tags are v<version>)`);
  process.exit(1);
}
console.log(version);
