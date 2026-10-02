import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { ConflictError, editFrontmatter, fileVersion, noteSource, saveNote, splitSource } from "../src/edit.ts";
import { StoreError } from "../src/store.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const fresh = () => mkdtempSync(join(tmpdir(), "rdstudio-edit-"));
const ME = "human:tester";

/** Every note under `dir` (not index.md or log.md), as ids. */
function notes(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (name.startsWith(".")) continue;
    if (statSync(full).isDirectory()) out.push(...notes(full, `${prefix}${name}/`));
    else if (name.endsWith(".md") && name !== "index.md" && name !== "log.md") out.push(prefix + name.slice(0, -3));
  }
  return out;
}

// Real bundles: the fixtures, this repository's, and the test bed when present.
const bundles: [string, string][] = [
  ...readdirSync(join(ROOT, "fixtures/bundles")).map((n) => [n, join(ROOT, "fixtures/bundles", n)] as [string, string]),
  ["rdstudio", join(ROOT, "knowledge")],
];
const dg = process.env.RDSTUDIO_BENCH_DG ?? join(homedir(), "Repositories/differential-geometry/knowledge");
if (existsSync(dg)) bundles.push(["differential-geometry", dg]);

describe.each(bundles)("%s", (_name, src) => {
  const root = fresh();
  cpSync(src, root, { recursive: true });
  const ids = notes(root).filter((id) => {
    try { noteSource(root, id); return true; } catch { return false; } // ids the store refuses (reserved names)
  });

  test("the source splits into exactly the file", () => {
    for (const id of ids) {
      const text = readFileSync(join(root, id + ".md"), "utf8");
      const [prefix, , body] = splitSource(text);
      expect(prefix + body).toBe(text);
      expect(noteSource(root, id).body).toBe(body);
    }
  });

  test("saving unchanged writes nothing", () => {
    for (const id of ids) {
      const before = readFileSync(join(root, id + ".md"), "utf8");
      const src = noteSource(root, id);
      const r = saveNote(root, id, { actor: ME, base: src.version, body: src.body, meta: src.meta });
      expect(r.changed).toBe(false);
      expect(readFileSync(join(root, id + ".md"), "utf8")).toBe(before);
    }
  });

  test("a minor edit changes only its own line", () => {
    for (const id of ids) {
      const file = join(root, id + ".md");
      const before = readFileSync(file, "utf8");
      const src = noteSource(root, id);
      const lines = src.body.split("\n");
      const at = lines.findIndex((l) => /[a-z]{4}/.test(l) && !l.startsWith("```"));
      if (at < 0) continue;
      lines[at] = lines[at]!.replace(/([a-z]{4})/, "$1!"); // punctuation only: a minor edit
      const r = saveNote(root, id, { actor: ME, base: src.version, body: lines.join("\n") });
      expect(r.significant).toBe(false);
      const after = readFileSync(file, "utf8");
      const a = before.split("\n"), b = after.split("\n");
      expect(b.length).toBe(a.length);
      expect(a.filter((l, i) => l !== b[i]).length).toBe(1);
      writeFileSync(file, before); // as it was, for the next test
    }
  });
});

describe("frontmatter edits", () => {
  const raw = [
    "type: Idea # what kind",
    "title: Motivation",
    "tags: [a, b]",
    "generated: { by: \"human:lachlan\", at: 2026-09-11T15:12:00Z }",
    "sources:",
    "  - {resource: x, title: y}",
    "# a closing comment",
    "",
  ].join("\n");

  test("only the changed field's lines change", () => {
    const out = editFrontmatter(raw, { title: "Why rdstudio" });
    expect(out).toBe(raw.replace("title: Motivation", "title: Why rdstudio"));
  });
  test("a block value is replaced whole, and the comment after it stays", () => {
    const out = editFrontmatter(raw, { sources: [{ resource: "z" }] });
    expect(out).toContain("sources:\n- resource: z\n# a closing comment\n");
    expect(out.startsWith("type: Idea # what kind\ntitle: Motivation\n")).toBe(true);
  });
  test("removing a field removes its lines; a new field goes at the end", () => {
    const out = editFrontmatter(raw, { tags: null, status: "draft" });
    expect(out).not.toContain("tags:");
    expect(out.endsWith("# a closing comment\nstatus: draft\n")).toBe(true);
  });
  test("a new type goes first", () => {
    expect(editFrontmatter("title: A\n", { type: "Note" })).toBe("type: Note\ntitle: A\n");
  });
});

describe("saving", () => {
  const setup = () => {
    const root = fresh();
    mkdirSync(join(root, "a"));
    writeFileSync(join(root, "a/n.md"), "---\ntype: Note\ntitle: N\n---\n\n# One\n\nThe metric is smooth.\n");
    return root;
  };

  test("a significant edit stamps who made it", () => {
    const root = setup();
    const src = noteSource(root, "a/n");
    const r = saveNote(root, "a/n", { actor: ME, base: src.version, body: "# One\n\nA completely different account of curvature and its uses.\n" });
    expect(r.significant).toBe(true);
    expect(r.note.meta.generated).toMatchObject({ by: ME });
    expect(readFileSync(join(root, "a/n.md"), "utf8")).toMatch(/^---\ntype: Note\ntitle: N\ngenerated: \{by: "?human:tester"?, at: .*\}\n---\n\n# One\n/);
  });

  test("a changed title is significant; the body is left alone", () => {
    const root = setup();
    const src = noteSource(root, "a/n");
    const r = saveNote(root, "a/n", { actor: ME, base: src.version, meta: { title: "Renamed" } });
    expect(r.significant).toBe(true);
    expect(r.note.body).toBe(src.body);
    expect(r.note.meta.title).toBe("Renamed");
  });

  test("a stale version is refused, with the file as it is now", () => {
    const root = setup();
    const src = noteSource(root, "a/n");
    writeFileSync(join(root, "a/n.md"), readFileSync(join(root, "a/n.md"), "utf8") + "\nAn agent's addition.\n");
    let err: unknown;
    try { saveNote(root, "a/n", { actor: ME, base: src.version, body: "mine" }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).current?.body).toContain("An agent's addition.");
    expect(readFileSync(join(root, "a/n.md"), "utf8")).toContain("An agent's addition."); // not overwritten
  });

  test("a deleted note is a conflict too", () => {
    const root = setup();
    expect(() => saveNote(root, "a/gone", { actor: ME, base: "0123456789abcdef", body: "x" })).toThrow(ConflictError);
  });

  test("creating a note, and refusing to create one that exists", () => {
    const root = setup();
    const r = saveNote(root, "philosophy/motivation", { actor: ME, base: null, meta: { type: "Idea", title: "Motivation" }, body: "Why.\n" });
    expect(r.created).toBe(true);
    const text = readFileSync(join(root, "philosophy/motivation.md"), "utf8");
    expect(text).toMatch(/^---\ntype: Idea\ntitle: Motivation\ngenerated: .*\n---\n\nWhy\.\n$/);
    expect(r.note.version).toBe(fileVersion(text));
    expect(() => saveNote(root, "philosophy/motivation", { actor: ME, base: null, meta: { type: "Idea" } })).toThrow(ConflictError);
    expect(() => saveNote(root, "x", { actor: ME, base: null, meta: { title: "No type" } })).toThrow(StoreError);
  });

  test("ids outside the bundle are refused", () => {
    const root = setup();
    for (const bad of ["../x", "a/../../x", "a/index", "-x"]) {
      expect(() => saveNote(root, bad, { actor: ME, base: null, meta: { type: "Note" } })).toThrow(StoreError);
    }
  });
});
