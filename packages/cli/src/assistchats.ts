// Conversations with Axis beside a note are kept (T97): each chat is one JSON
// file in the asker's private learner record, under assist/chats/, holding
// its turns in order: what was asked, what was marked, what it was let
// change, the answer, the changes proposed (as the text they replaced and the
// text proposed, not as offsets, which do not outlive an edit), what was
// looked up and what it cost. Nothing here writes to a note.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LearnerError } from "@rdstudio/core";
import { allowed, type Ask, type Reply, type Source, type Spent } from "./assist.ts";
import type { Config } from "./config.ts";
import * as learner from "./learner.ts";
import type { Step } from "./lookup.ts";

const CHAT_ID = /^[0-9]{8}T[0-9]{6}-[0-9a-f]{6}$/;
const MOST = 4000; // of a marked passage, or of one side of a change, kept in the record

export interface Turn {
  at: string;
  question: string;
  /** The passage that was marked, as it was. */
  passage: string | null;
  /** The place set for new text: its line, and the text just before it. */
  here: { line: number; after: string } | null;
  /** What it was let change. */
  may: { passage: boolean; note: boolean };
  answer: string;
  /** The changes proposed: what each would replace, and with what. */
  edits: { kind: "passage" | "insert" | "change"; line: number; old: string; new: string }[];
  dropped: string[];
  steps: Step[];
  sources: Source[];
  model: string;
  tier: string;
  cost: number;
  spent: Spent;
}

export interface Chat { id: string; note: string; title: string; at: string; updated: string; turns: Turn[] }
export interface Summary { id: string; note: string; title: string; at: string; updated: string; question: string; turns: number; cost: number }

const cut = (t: string) => (t.length > MOST ? t.slice(0, MOST) + "…" : t);
const lineAt = (body: string, at: number) => body.slice(0, at).split("\n").length;

/** A turn as it is kept and shown, from the request and its reply. */
export function turnOf(a: Ask, r: Reply): Turn {
  const from = Math.max(0, Math.min(a.body.length, Math.min(a.from, a.to))), to = Math.max(from, Math.min(a.body.length, Math.max(a.from, a.to)));
  const ok = allowed(a), at = typeof a.at === "number" ? Math.max(0, Math.min(a.body.length, a.at)) : null;
  return {
    at: new Date().toISOString(), question: a.prompt?.trim() ?? "",
    passage: to > from ? cut(a.body.slice(from, to)) : null,
    here: at === null ? null : { line: lineAt(a.body, at), after: a.body.slice(Math.max(0, at - 80), at).split("\n").pop()!.trim() },
    may: { passage: ok.passage, note: ok.note },
    answer: r.answer,
    edits: (r.edits ?? []).map((e) => ({ kind: e.kind, line: lineAt(a.body, e.from), old: cut(a.body.slice(e.from, e.to)), new: cut(e.insert) })),
    dropped: r.dropped ?? [], steps: r.steps, sources: r.sources, model: r.model, tier: r.tier, cost: r.cost, spent: r.spent,
  };
}

const dir = (cfg: Config) => join(learner.recordDir(cfg), "assist", "chats");
const file = (cfg: Config, id: string) => {
  if (!CHAT_ID.test(id)) throw new LearnerError("not a kept chat's id");
  return join(dir(cfg), `${id}.json`);
};

function load(path: string): Chat | null {
  try {
    const c = JSON.parse(readFileSync(path, "utf8")) as Chat;
    return c && typeof c.id === "string" && typeof c.note === "string" && Array.isArray(c.turns) && c.turns.length ? c : null;
  } catch { return null; }
}

/** Keep a turn: at the end of the chat named, where that is a chat about this note, else as the first of a new one. Null where the learner record is off. */
export function keep(cfg: Config, note: string, title: string, turn: Turn, chat?: string | null): Chat | null {
  if (!learner.enabled(cfg)) return null;
  const old = chat && CHAT_ID.test(chat) ? load(file(cfg, chat)) : null;
  const kept: Chat = old && old.note === note
    ? { ...old, title, updated: turn.at, turns: [...old.turns, turn] }
    : { id: `${turn.at.slice(0, 19).replace(/[-:]/g, "")}-${randomBytes(3).toString("hex")}`, note, title, at: turn.at, updated: turn.at, turns: [turn] };
  mkdirSync(dir(cfg), { recursive: true });
  writeFileSync(file(cfg, kept.id), JSON.stringify(kept, null, 1) + "\n", "utf8");
  return kept;
}

/** The kept chats, the one last added to first: those about one note, or all of them. */
export function list(cfg: Config, note?: string): Summary[] {
  if (!learner.enabled(cfg) || !existsSync(dir(cfg))) return [];
  return readdirSync(dir(cfg)).filter((f) => f.endsWith(".json") && CHAT_ID.test(f.slice(0, -5))).flatMap((f) => {
    const c = load(join(dir(cfg), f));
    if (!c || (note !== undefined && c.note !== note)) return [];
    const first = c.turns[0]!;
    return [{ id: c.id, note: c.note, title: c.title, at: c.at, updated: c.updated, question: first.question || first.passage || "", turns: c.turns.length, cost: c.turns.reduce((n, t) => n + (t.cost || 0), 0) }];
  }).sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0));
}

export function read(cfg: Config, id: string): Chat {
  const c = learner.enabled(cfg) ? load(file(cfg, id)) : null;
  if (!c) throw new LearnerError("no such kept chat");
  return c;
}

export function forget(cfg: Config, id: string): { id: string } {
  const path = file(cfg, id);
  if (existsSync(path)) unlinkSync(path);
  return { id };
}
