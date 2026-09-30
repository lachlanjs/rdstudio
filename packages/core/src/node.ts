// Reading a bundle from a folder, for Node (the command line, MCP server and
// server). Everything else in the core works on files given as text.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { Bundle, type FileEntry } from "./bundle.ts";
import { cmp } from "./text.ts";

/** Every file and folder under `root`, Markdown with its text. */
export function readFolder(root: string): FileEntry[] {
  const out: FileEntry[] = [];
  if (!existsSync(root) || !statSync(root).isDirectory()) return out; // no bundle yet: empty, as in Python
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const path = relative(root, full).split(sep).join("/");
      if (entry.isDirectory()) {
        out.push({ path, dir: true });
        walk(full);
      } else if (entry.isFile()) {
        const md = entry.name.endsWith(".md");
        out.push({ path, ...(md ? { text: readFileSync(full, "utf8"), mtime: statSync(full).mtimeMs } : {}) });
      }
    }
  };
  walk(root);
  return out;
}

export function loadBundle(root: string): Bundle {
  return Bundle.fromFiles(readFolder(root));
}

/** Write every folder's generated index.md under `root`; return the paths that changed. */
export function writeIndexes(bundle: Bundle, root: string): string[] {
  const changed: string[] = [];
  for (const directory of [...bundle.directories.keys()].sort(cmp)) {
    const rel = directory ? `${directory}/index.md` : "index.md";
    const target = join(root, rel);
    const content = bundle.renderIndex(directory);
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (current !== content) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, "utf8");
      changed.push(rel);
    }
    bundle.directories.get(directory)!.hasIndex = true;
  }
  return changed;
}
