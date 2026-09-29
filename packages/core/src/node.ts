// Reading a bundle from a folder, for Node (the command line, MCP server and
// server). Everything else in the core works on files given as text.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { Bundle, type FileEntry } from "./bundle.ts";

/** Every file and folder under `root`, Markdown with its text. */
export function readFolder(root: string): FileEntry[] {
  const out: FileEntry[] = [];
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
