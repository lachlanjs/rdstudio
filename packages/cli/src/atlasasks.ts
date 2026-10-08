// Ask Atlas keeps its questions (T94): each finished answer is kept in the
// asker's private learner record, under atlas/asks/, one JSON file each, with
// a fingerprint of every note it opened or rests on. Reading one back says
// what has changed since, so the map can replay the answer or say why not.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LearnerError, sha256, type Bundle } from "@rdstudio/core";
import { loadBundle } from "@rdstudio/core/node";
import { quoteIn, type Answer } from "./atlasask.ts";
import type { Config } from "./config.ts";
import * as learner from "./learner.ts";
import { noteId } from "./lookup.ts";

const ASK_ID = /^[0-9]{8}T[0-9]{6}-[0-9a-f]{6}$/;

/** Where the question was asked from. */
export interface From { ref: string; kind: "note" | "folder" }

export interface Kept {
  id: string;
  at: string;
  from: From | null;
  answer: Answer;
  /** A fingerprint of each note opened or rested on, as it was when the question was answered. */
  notes: Record<string, string>;
}

export interface Summary { id: string; at: string; question: string; from: From | null; tier: string; model: string; cost: number; notes: number }

/** What is no longer as it was when a kept question was answered. */
export interface Since {
  /** Notes that are gone. */
  gone: string[];
  /** Notes whose text has changed. */
  changed: string[];
  /** Links followed that are no longer in either note. */
  links: { from: string; to: string }[];
  /** For each note rested on that is still here: whether its sentence is still in it. */
  quotes: Record<string, boolean>;
}

const dir = (cfg: Config) => join(learner.recordDir(cfg), "atlas", "asks");
const file = (cfg: Config, id: string) => {
  if (!ASK_ID.test(id)) throw new LearnerError("not a kept question's id");
  return join(dir(cfg), `${id}.json`);
};

const print = (b: Bundle, id: string): string | null => {
  const c = b.concepts.get(id);
  return c ? sha256(`${c.title}\n${c.description}\n${c.body}`).slice(0, 16) : null;
};

/** The notes an answer opened or rests on. */
const touched = (a: Answer): string[] => [...new Set([...a.steps.filter((s) => !s.failed && s.opened).map((s) => s.opened!), ...a.steps.filter((s) => !s.failed && s.from).map((s) => s.from!), ...a.used.map((u) => u.note)])];

/** Keep a finished answer; null where the learner record is off. */
export function keep(cfg: Config, answer: Answer, start: string | undefined, b: Bundle = loadBundle(cfg.knowledgeDir)): Kept | null {
  if (!learner.enabled(cfg)) return null;
  const at = new Date().toISOString();
  const id = `${at.slice(0, 19).replace(/[-:]/g, "")}-${randomBytes(3).toString("hex")}`;
  const raw = (start ?? "").trim().replace(/^\/+|\/+$/g, "").replace(/\.md$/i, "");
  const note = raw ? noteId(b, raw) : null;
  const from: From | null = note ? { ref: note, kind: "note" } : raw ? { ref: raw, kind: "folder" } : null;
  const notes: Record<string, string> = {};
  for (const n of touched(answer)) { const p = print(b, n); if (p) notes[n] = p; }
  const kept: Kept = { id, at, from, answer, notes };
  mkdirSync(dir(cfg), { recursive: true });
  writeFileSync(file(cfg, id), JSON.stringify(kept, null, 1) + "\n", "utf8");
  return kept;
}

function load(path: string): Kept | null {
  try {
    const k = JSON.parse(readFileSync(path, "utf8")) as Kept;
    return k && typeof k.id === "string" && k.answer && Array.isArray(k.answer.steps) && Array.isArray(k.answer.used) ? k : null;
  } catch { return null; }
}

/** The kept questions, newest first. */
export function list(cfg: Config): Summary[] {
  if (!learner.enabled(cfg) || !existsSync(dir(cfg))) return [];
  return readdirSync(dir(cfg)).filter((f) => f.endsWith(".json") && ASK_ID.test(f.slice(0, -5))).sort().reverse().flatMap((f) => {
    const k = load(join(dir(cfg), f));
    return k ? [{ id: k.id, at: k.at, question: k.answer.question, from: k.from, tier: k.answer.tier, model: k.answer.model, cost: k.answer.cost, notes: k.answer.used.length }] : [];
  });
}

/** What has changed under a kept answer. */
export function since(k: Kept, b: Bundle): Since {
  const gone: string[] = [], changed: string[] = [], links: { from: string; to: string }[] = [], quotes: Record<string, boolean> = {};
  for (const [id, was] of Object.entries(k.notes)) {
    const now = print(b, id);
    if (now === null) gone.push(id);
    else if (now !== was) changed.push(id);
  }
  for (const s of k.answer.steps) {
    if (s.failed || s.how !== "link" || !s.from || !s.opened || links.some((l) => l.from === s.from && l.to === s.opened)) continue;
    const a = b.concepts.get(s.from), z = b.concepts.get(s.opened);
    if (!a || !z) continue; // a note gone is said once, above
    const joined = a.links.some((l) => !l.broken && l.target === z.id) || z.links.some((l) => !l.broken && l.target === a.id);
    if (!joined) links.push({ from: s.from, to: s.opened });
  }
  for (const u of k.answer.used) {
    const c = b.concepts.get(u.note);
    if (c && u.checked) quotes[u.note] = quoteIn(u.quote, c.body + " " + c.description);
  }
  return { gone, changed, links, quotes };
}

/** One kept question, with what has changed since. */
export function read(cfg: Config, id: string, b: Bundle = loadBundle(cfg.knowledgeDir)): Kept & { since: Since } {
  const k = learner.enabled(cfg) ? load(file(cfg, id)) : null;
  if (!k) throw new LearnerError("no such kept question");
  return { ...k, since: since(k, b) };
}

export function forget(cfg: Config, id: string): { id: string } {
  const path = file(cfg, id);
  if (existsSync(path)) unlinkSync(path);
  return { id };
}
