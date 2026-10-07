// Artifacts (T76): HTML documents in the knowledge folders, beside the notes,
// that do what Markdown cannot. Notes link to them or embed them; what an
// artifact links to is never read. They replace reports. Here: finding them,
// reading their head, checking them, and preparing the copy that is served,
// which carries a policy that allows no network and a small bridge to the
// page that frames it. See knowledge/design/artifacts.md.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cmp, cmpTuple, strip, type ArtifactRecord, type Bundle } from "@rdstudio/core";
import { decodeHTML } from "entities";
import { walkFiles } from "./files.ts";

const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const META = /<meta\s+[^>]*>/gi;
const ATTR = /([\p{L}\p{N}_][\p{L}\p{N}_:-]*)\s*=\s*("([^"]*)"|'([^']*)')/gu;
const H1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i;
const TAGS = /<[^>]+>/g;
/** An address somewhere else, in an attribute that loads something or in a script that fetches. */
const OUTSIDE = /(?:\b(?:src|href|action|poster|data)\s*=\s*["']|url\(\s*["']?|\bfetch\(\s*["'`]|\bimport\s*(?:\(\s*)?["'`]|new\s+(?:WebSocket|EventSource)\(\s*["'`])((?:https?:|wss?:)?\/\/[^"'`)\s]+)/gi;

export const isArtifact = (path: string): boolean => /\.html?$/i.test(path) && !path.split("/").some((part) => part.startsWith(".") || part.startsWith("_"));
/** Heavier than this, an artifact slows the note it is shown in: the lint says so. */
export const MAX_BYTES = 200_000;

function head(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [tag] of text.matchAll(META)) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(ATTR)) attrs[m[1]!.toLowerCase()] = decodeHTML(m[3] ?? m[4] ?? "");
    const name = (attrs.name ?? "").toLowerCase();
    if (name.startsWith("rdstudio:") || name === "description") out[name.replace(/^rdstudio:/, "")] = attrs.content ?? "";
  }
  return out;
}

/** Addresses outside the artifact that it would load or call, as written. Links for a person to follow (`<a href>`) are not among them. */
export function outside(text: string): string[] {
  const found = new Set<string>();
  const noAnchors = text.replace(/<a\s[^>]*>/gi, "");
  for (const m of noAnchors.matchAll(OUTSIDE)) found.add(m[1]!);
  return [...found].sort(cmp);
}

/** Every artifact in the knowledge folders, newest first, with the notes that cite it. */
export function scan(knowledgeDir: string, b: Bundle): ArtifactRecord[] {
  const cited = new Map<string, ArtifactRecord["citedBy"]>();
  for (const c of b.concepts.values()) {
    for (const cite of c.cites) {
      if (cite.kind !== "artifact" || cite.broken) continue;
      const list = cited.get(cite.target) ?? cited.set(cite.target, []).get(cite.target)!;
      if (!list.some((x) => x.note === c.id && x.embed === cite.embed)) list.push({ note: c.id, embed: cite.embed, rel: cite.rel });
    }
  }
  const items: ArtifactRecord[] = [];
  for (const path of [...b.files].filter(isArtifact).sort(cmp)) {
    const full = join(knowledgeDir, path);
    const text = new TextDecoder("utf-8").decode(readFileSync(full)).replace(/\r\n?/g, "\n");
    const m = head(text);
    const found = TITLE.exec(text) ?? H1.exec(text);
    const named = m.title || (found ? strip(decodeHTML(found[1]!.replace(TAGS, ""))) : "");
    const st = statSync(full);
    const network = /^(required|yes|true)$/i.test(m.network ?? "");
    items.push({
      path,
      directory: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
      title: strip(named || path.split("/").pop()!.replace(/\.html?$/i, "")).split(/\s+/u).filter(Boolean).join(" "),
      titled: Boolean(named),
      date: m.date || new Date(st.mtimeMs).toISOString().slice(0, 10),
      author: m.author ?? "",
      description: m.description ?? "",
      network,
      aspect: /^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(m.aspect ?? "") ? m.aspect!.replace(/\s+/g, "") : null,
      bytes: st.size,
      outside: network ? [] : outside(text),
      citedBy: (cited.get(path) ?? []).sort((x, y) => cmp(x.note, y.note)),
    });
  }
  return items.sort((x, y) => cmpTuple([y.date, x.path], [x.date, y.path]));
}

export interface ArtifactIssue { path: string; severity: "warning"; code: string; message: string }

/** What the lint says of the artifacts: weight, addresses elsewhere, a missing title; and old reports left behind. */
export function lint(items: ArtifactRecord[], reportsDir: string, reports: string): ArtifactIssue[] {
  const out: ArtifactIssue[] = [];
  for (const a of items) {
    if (!a.titled) out.push({ path: a.path, severity: "warning", code: "artifact-title", message: "an artifact should have a <title>" });
    if (a.bytes > MAX_BYTES) out.push({ path: a.path, severity: "warning", code: "artifact-heavy", message: `${Math.round(a.bytes / 1000)} kB: over ${MAX_BYTES / 1000} kB slows the note it is shown in` });
    for (const url of a.outside) out.push({ path: a.path, severity: "warning", code: "artifact-network", message: `loads ${url}, which will be blocked: artifacts work offline (or say <meta name="rdstudio:network" content="required">)` });
    if (a.network) out.push({ path: a.path, severity: "warning", code: "artifact-online", message: "needs the network (rdstudio:network): it does not work offline, and is not shown in a note until asked for" });
  }
  if (existsSync(reportsDir)) {
    for (const rel of walkFiles(reportsDir).filter((p) => /\.html?$/i.test(p))) {
      out.push({ path: `${reports}/${rel}`, severity: "warning", code: "report-left", message: "reports are now artifacts: move this into a folder of the knowledge base, beside the notes it belongs with" });
    }
  }
  return out;
}

// ------------------------------------------------------------------ the copy that is served

/** What an artifact may load: itself and rdstudio's own libraries. No network. */
export const POLICY = "default-src 'none'; script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline' 'self'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; worker-src blob:; connect-src 'none'; form-action 'none'; base-uri 'none'";
/** Sent with every artifact by rdstudio serve: it runs apart from the app (no access to its page, its storage or the write token), framed or opened on its own. */
export const SANDBOX = "sandbox allow-scripts allow-pointer-lock";

// The bridge: tells the page that frames the artifact its height, when it is ready, and anything that went
// wrong; takes the theme's colours; and counts animation frames when asked, to tell whether it is idle.
const BRIDGE = `<script>(function(){
var say=function(m){try{parent.postMessage(Object.assign({rdstudio:"artifact"},m),"*")}catch(e){}};
var err=function(x){say({type:"error",message:String(x&&x.message||x).slice(0,300)})};
addEventListener("error",function(e){err(e.error||e.message||(e.target&&e.target.src?"could not load "+e.target.src:"error"))},true);
addEventListener("unhandledrejection",function(e){err(e.reason)});
var ce=console.error;console.error=function(){err(Array.prototype.join.call(arguments," "));ce.apply(console,arguments)};
var frames=0,raf=window.requestAnimationFrame;window.requestAnimationFrame=function(f){frames++;return raf.call(window,f)};
var size=function(){var d=document.documentElement,b=document.body;say({type:"size",height:Math.ceil(Math.max(d.scrollHeight,b?b.scrollHeight:0))})};
addEventListener("load",function(){say({type:"ready",ms:Math.round(performance.now())});size();
 if(window.ResizeObserver)new ResizeObserver(size).observe(document.documentElement)});
addEventListener("message",function(e){var m=e.data||{};
 if(m.rdstudio==="theme"){var r=document.documentElement;for(var k in m.vars||{})r.style.setProperty(k,m.vars[k]);
  r.dataset.mode=m.mode||"";r.style.colorScheme=m.mode==="light"?"light":"dark";size()}
 if(m.rdstudio==="probe"){var was=frames;setTimeout(function(){say({type:"idle",frames:frames-was,ms:m.ms||1000})},m.ms||1000)}});
})();</script>`;

/** The artifact as it is served: the policy and the bridge first in its head, and `vendor/…`, `report.css` and
 *  `report.js` pointed at rdstudio's own copies from wherever it sits. */
export function prepared(text: string, path: string, network: boolean): string {
  const up = "../".repeat(path.split("/").length); // served at a/<path>
  const lead = (network ? "" : `<meta http-equiv="Content-Security-Policy" content="${POLICY}">`) + BRIDGE;
  let out = text.replace(/((?:src|href)\s*=\s*["'])(vendor\/|report\.(?:css|js)["'])/gi, `$1${up}$2`);
  if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, (m) => m + lead);
  else if (/<html[^>]*>/i.test(out)) out = out.replace(/<html[^>]*>/i, (m) => m + "<head>" + lead + "</head>");
  else out = lead + out;
  return out;
}
