// How well a search finds the note that answers a question (T88): for keyword
// search, search by meaning (T89), and either. Run from the repository's root:
//   node bench/retrieval/measure.ts [project] [questions.json]
// Needs the model for search by meaning (mise run embed:model). The first run
// on a project embeds its notes.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SearchIndex } from "@rdstudio/core";
import { loadBundle } from "@rdstudio/core/node";
import { loadConfig } from "../../packages/cli/src/config.ts";
import * as embed from "../../packages/cli/src/embed.ts";

const cfg = loadConfig(resolve(process.argv[2] ?? "."));
const { questions } = JSON.parse(readFileSync(process.argv[3] ?? new URL("./questions.json", import.meta.url), "utf8")) as { questions: { q: string; note: string; also?: string[] }[] };
const b = loadBundle(cfg.knowledgeDir), index = new SearchIndex(b);
if (!embed.available()) { console.error("The model for search by meaning is not installed: mise run embed:model"); process.exit(1); }
const made = await embed.refresh(cfg);
if (made.made) console.error(`embedded ${made.made} sections`);

const N = 15, KS = [1, 3, 5, 10];
const rows: { q: string; kw: number; me: number; kwTop: string; meTop: string }[] = [];
for (const { q, note, also = [] } of questions) {
  const ok = [note, ...also];
  const kw = index.search(q, { limit: N }).map((h) => h.concept.id);
  const me = (await embed.similar(cfg, b, q, { limit: N })).hits.map((h) => h.note);
  const at = (list: string[]) => { const k = list.findIndex((id) => ok.includes(id)); return k < 0 ? 99 : k + 1; };
  rows.push({ q, kw: at(kw), me: at(me), kwTop: kw[0] ?? "-", meTop: me[0] ?? "-" });
}
const pct = (f: (r: (typeof rows)[number]) => number, k: number) => `${Math.round((100 * rows.filter((r) => f(r) <= k).length) / rows.length)}%`.padStart(5);
console.log(`${rows.length} questions: an answering note within the first k notes returned\n`);
console.log(`                ${KS.map((k) => String(k).padStart(5)).join("")}   not in ${N}`);
for (const [name, f] of [["keyword", (r) => r.kw], ["by meaning", (r) => r.me], ["either", (r) => Math.min(r.kw, r.me)]] as [string, (r: (typeof rows)[number]) => number][])
  console.log(`${name.padEnd(16)}${KS.map((k) => pct(f, k)).join("")}   ${rows.filter((r) => f(r) > N).length}`);
if (process.argv.includes("--each")) for (const r of rows) console.log(`${String(r.kw).padStart(3)}${String(r.me).padStart(3)}  ${r.q}  [${r.kwTop} | ${r.meTop}]`);
