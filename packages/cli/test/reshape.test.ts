import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { loadBundle } from "@rdstudio/core/node";
import { ConflictError, noteSource } from "../src/edit.ts";
import { deleteFolder, deleteNote, linkTargets, moveFolder, moveNote, rewriteLinks } from "../src/reshape.ts";
import { StoreError } from "../src/store.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const fresh = () => mkdtempSync(join(tmpdir(), "rdstudio-reshape-"));

function files(dir: string, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) for (const [k, v] of files(full, `${prefix}${name}/`)) out.set(k, v);
    else if (name.endsWith(".md")) out.set(prefix + name, readFileSync(full, "utf8"));
  }
  return out;
}

/** Every concept link as "from -> to", and the broken ones. */
function links(root: string) {
  const b = loadBundle(root);
  const all: string[] = [], broken: string[] = [];
  for (const [id, c] of b.concepts) for (const l of c.links) (l.broken ? broken : all).push(`${id} -> ${l.target}`);
  return { all: all.sort(), broken: broken.sort(), b };
}

const bundles: [string, string][] = [
  ...readdirSync(join(ROOT, "fixtures/bundles")).map((n) => [n, join(ROOT, "fixtures/bundles", n)] as [string, string]),
  ["rdstudio", join(ROOT, "knowledge")],
];
const dg = join(process.env.RDSTUDIO_BENCH_DG ?? join(homedir(), "Repositories/differential-geometry"), "knowledge");
if (existsSync(dg)) bundles.push(["differential-geometry", dg]);

describe.each(bundles)("%s", (_name, src) => {
  test("moving the most linked-to note keeps every link working", () => {
    const root = fresh();
    cpSync(src, root, { recursive: true });
    const before = links(root);
    const counts = new Map<string, number>();
    for (const c of before.b.concepts.values()) for (const l of c.links) if (!l.broken && l.kind === "concept") counts.set(l.target, (counts.get(l.target) ?? 0) + 1);
    const [target] = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] ?? [];
    if (!target) return;
    const filesBefore = files(root);
    const to = `moved-here/deeper/${target.split("/").pop()}`;
    const r = moveNote(root, target, to);
    expect(r.moved).toEqual([{ from: target, to }]);
    const after = links(root);
    const rename = (s: string) => s.split(" -> ").map((x) => (x === target ? to : x)).join(" -> ");
    expect(after.all).toEqual(before.all.map(rename).sort());
    expect(after.broken).toEqual(before.broken.map(rename).sort());
    // Files that did not link to it, and were not it, are byte for byte the same.
    const filesAfter = files(root);
    for (const [rel, text] of filesBefore) {
      if (rel === `${target}.md` || rel.endsWith("index.md") || r.rewritten.includes(rel)) continue;
      expect(filesAfter.get(rel), rel).toBe(text);
    }
    // Rewritten files changed only in link targets: the same number of lines.
    for (const rel of r.rewritten) {
      const was = filesBefore.get(rel) ?? filesBefore.get(`${target}.md`)!;
      expect(filesAfter.get(rel)!.split("\n").length, rel).toBe(was.split("\n").length);
    }
  });

  test("moving a folder keeps every link working", () => {
    const root = fresh();
    cpSync(src, root, { recursive: true });
    const before = links(root);
    const folder = [...before.b.directories.keys()].filter((d) => d && !d.includes("/")).sort()[0];
    if (!folder) return;
    const to = `renamed/${folder}-x`;
    moveFolder(root, folder, to);
    const after = links(root);
    const rename = (s: string) => s.split(" -> ").map((x) => (x === folder + "/" ? to + "/" : x.startsWith(folder + "/") ? to + x.slice(folder.length) : x)).join(" -> ");
    expect(after.all).toEqual(before.all.map(rename).sort());
    expect(after.broken).toEqual(before.broken.map(rename).sort());
  });
});

describe("rewriting links", () => {
  const move = (p: string) => (p === "a/n.md" ? "b/c/n.md" : null);
  test("absolute links stay absolute, relative ones are recomputed, anchors and titles kept", () => {
    const body = [
      "See [n](/a/n.md \"requires\") and [rel](n.md#h-one) and [up](../a/n.md).",
      "[ref]: /a/n.md",
      "<https://x.org/a/n.md> [web](https://x.org/a/n.md) [other](/a/m.md)",
      "`[code](/a/n.md)`",
      "```",
      "[fenced](/a/n.md)",
      "```",
    ].join("\n");
    const out = rewriteLinks(body, "a", "a", move);
    expect(out.split("\n")).toEqual([
      "See [n](/b/c/n.md \"requires\") and [rel](../b/c/n.md#h-one) and [up](../b/c/n.md).",
      "[ref]: /b/c/n.md",
      "<https://x.org/a/n.md> [web](https://x.org/a/n.md) [other](/a/m.md)",
      "`[code](/a/n.md)`",
      "```",
      "[fenced](/a/n.md)",
      "```",
    ]);
  });
  test("a moved note's own relative links follow it", () => {
    expect(rewriteLinks("[m](m.md) [abs](/a/m.md)", "a", "b/c", () => null)).toBe("[m](../../a/m.md) [abs](/a/m.md)");
  });
  test("angle-bracketed targets and encoded spaces", () => {
    const m = (p: string) => (p === "a/my note.md" ? "b/my note.md" : null);
    expect(rewriteLinks("[x](<my note.md>) [y](my%20note.md)", "a", "a", m)).toBe("[x](<../b/my%20note.md>) [y](../b/my%20note.md)");
  });
  test("finds targets outside code only", () => {
    expect(linkTargets("`[a](x.md)` [b](y.md)").map((f) => f.raw)).toEqual(["y.md"]);
  });
});

describe("moving and deleting", () => {
  const setup = () => {
    const root = fresh();
    mkdirSync(join(root, "a"));
    writeFileSync(join(root, "a/n.md"), "---\ntype: Note\ntitle: N\n---\n\nLinks to [m](m.md).\n");
    writeFileSync(join(root, "a/m.md"), "---\ntype: Note\ntitle: M\n---\n\nBack to [n](/a/n.md).\n");
    writeFileSync(join(root, "a/index.md"), "# a\n");
    return root;
  };

  test("renaming in place, and refusing to overwrite", () => {
    const root = setup();
    moveNote(root, "a/n", "a/renamed");
    expect(readFileSync(join(root, "a/m.md"), "utf8")).toContain("[n](/a/renamed.md)");
    expect(readFileSync(join(root, "a/renamed.md"), "utf8")).toContain("[m](m.md)"); // same folder: unchanged
    expect(() => moveNote(root, "a/renamed", "a/m")).toThrow(StoreError);
  });

  test("a stale version refuses the move", () => {
    const root = setup();
    const v = noteSource(root, "a/n").version;
    writeFileSync(join(root, "a/n.md"), readFileSync(join(root, "a/n.md"), "utf8") + "more\n");
    expect(() => moveNote(root, "a/n", "b/n", v)).toThrow(ConflictError);
    expect(existsSync(join(root, "a/n.md"))).toBe(true);
  });

  test("moving the last notes out of a folder removes it, and its index", () => {
    const root = setup();
    moveNote(root, "a/n", "b/n");
    moveNote(root, "a/m", "b/m");
    expect(existsSync(join(root, "a"))).toBe(false);
    expect(readFileSync(join(root, "b/n.md"), "utf8")).toContain("[m](m.md)");
    expect(readFileSync(join(root, "b/m.md"), "utf8")).toContain("[n](/b/n.md)");
  });

  test("a folder cannot move into itself or over another", () => {
    const root = setup();
    expect(() => moveFolder(root, "a", "a/b")).toThrow(StoreError);
    mkdirSync(join(root, "c"));
    expect(() => moveFolder(root, "a", "c")).toThrow(StoreError);
    expect(() => moveFolder(root, "../x", "y")).toThrow(StoreError);
  });

  test("deleting a note reports what linked to it; deleting folders only when empty", () => {
    const root = setup();
    expect(deleteNote(root, "a/n")).toEqual({ deleted: "a/n", backlinks: ["a/m"] });
    expect(existsSync(join(root, "a/n.md"))).toBe(false);
    expect(() => deleteFolder(root, "a")).toThrow(/not empty/);
    deleteNote(root, "a/m");
    expect(existsSync(join(root, "a"))).toBe(false); // emptied: removed with its index
    mkdirSync(join(root, "empty"));
    writeFileSync(join(root, "empty/index.md"), "# empty\n");
    expect(deleteFolder(root, "empty")).toEqual({ deleted: "empty", notes: [], backlinks: [] });
    expect(existsSync(join(root, "empty"))).toBe(false);
  });

  test("deleting a folder with its notes: only when asked, never with other files", () => {
    const root = setup();
    mkdirSync(join(root, "b/c"), { recursive: true });
    writeFileSync(join(root, "b/overview.md"), "---\ntype: Overview\ntitle: B\n---\n");
    writeFileSync(join(root, "b/c/deep.md"), "---\ntype: Note\ntitle: D\n---\n\nTo [n](/a/n.md).\n");
    writeFileSync(join(root, "a/m.md"), "---\ntype: Note\ntitle: M\n---\n\nTo [deep](/b/c/deep.md).\n");
    expect(() => deleteFolder(root, "b")).toThrow(/not empty/);
    expect(deleteFolder(root, "b", true)).toEqual({ deleted: "b", notes: ["b/c/deep", "b/overview"], backlinks: ["a/m"] });
    expect(existsSync(join(root, "b"))).toBe(false);
    mkdirSync(join(root, "pics"));
    writeFileSync(join(root, "pics/overview.md"), "---\ntype: Overview\ntitle: P\n---\n");
    writeFileSync(join(root, "pics/fig.png"), "png");
    expect(() => deleteFolder(root, "pics", true)).toThrow(/other than notes/);
    expect(existsSync(join(root, "pics/fig.png"))).toBe(true);
  });
});
