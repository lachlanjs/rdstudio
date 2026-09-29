// File helpers shared by the build and the server.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cmpTuple } from "@rdstudio/core";

/** Every file under `root` (relative, "/"-separated), sorted part by part as
 *  Python sorts paths. Missing folders give nothing. */
export function walkFiles(root: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>(); // folders already walked, so a symlink loop ends
  const walk = (dir: string, prefix: string): void => {
    let entries;
    try {
      const real = realpathSync(dir);
      if (seen.has(real)) return;
      seen.add(real);
      entries = readdirSync(dir, { withFileTypes: true });
    } catch { return; }
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const full = join(dir, e.name);
      // Symlinks are followed, as Python's rglob and glob do for their matches.
      let kind: "dir" | "file" | null = e.isDirectory() ? "dir" : e.isFile() ? "file" : null;
      if (e.isSymbolicLink()) {
        try { const st = statSync(full); kind = st.isDirectory() ? "dir" : st.isFile() ? "file" : null; } catch { kind = null; }
      }
      if (kind === "dir") walk(full, rel);
      else if (kind === "file") out.push(rel);
    }
  };
  walk(root, "");
  return out.sort((a, b) => cmpTuple(a.split("/"), b.split("/")));
}

/** Copy `src` into `dst`, skipping files whose size and mtime already match and the paths in `skip`. */
export function syncTree(src: string, dst: string, skip: ReadonlySet<string> = new Set()): void {
  for (const rel of walkFiles(src)) {
    if (skip.has(rel)) continue;
    const from = join(src, rel), to = join(dst, rel);
    const st = statSync(from);
    if (existsSync(to)) {
      const tt = statSync(to);
      if (tt.size === st.size && Math.floor(tt.mtimeMs / 1000) === Math.floor(st.mtimeMs / 1000)) continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    utimesSync(to, st.atime, st.mtime); // as shutil.copy2 does
  }
}

export function writeIfChanged(path: string, content: string): void {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export const dirnamePosix = (p: string): string => {
  let head = p.slice(0, p.lastIndexOf("/") + 1);
  if (head && !/^\/+$/.test(head)) head = head.replace(/\/+$/, "");
  return head;
};
export const joinPosix = (a: string, b: string): string => (b.startsWith("/") || !a ? b : a.endsWith("/") ? a + b : `${a}/${b}`);
export function normpathPosix(p: string): string {
  if (!p) return ".";
  const initial = p.startsWith("/") ? (p.startsWith("//") && !p.startsWith("///") ? 2 : 1) : 0;
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (!part || part === ".") continue;
    if (part !== ".." || (!initial && !out.length) || out[out.length - 1] === "..") out.push(part);
    else if (out.length) out.pop();
  }
  return "/".repeat(initial) + out.join("/") || ".";
}

/** A folder of rdstudio's own files (the dashboard, the init templates): named
 *  by an environment variable, or beside the running program (a bundled
 *  release, npm or Python), or in the repository (running from source). */
export function assetDir(name: "web" | "templates", envVar: string, fromSource: string): string {
  const env = process.env[envVar];
  if (env) return env;
  const beside = fileURLToPath(new URL(`./${name}/`, import.meta.url));
  return existsSync(join(beside, name === "web" ? "index.html" : "agents_section.md")) ? beside : fromSource;
}
