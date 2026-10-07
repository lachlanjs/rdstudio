// Artifacts (T76): found in the knowledge folders with the notes that cite
// them, checked, and prepared for serving with the no-network policy.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { loadBundle } from "@rdstudio/core/node";
import { MAX_BYTES, POLICY, isArtifact, lint, outside, prepared, scan } from "../src/artifacts.ts";

const put = (root: string, rel: string, text: string) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
const note = (body: string) => `---\ntype: Note\ntitle: N\n---\n\n${body}\n`;

test("artifacts are the HTML files in the knowledge folders, with their heads read and the notes that cite them", () => {
  const k = join(mkdtempSync(join(tmpdir(), "rdstudio-artifacts-")), "knowledge");
  put(k, "a/n.md", note('![The orbit](orbit.html) and [again](orbit.html "requires").'));
  put(k, "a/m.md", note("[orbit](/a/orbit.html)"));
  put(k, "a/orbit.html", '<!doctype html><html><head><title>An orbit</title><meta name="description" content="Two bodies."><meta name="rdstudio:date" content="2026-10-07"><meta name="rdstudio:author" content="human:me"><meta name="rdstudio:aspect" content="16 / 9"></head><body><a href="/a/n.md">back</a></body></html>');
  put(k, "b/untitled.html", "<p>hello</p>");
  put(k, "b/_draft.html", "<title>hidden</title>");
  put(k, "b/online.html", '<title>Tiles</title><meta name="rdstudio:network" content="required"><script src="https://cdn.example.com/x.js"></script>');
  const found = scan(k, loadBundle(k));
  expect(found.map((a) => a.path).sort()).toEqual(["a/orbit.html", "b/online.html", "b/untitled.html"]);
  const orbit = found.find((a) => a.path === "a/orbit.html")!;
  expect(orbit).toMatchObject({ directory: "a", title: "An orbit", titled: true, description: "Two bodies.", date: "2026-10-07", author: "human:me", aspect: "16/9", network: false, outside: [] });
  // The notes that cite it, each way; the artifact's own link back to a note is not read.
  expect(orbit.citedBy).toEqual([{ note: "a/m", embed: false, rel: null }, { note: "a/n", embed: true, rel: null }, { note: "a/n", embed: false, rel: "requires" }]);
  expect(found.find((a) => a.path === "b/untitled.html")).toMatchObject({ title: "untitled", titled: false });
  expect(found.find((a) => a.path === "b/online.html")).toMatchObject({ network: true, outside: [] });
  expect([isArtifact("a/x.html"), isArtifact("a/_x.html"), isArtifact(".git/x.html"), isArtifact("a/x.md")]).toEqual([true, false, false, false]);
});

test("the lint: no title, too heavy, an address elsewhere, needing the network, and reports left behind", () => {
  const root = mkdtempSync(join(tmpdir(), "rdstudio-artifacts-")), k = join(root, "knowledge");
  put(k, "n.md", note("x"));
  put(k, "plain.html", "<p>no title</p>");
  put(k, "heavy.html", "<title>Heavy</title>" + "x".repeat(MAX_BYTES + 1));
  put(k, "cdn.html", '<title>CDN</title><script src="https://cdn.example.com/d3.js"></script><link href="//fonts.example.com/a.css" rel="stylesheet"><a href="https://example.com/paper">a paper</a><script>fetch("https://api.example.com/data")</script>');
  put(k, "online.html", '<title>Online</title><meta name="rdstudio:network" content="required">');
  put(root, "reports/old.html", "<title>Old</title>");
  const issues = lint(scan(k, loadBundle(k)), join(root, "reports"), "reports");
  const of = (path: string) => issues.filter((i) => i.path === path).map((i) => i.code);
  expect(of("plain.html")).toEqual(["artifact-title"]);
  expect(of("heavy.html")).toEqual(["artifact-heavy"]);
  expect(of("cdn.html")).toEqual(["artifact-network", "artifact-network", "artifact-network"]); // the script, the stylesheet and the fetch; not the link for a person to follow
  expect(of("online.html")).toEqual(["artifact-online"]);
  expect(of("reports/old.html")).toEqual(["report-left"]);
  expect(outside('<img src="data:image/png;base64,AAAA"><script src="vendor/vega/vega.min.js"></script>')).toEqual([]);
});

test("the copy that is served: the policy and the bridge come first, and vendor/ points at rdstudio's libraries", () => {
  const out = prepared('<!doctype html><html><head><title>T</title><script src="vendor/vega/vega.min.js"></script></head><body></body></html>', "design/deep/fig.html", false);
  expect(out.indexOf("Content-Security-Policy")).toBeGreaterThan(0);
  expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("<title>"));
  expect(out).toContain(POLICY);
  expect(out).toContain('rdstudio:"artifact"');
  expect(out).toContain('src="../../../vendor/vega/vega.min.js"');
  expect(POLICY).toContain("connect-src 'none'");
  // One that says it needs the network keeps the bridge and loses the policy.
  const online = prepared("<title>T</title>", "x.html", true);
  expect(online).not.toContain("Content-Security-Policy");
  expect(online).toContain('rdstudio:"artifact"');
  // No head, no html: still first.
  expect(prepared("<p>hi</p>", "x.html", false).startsWith("<meta http-equiv")).toBe(true);
});

test("made in the app: the reply is read, the file is stamped and written beside the notes, and a preview is held", async () => {
  const { parseFigure } = await import("../src/assist.ts");
  const { artifactPath, keepPreview, preview, saveArtifact, stamped, ArtifactError } = await import("../src/artifacts.ts");
  const { readFileSync } = await import("node:fs");
  const file = "<!doctype html>\n<html><head><title>Inner title</title></head><body><canvas></canvas><script>1</script></body></html>";
  const r = parseFigure(`<title>A wave</title>\n<caption>Move the slider.</caption>\n<artifact>\n${file}\n</artifact>\n<why>\nFrom the passage.\n</why>`);
  expect(r).toEqual({ artifact: { title: "A wave", caption: "Move the slider.", html: file }, why: "From the passage." });
  expect(parseFigure("<artifact>\n```html\n<p>hi</p>\n```\n</artifact>").artifact).toMatchObject({ title: "Figure", html: "<p>hi</p>" });
  expect(parseFigure("I cannot draw that.")).toEqual({ artifact: null, why: "I cannot draw that." });

  expect(stamped(file, "openrouter/a/b", "2026-10-07")).toContain('</title>\n<meta name="rdstudio:date" content="2026-10-07"><meta name="rdstudio:author" content="openrouter/a/b">');
  expect(stamped('<title>T</title><meta name="rdstudio:date" content="2020-01-01"><meta name="rdstudio:author" content="x">', "y", "2026-10-07")).not.toContain("2026");

  const k = join(mkdtempSync(join(tmpdir(), "rdstudio-artifacts-")), "knowledge");
  put(k, "a/n.md", note("x"));
  expect(saveArtifact(k, "a/wave.html", file, { author: "openrouter/a/b" })).toMatchObject({ path: "a/wave.html" });
  expect(readFileSync(join(k, "a/wave.html"), "utf8")).toContain('rdstudio:author" content="openrouter/a/b"');
  expect(() => saveArtifact(k, "a/wave.html", file, { author: "x" })).toThrow(/already there/);
  expect(() => saveArtifact(k, "a/wave.html", file, { author: "x", replace: true })).not.toThrow();
  for (const bad of ["../out.html", "a/n.md", "a/_draft.html", "a/.hidden.html", "a//x.html", ""]) expect(() => artifactPath(k, bad)).toThrow(ArtifactError);
  expect(scan(k, loadBundle(k)).map((a) => a.path)).toEqual(["a/wave.html"]);

  const id = keepPreview("a/deep/new.html", '<title>N</title><script src="vendor/vega/vega.min.js"></script>');
  expect(preview(id)).toContain('src="../../../../vendor/vega/vega.min.js"'); // from p/<id>/a/deep/new.html
  expect(preview(id)).toContain(POLICY);
  expect(preview("nope")).toBeNull();
});
