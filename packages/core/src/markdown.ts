// Links and headings, read with markdown-it (CommonMark): the parser the
// dashboard renders with and the Python core uses (markdown-it-py), so all
// agree on what is a link and what is a heading.

import MarkdownIt from "markdown-it";
import { strip } from "./text.ts";

const md = new MarkdownIt("commonmark");
type Token = ReturnType<MarkdownIt["parse"]>[number];

export interface Heading {
  level: number;
  text: string;
  slug: string;
  line: number; // 0-based, in the body
}

interface Parsed {
  tokens: Token[];
  defs: [string, string | null][]; // link reference definitions: [href, title]
}

const cache = new Map<string, Parsed>();

function parse(body: string): Parsed {
  let hit = cache.get(body);
  if (!hit) {
    const env: { references?: Record<string, { href?: string; title?: string }> } = {};
    const tokens = md.parse(body, env);
    const defs = Object.values(env.references ?? {}).map((d): [string, string | null] => [d.href ?? "", d.title ?? null]);
    hit = { tokens, defs };
    if (cache.size > 8192) cache.clear();
    cache.set(body, hit);
  }
  return hit;
}

// How consequential a link is, given as the link's title:
// [tangent space](/manifolds/tangent-space.md "requires").
export const RATINGS = { requires: 3, uses: 2, "see also": 1 } as const;
export type Rating = keyof typeof RATINGS;

/** The rating a link title names, or null (unrated, or an ordinary title). */
export function rating(title: string | null | undefined): Rating | null {
  let key = strip((title ?? "").toLowerCase().replaceAll("-", " ").replaceAll("_", " ")).split(/\s+/).filter(Boolean).join(" ");
  if (key === "seealso") key = "see also";
  return key in RATINGS ? (key as Rating) : null;
}

/** Link targets with their ratings: every link in order of appearance, then
 *  each reference definition no link used. */
export function linkRefs(body: string): [string, Rating | null][] {
  const { tokens, defs } = parse(body);
  const refs: [string, Rating | null][] = [];
  for (const t of tokens) {
    if (t.type !== "inline" || !t.children) continue;
    for (const c of t.children) {
      if (c.type === "link_open") refs.push([c.attrGet("href") ?? "", rating(c.attrGet("title"))]);
    }
  }
  const used = new Set(refs.map(([href]) => href));
  for (const [href, title] of defs) if (!used.has(href)) refs.push([href, rating(title)]);
  return refs;
}

// Python's re \w (letters, numbers, underscore) and \s.
const NOT_SLUG = /[^\p{L}\p{N}_\s-]/gu;
const SPACES = /[\s_]+/gu;

export function slugify(text: string): string {
  return strip(text.toLowerCase().replace(NOT_SLUG, "")).replace(SPACES, "-");
}

export function headings(body: string): Heading[] {
  const { tokens } = parse(body);
  const out: Heading[] = [];
  tokens.forEach((t, i) => {
    if (t.type !== "heading_open") return;
    const text = strip(tokens[i + 1]?.content ?? "");
    out.push({ level: Number(t.tag.slice(1)), text, slug: slugify(text), line: t.map?.[0] ?? 0 });
  });
  return out;
}

/** The text under `heading` (matched by text or slug) up to the next heading of
 *  the same or higher level, including the heading line itself. */
export function section(body: string, heading: string): string | null {
  const wanted = strip(strip(heading).replace(/^#+/, "")).toLowerCase();
  const wantedSlug = slugify(wanted);
  const hs = headings(body);
  const lines = body.split("\n");
  for (const [idx, h] of hs.entries()) {
    if (h.text.toLowerCase() !== wanted && h.slug !== wantedSlug) continue;
    let end = lines.length;
    for (const later of hs.slice(idx + 1)) {
      if (later.level <= h.level) { end = later.line; break; }
    }
    return strip(lines.slice(h.line, end).join("\n"));
  }
  return null;
}
