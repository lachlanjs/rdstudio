// Optional papis backend: reference stubs in the bundle, and cheap access to
// bibliographic metadata and PDF text for agents. papis keeps one folder per
// document with an info.yaml, read here directly (papis itself is not
// needed); PDF text comes from pdftotext.
//
//   [references]
//   backend = "papis"
//   library = "thesis"        # a papis library name (from ~/.config/papis/config)
//   # path = "~/papis/thesis" # or the library folder itself
//   directory = "references"  # where stubs live in the knowledge bundle

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Document } from "yaml";
import { cmp, parseYaml, pyRepr, strip, text as asText, tokenize } from "@rdstudio/core";
import { expandUser, type Config } from "./config.ts";
import { node, now, writeNote } from "./store.ts";

const SAFE = /[^A-Za-z0-9._-]+/g;

export class ReferenceError extends Error {}

type Info = Record<string, unknown>;

export class Entry {
  readonly ref: string;
  readonly folder: string;
  readonly info: Info;
  constructor(ref: string, folder: string, info: Info) {
    this.ref = ref;
    this.folder = folder;
    this.info = info;
  }

  get title(): string { return asText(this.info.title || this.ref).split(/\s+/u).filter(Boolean).join(" "); }

  get authors(): string[] {
    const out: string[] = [];
    for (const a of (Array.isArray(this.info.author_list) ? this.info.author_list : [])) {
      if (a && typeof a === "object" && !Array.isArray(a)) {
        const name = [(a as Info).given, (a as Info).family].filter((x) => x).map(asText).join(" ");
        if (name) out.push(name);
      }
    }
    if (!out.length && this.info.author) return asText(this.info.author).split(" and ").map(strip);
    return out;
  }

  get year(): string { return asText(this.info.year || ""); }
  get venue(): string { return asText(this.info.journal || this.info.booktitle || this.info.publisher || ""); }
  get url(): string { return this.info.doi ? `https://doi.org/${asText(this.info.doi)}` : asText(this.info.url || ""); }

  get pdfs(): string[] {
    const files = Array.isArray(this.info.files) ? this.info.files : [];
    return files.map(asText).filter((f) => f.toLowerCase().endsWith(".pdf") && existsSync(join(this.folder, f))).map((f) => join(this.folder, f));
  }

  citation(): string {
    const names = this.authors;
    const last = (n: string) => n.split(/\s+/u).filter(Boolean).at(-1) ?? n;
    const who = names.length
      ? last(names[0]!) + (names.length > 2 ? " et al." : names.length === 2 ? ` and ${last(names[1]!)}` : "")
      : "Anon.";
    return `${who} (${this.year || "n.d."}). ${this.title}.` + (this.venue ? ` ${this.venue}.` : "");
  }

  summary(): Info {
    return { ref: this.ref, title: this.title, authors: this.authors, year: this.year, venue: this.venue, url: this.url, tags: tags(this.info), has_pdf: this.pdfs.length > 0 };
  }
}

function tags(info: Info): string[] {
  let t = info.tags || [];
  if (typeof t === "string") t = t.split(/[,\s]+/);
  return Array.isArray(t) ? t.filter((x) => x).map(asText) : [];
}

const references = (cfg: Config): Info => (cfg.raw.references ?? {}) as Info;

/** A small reader for papis's INI configuration, as Python's configparser reads it. */
function readIni(path: string): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  if (!existsSync(path)) return out;
  let section: Map<string, string> | null = null, key: string | null = null;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim() || /^\s*[#;]/.test(line)) continue;
    const head = /^\[([^\]]+)\]/.exec(line);
    if (head) { section = out.get(head[1]!) ?? new Map(); out.set(head[1]!, section); key = null; continue; }
    if (/^\s/.test(line) && key && section) { section.set(key, `${section.get(key)}\n${line.trim()}`); continue; }
    const kv = /^([^=:]+?)\s*[=:]\s*(.*)$/.exec(line);
    if (kv && section) { key = kv[1]!.trim().toLowerCase(); section.set(key, kv[2]!.trim()); }
  }
  return out;
}

export function libraryPath(cfg: Config): string {
  const r = references(cfg);
  if (r.path) return expandUser(asText(r.path));
  const ini = readIni(join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "papis", "config"));
  const name = asText(r.library || ini.get("settings")?.get("default-library") || "");
  const dir = name ? ini.get(name)?.get("dir") : undefined;
  if (dir) return expandUser(dir);
  throw new ReferenceError("no papis library configured: set [references] library or path in rdstudio.toml");
}

export const enabled = (cfg: Config): boolean => references(cfg).backend === "papis";
export const stubDir = (cfg: Config): string => asText(references(cfg).directory ?? "references").replace(/^\/+|\/+$/g, "");
export const stubId = (cfg: Config, ref: string): string => `${stubDir(cfg)}/${ref.replace(SAFE, "-")}`;

export function load(cfg: Config): Map<string, Entry> {
  const root = libraryPath(cfg);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new ReferenceError(`papis library not found at ${root}`);
  const entries = new Map<string, Entry>();
  for (const folder of readdirSync(root).filter((d) => !d.startsWith(".")).sort(cmp)) {
    const infoPath = join(root, folder, "info.yaml");
    if (!existsSync(infoPath)) continue;
    const doc = parseYaml(readFileSync(infoPath, "utf8"));
    if (doc.errors.length) continue;
    const info = (doc.toJS() ?? {}) as Info;
    const ref = asText(info.ref || folder);
    entries.set(ref, new Entry(ref, join(root, folder), info));
  }
  return entries;
}

/** Create a `type: Reference` concept for every papis entry that lacks one.
 *  Existing concepts are never modified. */
export function syncStubs(cfg: Config): string[] {
  const created: string[] = [];
  for (const [ref, e] of load(cfg)) {
    const cid = stubId(cfg, ref);
    const path = join(cfg.knowledgeDir, `${cid}.md`);
    if (existsSync(path)) continue;
    const meta: Info = { type: "Reference", title: e.title, description: e.citation() };
    if (e.url) meta.resource = e.url;
    const t = tags(e.info);
    if (t.length) meta.tags = t;
    meta.papis = { ref };
    meta.generated = { by: "process:rdstudio-refs", at: now() };
    const doc = new Document({}, { version: "1.2" });
    for (const [k, v] of Object.entries(meta)) doc.set(k, node(doc, v));
    mkdirSync(dirname(path), { recursive: true });
    writeNote(path, {
      doc,
      body: "# Summary\n\nNot yet summarised.\n\n# Relevance\n\nHow this bears on the project: which decisions, questions or designs it supports or challenges.\n",
    });
    created.push(cid);
  }
  return created;
}

export function search(cfg: Config, query: string, limit = 8): Info[] {
  const terms = new Set(tokenize(query));
  const scored: [number, Entry][] = [];
  for (const e of load(cfg).values()) {
    const fields = [...Array(3).fill(e.title), ...Array(2).fill(e.authors.join(" ")), tags(e.info).join(" "), asText(e.info.abstract || ""), e.venue];
    const tokens = tokenize(fields.join(" "));
    let score = 0;
    for (const t of terms) score += tokens.filter((x) => x === t).length;
    if (query.toLowerCase().includes(e.ref.toLowerCase())) score += 10;
    if (score) scored.push([score, e]);
  }
  scored.sort((a, b) => b[0] - a[0] || cmp(a[1].ref, b[1].ref));
  return scored.slice(0, Math.max(0, limit)).map(([, e]) => ({ ...e.summary(), concept: stubId(cfg, e.ref) }));
}

/** Plain text of an entry's first PDF, one string per page, cached under the build output folder. */
export function textPages(cfg: Config, ref: string): string[] {
  const entries = load(cfg);
  const e = entries.get(ref);
  if (!e) throw new ReferenceError(`no papis entry ${pyRepr(ref)}`);
  const pdf = e.pdfs[0];
  if (!pdf) throw new ReferenceError(`${ref} has no PDF attached`);
  const cache = join(cfg.outputDir, "cache", "text", `${ref.replace(SAFE, "-")}.txt`);
  if (!existsSync(cache) || statSync(cache).mtimeMs < statSync(pdf).mtimeMs) {
    mkdirSync(dirname(cache), { recursive: true });
    try {
      execFileSync("pdftotext", ["-layout", pdf, cache], { stdio: "ignore", timeout: 120_000 });
    } catch (err) {
      if ((err as { code?: string }).code === "ENOENT") throw new ReferenceError("pdftotext (poppler) is not installed");
      throw err;
    }
  }
  const pages = new TextDecoder("utf-8").decode(readFileSync(cache)).replace(/\r\n?/g, "\n").split("\f");
  if (pages.length && !strip(pages.at(-1)!)) pages.pop(); // pdftotext ends every page, the last included, with a form feed
  return pages;
}

/** Pages of a reference's PDF as text: `pages` like "1" or "3-4,7", or the two pages best matching `query`. */
export function text(cfg: Config, ref: string, { pages, query, maxChars = 6000 }: { pages?: string | null; query?: string | null; maxChars?: number } = {}): string {
  const all = textPages(cfg, ref);
  const n = all.length;
  let chosen: number[] = [];
  const int = (s: string): number => {
    if (!/^\s*[-+]?\d+\s*$/.test(s)) throw new ReferenceError(`invalid literal for int() with base 10: ${pyRepr(s)}`);
    return Number.parseInt(s, 10);
  };
  if (pages) {
    for (const part of pages.split(",")) {
      if (part.includes("-")) {
        const [a, b] = [part.slice(0, part.indexOf("-")), part.slice(part.indexOf("-") + 1)];
        for (let p = int(a); p <= int(b); p++) chosen.push(p);
      } else if (strip(part)) {
        chosen.push(int(part));
      }
    }
  } else if (query) {
    const terms = [...new Set(tokenize(query))];
    const toks = all.map((p) => tokenize(p));
    const hits = (p: number) => terms.reduce((s, t) => s + toks[p - 1]!.filter((x) => x === t).length, 0);
    const ranked = [...Array(n).keys()].map((i) => i + 1).sort((a, b) => hits(b) - hits(a)); // stable, as Python's sorted
    chosen = ranked.slice(0, 2).filter((p) => terms.some((t) => toks[p - 1]!.includes(t))).sort((a, b) => a - b);
  } else {
    chosen = [1];
  }
  const out = chosen.filter((p) => p >= 1 && p <= n).map((p) => `--- page ${p} of ${n} ---\n${strip(all[p - 1]!)}`);
  const result = out.join("\n\n") || `No matching pages (the PDF has ${n} pages).`;
  return [...result].length <= maxChars ? result : [...result].slice(0, maxChars).join("") + "\n[truncated; ask for fewer pages]";
}
