// Build the dashboard: the web app plus the bundle's data as JSON, written so
// that it is byte for byte what the Python build writes (src/rdstudio/build.py).

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Bundle, cmp, contentHash, headings, iso, splitFrontmatter, text, type Concept } from "@rdstudio/core";
import { loadBundle, writeIndexes } from "@rdstudio/core/node";
import { categoryGlobs, type Config } from "./config.ts";
import { syncTree, walkFiles, writeIfChanged } from "./files.ts";
import { history } from "./gitlog.ts";
import { scan } from "./reports.ts";

/** The dashboard's files: the Python package's web folder until the Svelte app replaces it (T38). */
export const WEB_DIR = process.env.RDSTUDIO_WEB_DIR
  ?? fileURLToPath(new URL("../../../src/rdstudio/web/", import.meta.url));

/** JSON as the Python build writes it: compact, not ASCII-escaped. */
export const dump = (value: unknown): string => JSON.stringify(value);

/** The service worker, stamped with a fingerprint of the app's files. */
export function serviceWorker(): string {
  const digest = createHash("sha256");
  for (const rel of walkFiles(WEB_DIR)) {
    const st = statSync(join(WEB_DIR, rel), { bigint: true });
    digest.update(`${rel}:${st.size}:${st.mtimeNs}\n`);
  }
  return readFileSync(join(WEB_DIR, "sw.js"), "utf8").replaceAll("__SHELL__", digest.digest("hex").slice(0, 16));
}

const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v ?? null));

function summary(c: Concept) {
  return {
    id: c.id, path: c.path, title: c.title, type: c.type, description: c.description, tags: c.tags,
    status: c.status, trust: c.trust, verification_stale: c.verificationStale, content_stale: c.contentStale(),
  };
}

export function conceptRecord(b: Bundle, cid: string): Record<string, unknown> {
  const c = b.concepts.get(cid)!;
  const place = b.prerequisiteOrder().get(cid)!;
  const generated = c.generatedAt;
  return {
    ...summary(c),
    hash: contentHash(c.body),
    order: place.order,
    depth: place.depth,
    requires: b.requiresGraph().get(cid),
    meta: json(c.meta),
    directory: c.directory,
    links: c.links.map((l) => ({ target: l.target, kind: l.kind, broken: l.broken, rel: l.rel })),
    backlinks: b.backlinks(cid),
    headings: headings(c.body).map((h) => ({ level: h.level, text: h.text, slug: h.slug })),
    generated_at: generated === null ? null : iso(generated),
    mtime: Math.floor(c.mtime / 1000),
  };
}

export function treeRecord(b: Bundle): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [did, d] of b.directories) {
    const title = (id: string) => b.concepts.get(id)!.title.toLowerCase();
    out[did] = {
      id: did,
      name: d.name,
      concepts: [...d.concepts].sort((a, c) => cmp(title(a), title(c))),
      children: [...d.children].sort(cmp),
      overview: b.overviewFor(did)?.id ?? null,
      index: b.renderIndex(did),
    };
  }
  return out;
}

/** Skills (.claude/skills/<name>/SKILL.md) and agents (.claude/agents/*.md),
 *  from the project and, unless `user` is false, from ~/.claude. */
export function skillFiles(root: string, user = true): { skills: Record<string, unknown>[]; agents: Record<string, unknown>[] } {
  const out = { skills: [] as Record<string, unknown>[], agents: [] as Record<string, unknown>[] };
  const find = (base: string, kind: "skills" | "agents") => walkFiles(join(base, ".claude", kind))
    // As Python's glob("*/SKILL.md") and glob("*.md"): names starting with "." do not match.
    .filter((p) => (kind === "skills" ? /^[^/.][^/]*\/SKILL\.md$/.test(p) : /^[^/.][^/]*\.md$/.test(p)));
  const specs: ["skills" | "agents", "project" | "user", string][] = [["skills", "project", root], ["agents", "project", root]];
  if (user) specs.push(["skills", "user", homedir()], ["agents", "user", homedir()]);
  for (const [kind, scope, base] of specs) {
    for (const rel of find(base, kind)) {
      const source = readFileSync(join(base, ".claude", kind, rel), "utf8").replace(/\r\n?/g, "\n");
      let meta: Record<string, unknown> | null, body: string;
      try { [meta, body] = splitFrontmatter(source); } catch { [meta, body] = [{}, source]; }
      meta ??= {};
      const fallback = kind === "skills" ? rel.split("/")[0]! : rel.replace(/\.md$/, "");
      out[kind].push({
        name: text(meta.name || fallback),
        description: text(meta.description || ""),
        path: (scope === "user" ? "~/" : "") + `.claude/${kind}/${rel}`,
        scope,
        meta: json(meta),
        body,
      });
    }
  }
  return out;
}

export interface BuildOptions {
  writeIndexes?: boolean;
  export?: boolean;
  site?: string;
}

/** Build the dashboard into `site` (default .rdstudio/site). `export` makes a
 *  snapshot for static hosting: no user-level skills, no uncommitted changes,
 *  and the page does not poll for updates. */
export function build(cfg: Config, opts: BuildOptions = {}): string {
  const site = opts.site ?? cfg.siteDir;
  const data = join(site, "data");
  mkdirSync(site, { recursive: true });
  syncTree(WEB_DIR, site, new Set(["sw.js"]));
  writeIfChanged(join(site, "sw.js"), serviceWorker());

  const index = cfg.raw.index as Record<string, unknown> | undefined;
  const autoIndex = opts.writeIndexes ?? (index?.auto ?? true) !== false;
  let b = loadBundle(cfg.knowledgeDir);
  if (autoIndex && existsSync(cfg.knowledgeDir) && writeIndexes(b, cfg.knowledgeDir).length) b = loadBundle(cfg.knowledgeDir);

  const concepts = [...b.concepts.keys()].sort(cmp).map((cid) => conceptRecord(b, cid));
  const changes = history(cfg.root, categoryGlobs(cfg), 200, [cfg.output.replace(/^\/+|\/+$/g, "") + "/"]) as { commits: { pending?: boolean }[] };
  if (opts.export) changes.commits = changes.commits.filter((c) => !c.pending);
  const reports = scan(cfg.reportsDir, cfg.knowledge, cfg.reports);
  const skills = skillFiles(cfg.root, !opts.export);
  const issues = b.lint().map((i) => ({ path: i.path, level: i.level, code: i.code, message: i.message }));

  const payload: Record<string, string> = {
    "concepts.json": dump(concepts),
    "tree.json": dump(treeRecord(b)),
    "changes.json": dump(changes),
    "reports.json": dump(reports),
    "skills.json": dump(skills),
  };
  payload["site.json"] = dump({
    title: cfg.title,
    knowledge: cfg.knowledge,
    reports: cfg.reports,
    human: cfg.human,
    okf_version: b.rootMeta.okf_version ?? null,
    static: Boolean(opts.export),
    map: cfg.raw.map ?? {}, // project defaults for the Map tab ([map] in rdstudio.toml)
    issues,
    counts: { concepts: concepts.length, reports: reports.length, skills: skills.skills.length, agents: skills.agents.length },
  });

  const bodies = new Map([...b.concepts].map(([cid, c]) => [`k/${cid}.md`, c.body]));
  const digest = createHash("sha256");
  for (const name of Object.keys(payload).sort(cmp)) digest.update(payload[name]!);
  for (const name of [...bodies.keys()].sort(cmp)) digest.update(name + bodies.get(name)!);
  const version = digest.digest("hex").slice(0, 16);

  for (const [rel, body] of bodies) writeIfChanged(join(data, rel), body);
  // Non-Markdown bundle files (images, data) are served beside the bodies.
  for (const rel of walkFiles(cfg.knowledgeDir)) {
    if (rel.endsWith(".md") || rel.split("/").some((p) => p.startsWith("."))) continue;
    const from = join(cfg.knowledgeDir, rel), to = join(data, "k", rel);
    if (!existsSync(to) || statSync(to).mtimeMs < statSync(from).mtimeMs) {
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(from, to);
      const st = statSync(from);
      utimesSync(to, st.atime, st.mtime);
    }
  }
  for (const rel of walkFiles(join(data, "k"))) {
    if (rel.endsWith(".md") && !bodies.has(`k/${rel}`)) unlinkSync(join(data, "k", rel));
  }

  // Reports are served beside the app so relative media keeps working.
  if (existsSync(cfg.reportsDir)) syncTree(cfg.reportsDir, join(site, "reports"));

  for (const [name, content] of Object.entries(payload)) writeIfChanged(join(data, name), content);
  // Installable as an app (add to home screen), opening full screen.
  writeIfChanged(join(site, "manifest.webmanifest"), dump({
    name: cfg.title, short_name: [...cfg.title].slice(0, 24).join(""), start_url: "./", scope: "./",
    display: "fullscreen", display_override: ["fullscreen", "standalone"],
    background_color: "#141a20", theme_color: "#141a20",
    icons: [192, 512].map((n) => ({ src: `icon-${n}.png`, sizes: `${n}x${n}`, type: "image/png", purpose: "any maskable" })),
  }));
  const vfile = join(data, "version.json");
  let old: unknown = null;
  try { old = (JSON.parse(readFileSync(vfile, "utf8")) as { version?: unknown }).version; } catch { /* none yet */ }
  if (old !== version) writeFileSync(vfile, dump({ version, built: iso(Date.now()) }), "utf8");
  return site;
}
