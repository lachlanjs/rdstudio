// Reshaping a bundle from the app: moving or renaming notes and folders with
// the links to them rewritten, and deleting notes and empty folders. Links are
// rewritten where they are written ([text](target) and [ref]: target, outside
// code), each in its own style (absolute links stay absolute, relative ones
// are recomputed), and only when they would otherwise break; every other byte
// is left as it was.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { cmp } from "@rdstudio/core";
import { loadBundle } from "@rdstudio/core/node";
import { ConflictError, fileVersion, splitSource } from "./edit.ts";
import { StoreError, conceptPath, existingNotePath } from "./store.ts";
import { normpathPosix } from "./files.ts";

const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
// Folder names: letters and digits in any script first, then also . _ -.
const FOLDER = /^[\p{L}\p{N}][\p{L}\p{N}._-]*(?:\/[\p{L}\p{N}][\p{L}\p{N}._-]*)*$/u;

// ------------------------------------------------------------------ paths

const posixDirname = (p: string): string => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");

/** `to` relative to the folder `from` (both bundle paths). */
function relativePath(from: string, to: string): string {
  const a = from ? from.split("/") : [], b = to.split("/");
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  const up = a.length - i;
  const rest = b.slice(i).join("/");
  return (up ? "../".repeat(up) : "") + rest || "./";
}

/** A link target resolved to a bundle path (a .md file, or a folder ending in
 *  /; starting ../ when outside the bundle, which a move must keep pointing at
 *  the same place), or null for web addresses and anchors. */
function resolveTarget(raw: string, noteDir: string): { path: string; suffix: string } | null {
  if (!raw || raw.startsWith("#") || SCHEME.test(raw)) return null;
  const cut = raw.search(/[#?]/);
  const target = cut < 0 ? raw : raw.slice(0, cut), suffix = cut < 0 ? "" : raw.slice(cut);
  let decoded: string;
  try { decoded = decodeURI(target); } catch { decoded = target; }
  if (!decoded) return null;
  const joined = decoded.startsWith("/") ? decoded.replace(/^\/+/, "") : noteDir ? `${noteDir}/${decoded}` : decoded;
  let norm = joined ? normpathPosix(joined) : ".";
  if (norm === ".") norm = "";
  if (decoded.endsWith("/") || norm === "") return { path: norm ? norm + "/" : "/", suffix };
  return { path: norm, suffix };
}

// ------------------------------------------------------------------ finding links in the text

interface Found { start: number; end: number; raw: string } // offsets of the target in the text

/** Where link targets are written in a Markdown body, outside code. */
export function linkTargets(body: string): Found[] {
  const out: Found[] = [];
  const lines = body.split("\n");
  let offset = 0, fence: string | null = null;
  for (const line of lines) {
    const start = offset;
    offset += line.length + 1;
    const fenceMark = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) { if (fenceMark && fenceMark[1]![0] === fence[0] && fenceMark[1]!.length >= fence.length) fence = null; continue; }
    if (fenceMark) { fence = fenceMark[1]!; continue; }
    // Blank out inline code (same length), so links inside it are not seen.
    const visible = line.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m) => " ".repeat(m.length));
    const def = /^ {0,3}\[[^\]]+\]:[ \t]*(<[^>\n]*>|\S+)/.exec(visible);
    if (def) {
      const raw = def[1]!, at = def.index + def[0].length - raw.length;
      out.push(angled(start + at, raw));
      continue;
    }
    const inline = /\]\([ \t]*(<[^>\n]*>|[^\s)]+)/g;
    for (let m; (m = inline.exec(visible)); ) {
      const raw = m[1]!, at = m.index + m[0].length - raw.length;
      out.push(angled(start + at, raw));
    }
  }
  return out;
}

function angled(start: number, raw: string): Found {
  return raw.startsWith("<") && raw.endsWith(">") ? { start: start + 1, end: start + raw.length - 1, raw: raw.slice(1, -1) } : { start, end: start + raw.length, raw };
}

/** Rewrite the links in `body` (a note in `oldDir`, now in `newDir`) whose
 *  targets `move` maps to a new place; unchanged when nothing needs it. */
export function rewriteLinks(body: string, oldDir: string, newDir: string, move: (path: string) => string | null): string {
  let out = "", at = 0;
  for (const f of linkTargets(body)) {
    const was = resolveTarget(f.raw, oldDir);
    if (!was) continue;
    const now = move(was.path) ?? was.path;
    const still = resolveTarget(f.raw, newDir);
    if (still && still.path === now) continue; // still points to the right place
    const absolute = f.raw.startsWith("/");
    const folder = now.endsWith("/");
    const bare = folder ? now.slice(0, -1) : now;
    let text = absolute ? "/" + bare + (folder && bare ? "/" : "") : relativePath(newDir, bare) + (folder && !relativePath(newDir, bare).endsWith("/") ? "/" : "");
    if (/%[0-9A-Fa-f]{2}/.test(f.raw)) text = encodeURI(text);
    else if (/\s/.test(text)) text = text.replace(/ /g, "%20");
    out += body.slice(at, f.start) + text + was.suffix;
    at = f.end;
  }
  return at ? out + body.slice(at) : body;
}

// ------------------------------------------------------------------ files

function markdownFiles(root: string, dir = ""): string[] {
  const out: string[] = [];
  let entries;
  try { entries = readdirSync(join(root, dir), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...markdownFiles(root, rel));
    else if (e.name.endsWith(".md")) out.push(rel);
  }
  return out.sort(cmp);
}

/** Rewrite every note's links for a move, `move` mapping old bundle paths to
 *  new ones; `before` gives a moved file's old path, to resolve its relative
 *  links from. The changed files. */
function rewriteAll(root: string, move: (path: string) => string | null, before: Map<string, string>): string[] {
  const changed: string[] = [];
  for (const rel of markdownFiles(root)) {
    const name = rel.slice(rel.lastIndexOf("/") + 1);
    if (name === "index.md") continue; // regenerated by the build
    const file = join(root, rel);
    const text = readFileSync(file, "utf8");
    let prefix = "", body = text;
    try { [prefix, , body] = splitSource(text); } catch { /* unreadable frontmatter: links in all of it */ }
    // Where this file was before the move, to resolve its relative links.
    const oldRel = before.get(rel) ?? rel;
    const next = rewriteLinks(body, posixDirname(oldRel), posixDirname(rel), move);
    if (next !== body) {
      writeFileSync(file, prefix + next, "utf8");
      changed.push(rel);
    }
  }
  return changed;
}

export interface MoveResult {
  moved: { from: string; to: string }[]; // note ids
  rewritten: string[]; // files whose links were updated
}

const idOf = (path: string) => path.slice(0, -3);

/** Move or rename one note; `base` (its version) refuses a note changed since. */
export function moveNote(root: string, from: string, to: string, base?: string | null): MoveResult {
  const src = existingNotePath(root, from), dest = conceptPath(root, to);
  if (!existsSync(src)) throw new ConflictError(`no such note: ${from}`, null);
  if (base && fileVersion(readFileSync(src, "utf8")) !== base) throw new ConflictError(`${from} changed since you opened it`, null);
  if (existsSync(dest)) throw new StoreError(`${to.replace(/\.md$/, "")} already exists`);
  const oldPath = src.slice(root.replace(/\/+$/, "").length + 1), newPath = dest.slice(root.replace(/\/+$/, "").length + 1);
  if (oldPath === newPath) return { moved: [], rewritten: [] };
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(src, dest);
  removeEmptyFolders(root, posixDirname(oldPath));
  const rewritten = rewriteAll(root, (p) => (p === oldPath ? newPath : null), new Map([[newPath, oldPath]]));
  return { moved: [{ from: idOf(oldPath), to: idOf(newPath) }], rewritten };
}

/** Move or rename a folder with everything in it. */
export function moveFolder(root: string, from: string, to: string): MoveResult {
  const a = normpathPosix(from.replace(/^\/+|\/+$/g, "")), b = normpathPosix(to.replace(/^\/+|\/+$/g, ""));
  for (const f of [a, b]) if (!FOLDER.test(f) || f.startsWith("..")) throw new StoreError(`invalid folder: '${f}'`);
  if (b === a || b.startsWith(a + "/")) throw new StoreError("a folder cannot move into itself");
  if (!existsSync(join(root, a)) || !statSync(join(root, a)).isDirectory()) throw new StoreError(`no such folder: ${a}`);
  if (existsSync(join(root, b))) throw new StoreError(`${b} already exists`);
  const files = markdownFiles(root, a);
  mkdirSync(dirname(join(root, b)), { recursive: true });
  renameSync(join(root, a), join(root, b));
  removeEmptyFolders(root, posixDirname(a));
  const map = (p: string): string | null => {
    if (p === a + "/" || p === a) return p === a ? b : b + "/";
    return p.startsWith(a + "/") ? b + p.slice(a.length) : null;
  };
  const rewritten = rewriteAll(root, map, new Map(files.map((f) => [map(f)!, f])));
  const moved = files.filter((f) => !/(^|\/)(index|log)\.md$/.test(f)).map((f) => ({ from: idOf(f), to: idOf(map(f)!) }));
  return { moved, rewritten };
}

export interface DeleteResult {
  deleted: string;
  /** Notes that linked to it: their links are now broken, for lint to report. */
  backlinks: string[];
}

/** Delete a note; `base` (its version) refuses a note changed since. */
export function deleteNote(root: string, id: string, base?: string | null): DeleteResult {
  const path = existingNotePath(root, id);
  if (!existsSync(path)) throw new ConflictError(`no such note: ${id}`, null);
  if (base && fileVersion(readFileSync(path, "utf8")) !== base) throw new ConflictError(`${id} changed since you opened it`, null);
  const rel = path.slice(root.replace(/\/+$/, "").length + 1);
  const backlinks = loadBundle(root).backlinks(idOf(rel));
  unlinkSync(path);
  removeEmptyFolders(root, posixDirname(rel));
  return { deleted: idOf(rel), backlinks };
}

export interface FolderDeleteResult {
  deleted: string;
  notes: string[]; // the notes deleted with it
  /** Notes elsewhere that linked into it: their links are now broken. */
  backlinks: string[];
}

/** Delete a folder. One holding notes is deleted only with `withNotes`; one
 *  holding other files (images, data) is refused, so nothing goes unseen. */
export function deleteFolder(root: string, folder: string, withNotes = false): FolderDeleteResult {
  const f = normpathPosix(folder.replace(/^\/+|\/+$/g, ""));
  if (!FOLDER.test(f) || f.startsWith("..")) throw new StoreError(`invalid folder: '${f}'`);
  const dir = join(root, f);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new StoreError(`no such folder: ${f}`);
  const others: string[] = [];
  (function walk(d: string, rel: string): void {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name), `${rel}/${e.name}`);
      else if (!e.name.endsWith(".md")) others.push(`${rel}/${e.name}`);
    }
  })(dir, f);
  if (others.length) throw new StoreError(`${f} holds files other than notes (${others.slice(0, 3).join(", ")}${others.length > 3 ? ", …" : ""}): move or delete them first`);
  const notes = markdownFiles(root, f).filter((p) => !/(^|\/)(index|log)\.md$/.test(p)).map(idOf);
  const logs = markdownFiles(root, f).filter((p) => p.endsWith("/log.md"));
  if (logs.length && !withNotes) throw new StoreError(`${f} has a log (${logs[0]}): delete it with its contents`);
  if (notes.length && !withNotes) throw new StoreError(`${f} is not empty: move or delete what is in it first`);
  const inside = new Set(notes);
  const b = loadBundle(root);
  const backlinks = [...new Set(notes.flatMap((n) => b.backlinks(n)).filter((n) => !inside.has(n)))].sort(cmp);
  for (const rel of markdownFiles(root, f)) unlinkSync(join(root, rel));
  (function prune(d: string): void {
    for (const e of readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) prune(join(d, e.name));
    rmdirSync(d);
  })(dir);
  removeEmptyFolders(root, posixDirname(f));
  return { deleted: f, notes, backlinks };
}

/** Remove `folder` and the folders above it while they hold nothing but a
 *  generated index.md (never the bundle's root). */
function removeEmptyFolders(root: string, folder: string): void {
  let f = folder;
  while (f) {
    const dir = join(root, f);
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    const rest = entries.filter((e) => e !== "index.md");
    if (rest.length) return;
    if (entries.includes("index.md")) unlinkSync(join(dir, "index.md"));
    rmdirSync(dir);
    f = posixDirname(f);
  }
}
