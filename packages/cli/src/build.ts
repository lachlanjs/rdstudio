// Build the dashboard: the web app plus the bundle's data as JSON, written in
// the form the first, Python, build wrote (removed in T102).

import { codeIndexSync } from "./code.ts";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Bundle, cmp, contentHash, headings, iso, splitFrontmatter, text,
  type Changes, type Concept, type ConceptRecord, type FolderRecord, type SiteInfo, type Skills,
} from "@rdstudio/core";
import { loadBundle, writeIndexes } from "@rdstudio/core/node";
import { categoryGlobs, type Config } from "./config.ts";
import { assetDir, pruneOwned, syncTree, walkFiles, writeIfChanged } from "./files.ts";
import { history } from "./gitlog.ts";
import { isArtifact, prepared, scan } from "./artifacts.ts";

/** The built dashboard: beside a bundled release, or where the Svelte app builds
 *  it when running from source (npm run build --workspace @rdstudio/app). */
export const WEB_DIR = assetDir("web", "RDSTUDIO_WEB_DIR", fileURLToPath(new URL("../../../src/rdstudio/web/", import.meta.url)));

/** Top-level names the old dashboard wrote that the Svelte one does not. */
const FORMER_DASHBOARD = ["app.js", "js", "style.css", "style-tokens.css"];

/** Remove dashboard files from `site` that the current dashboard does not have:
 *  an earlier build's hashed scripts, or the old dashboard. Only names the
 *  dashboard owns are touched, so other files in an export folder stay. */
function pruneDashboard(site: string): void {
  const owned = new Set([...readdirSync(WEB_DIR), ...FORMER_DASHBOARD]);
  owned.delete("sw.js");
  pruneOwned(site, owned, new Set(walkFiles(WEB_DIR)));
}

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

export function conceptRecord(b: Bundle, cid: string): ConceptRecord {
  const c = b.concepts.get(cid)!;
  const place = b.prerequisiteOrder().get(cid)!;
  const generated = c.generatedAt;
  return {
    ...summary(c),
    hash: contentHash(c.body),
    order: place.order,
    depth: place.depth,
    requires: b.requiresGraph().get(cid) ?? [],
    meta: json(c.meta) as Record<string, unknown>,
    directory: c.directory,
    links: c.links.map((l) => ({ target: l.target, kind: l.kind, broken: l.broken, rel: l.rel })),
    cites: c.cites.map((x) => ({ ...x })),
    backlinks: b.backlinks(cid),
    headings: headings(c.body).map((h) => ({ level: h.level, text: h.text, slug: h.slug })),
    generated_at: generated === null ? null : iso(generated),
    mtime: Math.floor(c.mtime / 1000),
  };
}

export function treeRecord(b: Bundle): Record<string, FolderRecord> {
  const out: Record<string, FolderRecord> = {};
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
export function skillFiles(root: string, user = true): Skills {
  const out: Skills = { skills: [], agents: [] };
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
        meta: json(meta) as Record<string, unknown>,
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
  if (!existsSync(join(WEB_DIR, "index.html"))) {
    throw new Error(`the dashboard is not built (no ${join(WEB_DIR, "index.html")}): run npm run build --workspace @rdstudio/app`);
  }
  mkdirSync(site, { recursive: true });
  pruneDashboard(site);
  syncTree(WEB_DIR, site, new Set(["sw.js"]));
  writeIfChanged(join(site, "sw.js"), serviceWorker());

  const index = cfg.raw.index as Record<string, unknown> | undefined;
  const autoIndex = opts.writeIndexes ?? (index?.auto ?? true) !== false;
  let b = loadBundle(cfg.knowledgeDir);
  if (autoIndex && existsSync(cfg.knowledgeDir) && writeIndexes(b, cfg.knowledgeDir).length) b = loadBundle(cfg.knowledgeDir);

  const concepts = [...b.concepts.keys()].sort(cmp).map((cid) => conceptRecord(b, cid));
  const changes = history(cfg.root, categoryGlobs(cfg), 200, [cfg.output.replace(/^\/+|\/+$/g, "") + "/"]) as unknown as Changes;
  if (opts.export) changes.commits = changes.commits.filter((c) => !c.pending);
  const artifacts = scan(cfg.knowledgeDir, b);
  const skills = skillFiles(cfg.root, !opts.export);
  const issues = b.lint().map((i) => ({ path: i.path, level: i.level, code: i.code, message: i.message }));

  const payload: Record<string, string> = {
    "concepts.json": dump(concepts),
    "tree.json": dump(treeRecord(b)),
    "changes.json": dump(changes),
    "artifacts.json": dump(artifacts),
    "skills.json": dump(skills),
  };
  // The code map (T66), when the project's code is mapped.
  const code = codeIndexSync(cfg);
  if (code) payload["code.json"] = dump(code);
  else if (existsSync(join(data, "code.json"))) unlinkSync(join(data, "code.json"));
  const info: SiteInfo = {
    title: cfg.title,
    knowledge: cfg.knowledge,
    human: cfg.human,
    okf_version: (b.rootMeta.okf_version as string | undefined) ?? null,
    static: Boolean(opts.export),
    map: (cfg.raw.map as Record<string, unknown> | undefined) ?? {}, // project defaults for the Map tab ([map] in rdstudio.toml)
    issues,
    counts: { concepts: concepts.length, artifacts: artifacts.length, skills: skills.skills.length, agents: skills.agents.length, ...(code ? { code: code.items.length } : {}) },
  };
  payload["site.json"] = dump(info);

  const bodies = new Map([...b.concepts].map(([cid, c]) => [`k/${cid}.md`, c.body]));
  const digest = createHash("sha256");
  for (const name of Object.keys(payload).sort(cmp)) digest.update(payload[name]!);
  for (const name of [...bodies.keys()].sort(cmp)) digest.update(name + bodies.get(name)!);
  const version = digest.digest("hex").slice(0, 16);

  for (const [rel, body] of bodies) writeIfChanged(join(data, rel), body);
  // Non-Markdown bundle files (images, data) are served beside the bodies.
  for (const rel of walkFiles(cfg.knowledgeDir)) {
    if (rel.endsWith(".md") || rel.split("/").some((p) => p.startsWith("."))) continue;
    if (isArtifact(rel)) continue; // an artifact is served from a/, prepared (below), never as it is written
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

  // Artifacts (T76) are served from a/, each with the policy that keeps it offline and the bridge to the page
  // that frames it (artifacts.ts). Ones that are gone are taken away.
  const served = new Set<string>();
  for (const a of artifacts) {
    served.add(a.path);
    writeIfChanged(join(site, "a", a.path), prepared(readFileSync(join(cfg.knowledgeDir, a.path), "utf8"), a.path, a.network));
  }
  if (existsSync(join(site, "a"))) for (const rel of walkFiles(join(site, "a"))) if (!served.has(rel)) unlinkSync(join(site, "a", rel));
  for (const rel of walkFiles(join(data, "k"))) if (isArtifact(rel)) unlinkSync(join(data, "k", rel)); // from before artifacts

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
