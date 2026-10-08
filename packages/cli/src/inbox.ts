// From the app to an agent outside it (T109): something the developer sends
// on purpose, a message with the note or folder they were on, kept beside the
// learner record until a terminal agent asks for it through the MCP server
// (the `from_developer` tool). The server cannot interrupt an agent, so
// nothing arrives until the agent asks; the session's brief says when
// something waits. Nothing about what the developer is doing is kept here but
// what they sent.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Bundle } from "@rdstudio/core";
import type { Config } from "./config.ts";
import * as learner from "./learner.ts";
import { StoreError } from "./store.ts";

export interface Sent {
  id: string;
  at: string;
  text: string;
  /** Where they were when they sent it: a note or a folder of the base. */
  ref?: string;
  kind?: "note" | "folder";
  /** A passage they had marked. */
  passage?: string;
  /** Who took it and when, once an agent has. */
  taken?: { by: string; at: string };
}

export const MAX_TEXT = 4000, MAX_PASSAGE = 4000, KEPT = 50;

const path = (cfg: Config): string => join(learner.recordDir(cfg), "inbox.json");

export function list(cfg: Config): Sent[] {
  const p = path(cfg);
  if (!existsSync(p)) return [];
  try { const all = JSON.parse(readFileSync(p, "utf8")) as Sent[]; return Array.isArray(all) ? all.filter((s) => s && typeof s.id === "string" && typeof s.text === "string") : []; } catch { return []; }
}

function save(cfg: Config, all: Sent[]): void {
  mkdirSync(learner.recordDir(cfg), { recursive: true });
  const p = path(cfg);
  writeFileSync(p + ".tmp", JSON.stringify(all.slice(-KEPT), null, 1) + "\n", "utf8"); // the latest are kept; what was taken long ago goes
  renameSync(p + ".tmp", p);
}

export const waiting = (cfg: Config): Sent[] => list(cfg).filter((s) => !s.taken);

/** Send something to whichever agent asks next. */
export function send(cfg: Config, raw: { text?: unknown; ref?: unknown; passage?: unknown }, b: Bundle): Sent {
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) throw new StoreError("write what to send");
  if (text.length > MAX_TEXT) throw new StoreError(`that is too long to send (${text.length} characters; ${MAX_TEXT} at most)`);
  const ref = typeof raw.ref === "string" ? raw.ref.trim().replace(/^\/+|\/+$/g, "").replace(/\.md$/i, "") : "";
  const kind = !ref ? undefined : b.concepts.has(ref) ? "note" as const : b.directories.has(ref) ? "folder" as const : undefined;
  const passage = typeof raw.passage === "string" ? raw.passage.trim().slice(0, MAX_PASSAGE) : "";
  const sent: Sent = { id: randomBytes(5).toString("hex"), at: new Date().toISOString(), text, ...(kind ? { ref, kind } : {}), ...(passage ? { passage } : {}) };
  save(cfg, [...list(cfg), sent]);
  return sent;
}

/** What waits, handed to the agent that asked, each once. */
export function take(cfg: Config, by: string): Sent[] {
  const all = list(cfg), now = new Date().toISOString();
  const got = all.filter((s) => !s.taken);
  if (!got.length) return [];
  for (const s of got) s.taken = { by, at: now };
  save(cfg, all);
  return got;
}

/** Take back something sent (taken or not): it is no longer listed. */
export function drop(cfg: Config, id: string): { id: string } {
  save(cfg, list(cfg).filter((s) => s.id !== id));
  return { id };
}

/** What was taken, as the agent reads it. */
export function told(got: Sent[], b: Bundle): string {
  if (!got.length) return "Nothing waits from the developer.";
  return [`The developer sent ${got.length === 1 ? "this" : `these ${got.length}`} from the app. Each is given once: act on it, or say why not.`, ...got.map((s, k) => {
    const where = s.kind === "note" ? `They were on the note ${b.concepts.get(s.ref!)?.title ?? s.ref} (/${s.ref}.md).` : s.kind === "folder" ? `They were on the folder ${s.ref}/.` : "";
    return [`## ${got.length > 1 ? `${k + 1}. ` : ""}Sent ${s.at}`, where, s.passage ? `The passage they marked:\n\n> ${s.passage.replace(/\n/g, "\n> ")}` : "", s.text].filter(Boolean).join("\n\n");
  })].join("\n\n");
}
