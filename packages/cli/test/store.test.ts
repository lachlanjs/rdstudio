import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { splitFrontmatter } from "@rdstudio/core";
import { expect, test } from "vitest";
import { StoreError, conceptPath, record, replaceSection, verify } from "../src/store.ts";

const fresh = () => mkdtempSync(join(tmpdir(), "rdstudio-store-"));

test("ids stay inside the bundle and off reserved names", () => {
  const root = fresh();
  expect(conceptPath(root, "/a/b.md")).toBe(join(root, "a/b.md"));
  for (const bad of ["../x", "a/../../x", "-x", "a/index", "log"]) expect(() => conceptPath(root, bad)).toThrow(StoreError);
});

test("create, then a minor edit leaves provenance alone and a significant one stamps it", () => {
  const root = fresh();
  expect(record(root, "a", { actor: "agent/x", meta: { title: "A", type: "Idea" }, body: "# One\n\nThe metric is smooth." }))
    .toMatchObject({ id: "a", created: true, significant: true, decided_by: "new" });
  const first = readFileSync(join(root, "a.md"), "utf8");
  expect(first.startsWith("---\ntype: Idea\ntitle: A\n")).toBe(true); // type first
  expect(record(root, "a", { actor: "agent/y", body: "# One\n\nThe metric is smooth!", significant: null }))
    .toMatchObject({ significant: false, decided_by: "rules" });
  const [meta] = splitFrontmatter(readFileSync(join(root, "a.md"), "utf8"));
  expect((meta!.generated as Record<string, string>).by).toBe("agent/x");
  expect(record(root, "a", { actor: "agent/y", meta: { title: "A renamed" }, significant: null })).toMatchObject({ significant: true, decided_by: "rules" });
  expect(() => record(root, "a", { actor: "agent/y", meta: { type: null } })).toThrow("non-empty 'type'");
});

test("editing frontmatter keeps comments and the formatting of other keys", () => {
  const root = fresh();
  writeFileSync(join(root, "c.md"), "---\n# a comment\ntype: Concept\ntitle: 'Quoted title'\nverified: { by: human:a, at: 2026-01-01 }\n---\n\nBody.\n");
  record(root, "c", { actor: "agent/x", meta: { tags: ["t"] }, significant: false });
  verify(root, "c", "human:b");
  const text = readFileSync(join(root, "c.md"), "utf8");
  expect(text).toContain("# a comment\n");
  expect(text).toContain("title: 'Quoted title'\n");
  expect(text).toContain("tags: [t]\n");
  const [meta] = splitFrontmatter(text);
  expect((meta!.verified as { by: string }[]).map((e) => e.by)).toEqual(["human:a", "human:b"]);
});

test("sections are replaced up to the next heading of the same level, or appended", () => {
  const body = "# A\n\none\n\n## A.1\n\ntwo\n\n# B\n\nthree\n";
  expect(replaceSection(body, "A", "new")).toBe("# A\n\nnew\n\n# B\n\nthree\n");
  expect(replaceSection(body, "## a.1", "x")).toBe("# A\n\none\n\n## A.1\n\nx\n\n# B\n\nthree\n");
  expect(replaceSection(body, "C", "four")).toBe("# A\n\none\n\n## A.1\n\ntwo\n\n# B\n\nthree\n\n# C\n\nfour\n");
  mkdirSync(join(fresh(), "x"));
});
