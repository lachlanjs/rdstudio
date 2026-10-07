// Search by meaning (T89): notes found by what they say, in other words than
// theirs. Each note is cut at its headings into pieces; each piece is turned
// into a vector by a small model that ships with rdstudio and runs on this
// machine through WebAssembly (no native binary, nothing sent anywhere); a
// question is turned into a vector the same way, and the nearest pieces are
// the answer. See knowledge/decisions/semantic-search-local.md.
//
// The vectors are kept in .rdstudio/embeddings.json, each under a fingerprint
// of the text it was made from. So an edited section is the only one made
// again, a note moved or renamed costs nothing, and an edit made outside the
// app is caught the next time anything is looked for.

import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Bundle } from "@rdstudio/core";
import { loadBundle } from "@rdstudio/core/node";
import type { Config } from "./config.ts";

/** The model the vectors are made with: a cache made with another is made again. */
export const MODEL = "bge-small-en-v1.5-q8";
export const DIM = 384;
const MAX_TOKENS = 512; // the model reads no more
const MAX_PIECE = 1800; // characters: a longer section is cut at its paragraphs, so that all of it is read
const QUERY = "Represent this sentence for searching relevant passages: "; // how this model is asked a question
/** This many pieces without a vector are made at once, before a search; more are left to the background. */
export const INLINE = 12;

// ------------------------------------------------------------------ pieces

/** A piece of a note: a section, or part of a long one, with the text a vector is made from. */
export interface Piece {
  note: string;
  heading: string;
  /** The piece's own text, as written. */
  body: string;
  /** What is embedded: the note's title and description, the heading, the text. */
  text: string;
  /** A fingerprint of `text`: what its vector is kept under. */
  key: string;
}

const fingerprint = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 20);

/** Every note cut into pieces: at its first- and second-level headings (not inside a code fence), and a long section at its paragraphs. */
export function pieces(b: Bundle): Piece[] {
  const out: Piece[] = [];
  for (const c of b.concepts.values()) {
    const lead = `${c.title}. ${c.description ?? ""}`.trim();
    const mine: Piece[] = [];
    const add = (heading: string, body: string) => {
      const text = `${lead}\n${heading}\n${body}`.trim();
      mine.push({ note: c.id, heading, body, text, key: fingerprint(text) });
    };
    const flush = (heading: string, lines: string[]) => {
      const body = lines.join("\n").trim();
      if (body.length < 40) return; // a heading with nothing under it
      if (body.length <= MAX_PIECE) { add(heading, body); return; }
      let run = "";
      for (const para of body.split(/\n\s*\n/)) {
        if (run && run.length + para.length + 2 > MAX_PIECE) { add(heading, run); run = ""; }
        run = run ? `${run}\n\n${para}` : para;
      }
      if (run.trim()) add(heading, run);
    };
    let heading = "", lines: string[] = [], fence = false;
    for (const line of c.body.split("\n")) {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      const m = fence ? null : /^(#{1,2})\s+(.*?)\s*#*\s*$/.exec(line);
      if (m) { flush(heading, lines); heading = m[2]!; lines = []; } else lines.push(line);
    }
    flush(heading, lines);
    if (!mine.length) add("", c.body.trim()); // a note too short to cut still has its title and description
    out.push(...mine);
  }
  return out;
}

// ------------------------------------------------------------------ the model

type Embedder = (text: string) => Promise<Float32Array>;
let override: Embedder | null = null;
/** Put another embedder in the model's place (tests): everything is then made at once, in this process. */
export function setEmbedder(e: Embedder | null): void { override = e; loaded = null; }

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/** Where the model's files and the runtime's are: beside the bundled command line, or in the source tree. */
function assets(): { model: string; tokenizer: string; config: string; wasm: string } | null {
  const at = (dir: string, wasm: string) => ({ model: join(dir, "model.onnx"), tokenizer: join(dir, "tokenizer.json"), config: join(dir, "tokenizer_config.json"), wasm });
  const set = process.env.RDSTUDIO_EMBED_DIR;
  const packed = set || join(here, "embed");
  if (existsSync(join(packed, "model.onnx")) && existsSync(join(packed, "ort.wasm"))) return at(packed, join(packed, "ort.wasm"));
  const dev = join(here, "..", "models", "bge-small-en-v1.5");
  if (!existsSync(join(dev, "model.onnx"))) return null;
  try { return at(dev, join(dirname(require.resolve("onnxruntime-web")), "ort-wasm-simd-threaded.wasm")); } catch { return null; }
}

/** Whether notes can be searched by meaning here: the model is installed, and it is not switched off (RDSTUDIO_EMBED=off). */
export function available(): boolean {
  if (override) return true;
  return process.env.RDSTUDIO_EMBED !== "off" && assets() !== null;
}

let loaded: Promise<Embedder> | null = null;
function embedder(): Promise<Embedder> {
  if (override) return Promise.resolve(override);
  loaded ??= (async () => {
    const a = assets();
    if (!a) throw new Error("the model for search by meaning is not installed");
    const ort = await import("onnxruntime-web/wasm");
    const { Tokenizer } = await import("@huggingface/tokenizers");
    // One thread: the web runtime's workers do not start under Node. And it cannot fetch its own binary from a file here, so it is handed it.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmBinary = readFileSync(a.wasm);
    const tok = new Tokenizer(JSON.parse(readFileSync(a.tokenizer, "utf8")), JSON.parse(readFileSync(a.config, "utf8")));
    const session = await ort.InferenceSession.create(readFileSync(a.model), { executionProviders: ["wasm"] });
    const typed = session.inputNames.includes("token_type_ids");
    return async (text: string) => {
      let ids: number[] = tok.encode(text).ids;
      if (ids.length > MAX_TOKENS) ids = [...ids.slice(0, MAX_TOKENS - 1), ids.at(-1)!];
      const big = (v: number[]) => new ort.Tensor("int64", BigInt64Array.from(v, BigInt), [1, ids.length]);
      const out = await session.run({ input_ids: big(ids), attention_mask: big(ids.map(() => 1)), ...(typed ? { token_type_ids: big(ids.map(() => 0)) } : {}) });
      // The first token's state stands for the whole text, as this model is used.
      const state = (out.last_hidden_state ?? Object.values(out)[0])!;
      return Float32Array.from((state.data as Float32Array).subarray(0, DIM));
    };
  })();
  return loaded;
}

/** A vector at unit length, as bytes: a 127th of a step loses nothing that changes an order. */
function pack(v: Float32Array): Int8Array {
  let s = 0;
  for (const x of v) s += x * x;
  s = Math.sqrt(s) || 1;
  return Int8Array.from(v, (x) => Math.round((x / s) * 127));
}

// ------------------------------------------------------------------ the cache

interface Cache { model: string; vectors: Map<string, Int8Array> }
export const cachePath = (cfg: Config): string => join(cfg.root, ".rdstudio", "embeddings.json");

function readCache(cfg: Config): Cache {
  const empty = (): Cache => ({ model: MODEL, vectors: new Map() });
  try {
    const raw = JSON.parse(readFileSync(cachePath(cfg), "utf8")) as { model?: string; dim?: number; vectors?: Record<string, string> };
    if (raw.model !== MODEL || raw.dim !== DIM || !raw.vectors) return empty(); // another model's: made again
    const vectors = new Map<string, Int8Array>();
    for (const [key, b64] of Object.entries(raw.vectors)) { const buf = Buffer.from(b64, "base64"); if (buf.length === DIM) vectors.set(key, new Int8Array(buf.buffer, buf.byteOffset, DIM)); }
    return { model: MODEL, vectors };
  } catch { return empty(); }
}

function writeCache(cfg: Config, cache: Cache): void {
  const path = cachePath(cfg), tmp = `${path}.${process.pid}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  const vectors: Record<string, string> = {};
  for (const [key, v] of cache.vectors) vectors[key] = Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64");
  writeFileSync(tmp, JSON.stringify({ model: cache.model, dim: DIM, vectors }));
  renameSync(tmp, path); // whole or not at all: a search may be reading it
}

/** How much of the base has a vector: for saying so, and for tests. */
export function state(cfg: Config, b: Bundle = loadBundle(cfg.knowledgeDir)): { pieces: number; missing: number } {
  const ps = pieces(b), cache = readCache(cfg);
  return { pieces: ps.length, missing: ps.filter((p) => !cache.vectors.has(p.key)).length };
}

/** Make a vector for every piece that has none, and forget the ones no piece has any more. Returns how many were made. */
export async function refresh(cfg: Config, opts: { onProgress?: (done: number, of: number) => void; part?: [number, number] } = {}): Promise<{ made: number; pieces: number }> {
  const ps = pieces(loadBundle(cfg.knowledgeDir));
  const cache = readCache(cfg);
  const wanted = new Set(ps.map((p) => p.key));
  const [k0, n0] = opts.part ?? [0, 1];
  const todo = ps.filter((p) => !cache.vectors.has(p.key)).filter((p, k, all) => all.findIndex((q) => q.key === p.key) === k).filter((_, k) => k % n0 === k0); // one share of several, or all
  const stale = [...cache.vectors.keys()].filter((k) => !wanted.has(k));
  if (!todo.length && !stale.length) return { made: 0, pieces: ps.length };
  const embed = todo.length ? await embedder() : null;
  const save = () => {
    // Another process may have written since: what it made is kept.
    const now = readCache(cfg);
    for (const [k, v] of now.vectors) if (!cache.vectors.has(k)) cache.vectors.set(k, v);
    for (const k of [...cache.vectors.keys()]) if (!wanted.has(k)) cache.vectors.delete(k);
    writeCache(cfg, cache);
  };
  let made = 0;
  for (const p of todo) {
    cache.vectors.set(p.key, pack(await embed!(p.text)));
    made++;
    if (made % 40 === 0) { save(); opts.onProgress?.(made, todo.length); } // a search meanwhile finds what is done so far
  }
  save();
  return { made, pieces: ps.length };
}

const mainFile = () => (existsSync(join(here, "main.ts")) ? join(here, "main.ts") : fileURLToPath(import.meta.url)); // from source, or the bundle
/** With much to make, share it among a few processes (the model runs on one thread each). */
const SHARE_FROM = 100;

/** What `rdstudio __embed` does: make what is missing, a first pass over a base shared among a few processes. */
export async function refreshAll(cfg: Config): Promise<{ made: number; pieces: number }> {
  const part = /^(\d+)\/(\d+)$/.exec(process.env.RDSTUDIO_EMBED_PART ?? "");
  if (part) return refresh(cfg, { part: [Number(part[1]), Number(part[2])] });
  const before = state(cfg), n = Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)));
  if (override || before.missing < SHARE_FROM || n < 2) return refresh(cfg);
  await Promise.all(Array.from({ length: n }, (_, k) => new Promise<void>((done) => {
    const child = spawn(process.execPath, [mainFile(), "-C", cfg.root, "__embed"], { stdio: "ignore", env: { ...process.env, RDSTUDIO_EMBED_PART: `${k}/${n}` } });
    child.on("exit", () => done()); child.on("error", () => done());
  })));
  const rest = await refresh(cfg); // what a share that failed left, and the forgetting
  void rest;
  return { made: before.missing - state(cfg).missing, pieces: before.pieces };
}

const running = new Map<string, ChildProcess>();
/** Make the missing vectors in another process, so that nothing here waits: one at a time for a project. */
export function refreshInBackground(cfg: Config): boolean {
  if (override) { void refresh(cfg); return true; }
  if (!available()) return false;
  if (running.has(cfg.root)) return true;
  try {
    const child = spawn(process.execPath, [mainFile(), "-C", cfg.root, "__embed"], { stdio: "ignore" });
    running.set(cfg.root, child);
    const done = () => { if (running.get(cfg.root) === child) running.delete(cfg.root); };
    child.on("exit", done); child.on("error", done);
    child.unref();
    return true;
  } catch { return false; }
}

// ------------------------------------------------------------------ search

export interface Hit { note: string; heading: string; score: number; body: string }
export interface Found {
  hits: Hit[];
  /** Pieces with no vector yet: they are not found by meaning until the background has made them. */
  pending: number;
  /** False while there is nothing to search: the first pass over the base has not got anywhere yet. */
  ready: boolean;
}

/** The notes nearest in meaning to a text: each note once, by its nearest piece. */
export async function similar(cfg: Config, b: Bundle, text: string, opts: { limit?: number; under?: string } = {}): Promise<Found> {
  const ps = pieces(b);
  let cache = readCache(cfg);
  let missing = ps.filter((p) => !cache.vectors.has(p.key));
  // A few (a note just edited, here or elsewhere) are made now, so the search sees them; many are left to the background.
  if (missing.length && (override || missing.length <= INLINE)) {
    await refresh(cfg);
    cache = readCache(cfg);
    missing = ps.filter((p) => !cache.vectors.has(p.key));
  } else if (missing.length) refreshInBackground(cfg);
  if (missing.length === ps.length) return { hits: [], pending: missing.length, ready: false };
  const q = pack(await (await embedder())(QUERY + text));
  const under = opts.under?.replace(/^\/+|\/+$/g, "");
  const best = new Map<string, Hit>();
  for (const p of ps) {
    if (under && !p.note.startsWith(under + "/")) continue;
    const v = cache.vectors.get(p.key);
    if (!v) continue;
    let s = 0;
    for (let i = 0; i < DIM; i++) s += q[i]! * v[i]!;
    const score = s / (127 * 127);
    if (score > (best.get(p.note)?.score ?? -Infinity)) best.set(p.note, { note: p.note, heading: p.heading, score, body: p.body });
  }
  const hits = [...best.values()].sort((x, y) => y.score - x.score || (x.note < y.note ? -1 : 1)).slice(0, Math.max(1, Math.min(opts.limit ?? 8, 15)));
  return { hits, pending: missing.length, ready: true };
}
