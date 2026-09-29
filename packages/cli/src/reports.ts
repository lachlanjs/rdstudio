// HTML reports: metadata from <meta name="rdstudio:*"> tags and links into
// knowledge. A port of src/rdstudio/reports.py.

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cmp, cmpTuple, strip } from "@rdstudio/core";
import { decodeHTML } from "entities";
import { dirnamePosix, joinPosix, normpathPosix, walkFiles } from "./files.ts";

const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const META = /<meta\s+[^>]*>/gi;
const ATTR = /([\p{L}\p{N}_][\p{L}\p{N}_:-]*)\s*=\s*("([^"]*)"|'([^']*)')/gu;
const HREF = /href\s*=\s*("([^"]*)"|'([^']*)')/gi;
const H1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i;
const TAGS = /<[^>]+>/g;

function meta(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [tag] of text.matchAll(META)) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(ATTR)) attrs[m[1]!.toLowerCase()] = decodeHTML(m[3] ?? m[4] ?? "");
    const name = attrs.name ?? "";
    if (name.startsWith("rdstudio:") || name === "description") out[name.replace(/^rdstudio:/, "")] = attrs.content ?? "";
  }
  return out;
}

/** Concept ids linked from a report (/knowledge/x.md, relative paths into it, or #/k/ routes). */
export function knowledgeLinks(text: string, reportRel: string, knowledge: string, reports: string): string[] {
  const ids = new Set<string>();
  const here = dirnamePosix(joinPosix(reports, reportRel));
  for (const m of text.matchAll(HREF)) {
    let href = decodeHTML(m[2] ?? m[3] ?? "");
    if (href.startsWith("#/k/")) { ids.add(href.slice(4)); continue; }
    href = href.split("#")[0]!.split("?")[0]!;
    if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
    const path = href.startsWith("/") ? href.replace(/^\/+/, "") : normpathPosix(joinPosix(here, href));
    const prefix = knowledge.replace(/^\/+|\/+$/g, "") + "/";
    if (path.startsWith(prefix) && path.endsWith(".md")) ids.add(path.slice(prefix.length, -3));
  }
  return [...ids].sort(cmp);
}

export function scan(reportsDir: string, knowledge: string, reports: string): Record<string, unknown>[] {
  const items: { path: string; date: string; [k: string]: unknown }[] = [];
  for (const rel of walkFiles(reportsDir).filter((p) => p.endsWith(".html"))) {
    if (rel.split("/").some((part) => part.startsWith(".") || part.startsWith("_"))) continue;
    const full = join(reportsDir, rel);
    const text = new TextDecoder("utf-8").decode(readFileSync(full)).replace(/\r\n?/g, "\n");
    const m = meta(text);
    let title = m.title;
    if (!title) {
      const found = TITLE.exec(text) ?? H1.exec(text);
      title = found ? strip(decodeHTML(found[1]!.replace(TAGS, ""))) : rel.split("/").pop()!.replace(/\.html$/, "");
    }
    items.push({
      path: rel,
      title: strip(title).split(/\s+/u).filter(Boolean).join(" "),
      date: m.date || new Date(statSync(full).mtimeMs).toISOString().slice(0, 10),
      author: m.author ?? "",
      description: m.description ?? "",
      activity: m.activity ?? "",
      links: knowledgeLinks(text, rel, knowledge, reports),
    });
  }
  return items.sort((a, b) => cmpTuple([b.date, b.path], [a.date, a.path]));
}
