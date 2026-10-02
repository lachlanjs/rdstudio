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

test("an agent's write changes only the lines of what it changed", () => {
  const root = fresh();
  const head = "---\ntype: Concept\ntitle: \"Stokes\"   # trailing comment\ndescription: >-\n  Folded\n  text.\ntags:\n  - a\n  - b\ngenerated: { by: human:x, at: 2026-01-01T00:00:00Z }\n---\n\n";
  writeFileSync(join(root, "s.md"), head + "# One\n\nBody.\n");
  // A minor body edit leaves the frontmatter byte for byte.
  record(root, "s", { actor: "agent/x", body: "# One\n\nBody, edited.", significant: false });
  expect(readFileSync(join(root, "s.md"), "utf8")).toBe(head + "# One\n\nBody, edited.\n");
  // A significant one rewrites `generated` alone.
  record(root, "s", { actor: "agent/x", section: "One", body: "New.", significant: true });
  const text = readFileSync(join(root, "s.md"), "utf8");
  expect(text.split("generated:")[0]).toBe(head.split("generated:")[0]);
  expect(text).toMatch(/generated: \{ ?by: agent\/x, at: [^}]+\}\n---\n\n# One\n\nNew.\n$/);
  // Nothing to change, nothing written.
  const same = readFileSync(join(root, "s.md"), "utf8");
  record(root, "s", { actor: "agent/x", meta: { title: "Stokes" }, significant: false });
  expect(readFileSync(join(root, "s.md"), "utf8")).toBe(same);
});

test("CRLF notes stay CRLF", () => {
  const root = fresh();
  writeFileSync(join(root, "w.md"), "---\r\ntype: Concept\r\ntitle: W\r\n---\r\n\r\nBody.\r\n");
  record(root, "w", { actor: "agent/x", meta: { tags: ["t"] }, body: "Body two.", significant: false });
  expect(readFileSync(join(root, "w.md"), "utf8")).toBe("---\r\ntype: Concept\r\ntitle: W\r\ntags: [t]\r\n---\r\n\r\nBody two.\r\n");
});
