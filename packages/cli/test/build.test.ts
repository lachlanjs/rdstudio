import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";

const fresh = () => mkdtempSync(join(tmpdir(), "rdstudio-build-"));
const put = (root: string, rel: string, text: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

test("a build removes dashboard files it no longer has, and only those", async () => {
  const web = fresh();
  put(web, "sw.js", 'const SHELL = "__SHELL__";\n');
  put(web, "index.html", "<html></html>");
  put(web, "_app/immutable/new.js", "new");
  process.env.RDSTUDIO_WEB_DIR = web; // read when build.ts loads
  const { build } = await import("../src/build.ts");
  const { loadConfig } = await import("../src/config.ts");

  const root = fresh();
  put(root, "rdstudio.toml", 'title = "P"\n');
  put(root, "knowledge/a.md", "---\ntype: Note\ntitle: A\n---\n\nBody.\n");
  const cfg = loadConfig(root);
  for (const rel of ["_app/immutable/old.js", "js/map.js", "app.js", "style.css", "notes.txt"]) put(cfg.siteDir, rel, "stale");
  const site = build(cfg);
  const has = (rel: string) => existsSync(join(site, rel));
  expect(has("_app/immutable/new.js") && has("index.html")).toBe(true);
  expect(has("_app/immutable/old.js")).toBe(false); // an earlier build's script
  expect(has("js") || has("app.js") || has("style.css")).toBe(false); // the old dashboard
  expect(has("notes.txt")).toBe(true); // not the dashboard's, so left alone
  expect(has("data/site.json") && has("sw.js")).toBe(true);
});
