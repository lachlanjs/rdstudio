// A note's history since a time (catching up, T29): the commits after it, and
// the note then against the note now, across a rename and uncommitted edits.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { historySince } from "../src/gitlog.ts";

function repo() {
  const root = mkdtempSync(join(tmpdir(), "rdstudio-history-"));
  const git = (date: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], {
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_AUTHOR_NAME: "A", GIT_AUTHOR_EMAIL: "a@x", GIT_COMMITTER_NAME: "A", GIT_COMMITTER_EMAIL: "a@x" },
    stdio: "ignore",
  });
  git("2026-01-01T00:00:00Z", "init", "-q");
  mkdirSync(join(root, "knowledge"));
  return { root, git };
}

test("commits since a time, and the note then against now", () => {
  const { root, git } = repo();
  const note = join(root, "knowledge", "a.md");
  writeFileSync(note, "# A\n\nOne.\n");
  git("2026-01-01T00:00:00Z", "add", "-A"); git("2026-01-01T00:00:00Z", "commit", "-qm", "First");
  writeFileSync(note, "# A\n\nOne, and two.\n");
  git("2026-02-01T00:00:00Z", "commit", "-qam", "Second");
  writeFileSync(note, "# A\n\nOne, and two.\n\nThree.\n"); // not committed
  const h = historySince(root, "knowledge/a.md", "2026-01-15T00:00:00Z");
  expect(h.available && h.existed).toBe(true);
  expect(h.commits.map((c) => c.subject)).toEqual(["Second"]);
  expect(h.diff).toContain("-One.");
  expect(h.diff).toContain("+One, and two.");
  expect(h.diff).toContain("+Three.");
  expect(historySince(root, "knowledge/a.md", "2025-12-01T00:00:00Z")).toMatchObject({ existed: false, diff: null });
});

test("a note renamed since is followed back", () => {
  const { root, git } = repo();
  writeFileSync(join(root, "knowledge", "old.md"), "# Old\n\nText that stays the same for the rename to be found.\nMore lines.\nAnd more.\n");
  git("2026-01-01T00:00:00Z", "add", "-A"); git("2026-01-01T00:00:00Z", "commit", "-qm", "First");
  renameSync(join(root, "knowledge", "old.md"), join(root, "knowledge", "new.md"));
  writeFileSync(join(root, "knowledge", "new.md"), "# New\n\nText that stays the same for the rename to be found.\nMore lines.\nAnd more.\n");
  git("2026-02-01T00:00:00Z", "add", "-A"); git("2026-02-01T00:00:00Z", "commit", "-qm", "Rename");
  const h = historySince(root, "knowledge/new.md", "2026-01-15T00:00:00Z");
  expect(h.existed).toBe(true);
  expect(h.commits.map((c) => c.subject)).toEqual(["Rename"]);
  expect(h.diff).toContain("-# Old");
  expect(h.diff).toContain("+# New");
});

test("outside git there is no history", () => {
  expect(historySince(mkdtempSync(join(tmpdir(), "rdstudio-nogit-")), "a.md", "2026-01-01T00:00:00Z").available).toBe(false);
});
