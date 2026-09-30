// Commit-by-commit change lists, with each file sorted into a category.
// A port of src/rdstudio/gitlog.py.

import { execFileSync } from "node:child_process";

const STATUS: Record<string, string> = { A: "added", M: "modified", D: "deleted", R: "renamed", C: "copied", T: "modified" };

const regexes = new Map<string, RegExp>();
function globRegex(pattern: string): RegExp {
  let re = regexes.get(pattern);
  if (!re) {
    let out = "";
    for (let i = 0; i < pattern.length; ) {
      if (pattern.startsWith("**/", i)) { out += "(?:.*/)?"; i += 3; }
      else if (pattern.startsWith("**", i)) { out += ".*"; i += 2; }
      else if (pattern[i] === "*") { out += "[^/]*"; i++; }
      else if (pattern[i] === "?") { out += "[^/]"; i++; }
      else { out += pattern[i]!.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&"); i++; }
    }
    re = new RegExp("^" + out + "$");
    regexes.set(pattern, re);
  }
  return re;
}

export function categorise(path: string, categories: Record<string, string[]>): string {
  for (const [name, globs] of Object.entries(categories)) {
    if (globs.some((g) => globRegex(g).test(path))) return name;
  }
  return "other";
}

function git(root: string, ...args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 });
  } catch {
    return null;
  }
}

// Python's str.splitlines().
const LINE_BREAKS = new RegExp("\\r\\n|[\\n\\r\\v\\f\\x1c\\x1d\\x1e\\x85\\u2028\\u2029]");
const splitlines = (s: string) => s.split(LINE_BREAKS).filter((l, i, a) => i < a.length - 1 || l);

/** Recent commits (newest first), plus uncommitted changes as a pseudo-commit.
 *  Paths under `exclude` prefixes (build output) are left out. */
export function history(root: string, categories: Record<string, string[]>, limit = 200, exclude = [".rdstudio/"]): Record<string, unknown> {
  if (git(root, "rev-parse", "--is-inside-work-tree") === null) return { available: false, commits: [] };
  const excluded = (p: string) => exclude.some((e) => p.startsWith(e));
  const commits: Record<string, unknown>[] = [];
  const pending: Record<string, unknown>[] = [];
  for (const line of splitlines(git(root, "status", "--porcelain", "-uall") ?? "")) {
    if (line.length < 4) continue;
    const code = line.slice(0, 2);
    let path = line.slice(3);
    if (path.includes(" -> ")) path = path.split(" -> ").slice(1).join(" -> ");
    const bare = path.replace(/^"+|"+$/g, "");
    if (excluded(bare)) continue;
    const kind = code.includes("?") || code.includes("A") ? "added" : code.includes("D") ? "deleted" : "modified";
    pending.push({ path: bare, status: kind, category: categorise(path, categories) });
  }
  if (pending.length) {
    commits.push({ hash: "", short: "", author: "", date: "", subject: "Uncommitted changes", files: pending, pending: true });
  }
  const log = git(root, "log", `-n${limit}`, "--name-status", "--no-renames", "--format=%x1e%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1f%P");
  for (const block of (log ?? "").split("\x1e")) {
    if (!block.trim()) continue;
    const nl = block.indexOf("\n");
    const header = nl < 0 ? block : block.slice(0, nl), rest = nl < 0 ? "" : block.slice(nl + 1);
    const [full = "", short = "", author = "", date = "", subject = "", parents = ""] = header.split("\x1f");
    const files: Record<string, unknown>[] = [];
    for (const line of splitlines(rest)) {
      const parts = line.split("\t");
      if (parts.length < 2) continue;
      const path = parts[parts.length - 1]!;
      if (excluded(path)) continue;
      files.push({ path, status: STATUS[parts[0]!.slice(0, 1)] ?? "modified", category: categorise(path, categories) });
    }
    commits.push({ hash: full, short, author, date, subject, files, merge: parents.split(/\s+/).filter(Boolean).length > 1 });
  }
  const branch = (git(root, "rev-parse", "--abbrev-ref", "HEAD") ?? "").trim();
  return { available: true, branch, commits };
}
