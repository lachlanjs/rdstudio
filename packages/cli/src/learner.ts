// Where the private learner record lives, and reading and writing it. The
// record's rules are in @rdstudio/core (record.ts); this is the file side,
// a port of src/rdstudio/learner.py.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DEVICE_RE, LearnerError, cleanEvent, readRecord, sha256, type LearnerEvent } from "@rdstudio/core";
import { expandUser, readToml, userConfigPath, type Config, type Table } from "./config.ts";
import { editFrontmatter, parsed } from "./store.ts";

export function settings(): Table {
  const s = readToml(userConfigPath()).learner;
  return typeof s === "object" && s !== null ? (s as Table) : {};
}

/** Days a week must count for a weekly streak: [learner] week_days, 1 to 7, default 4. */
export function weekDays(): number {
  const n = settings().week_days;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 7 ? n : 4;
}

export function enabled(cfg: Config): boolean {
  return Boolean(settings().enabled) && cfg.isProject;
}

/** The repository's first root commit, the same in every clone; outside git, a hash of the path. */
export function projectId(root: string): string {
  try {
    const out = execFileSync("git", ["rev-list", "--max-parents=0", "HEAD"], { cwd: root, encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "ignore"] });
    const roots = out.split(/\s+/).filter(Boolean).sort();
    if (roots.length) return roots[0]!.slice(0, 16);
  } catch { /* not a repository */ }
  return "path-" + sha256(resolve(root)).slice(0, 12);
}

export function learnersRoot(): string {
  const base = settings().path;
  if (typeof base === "string" && base) return expandUser(base);
  return join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "rdstudio", "learners");
}

export function recordDir(cfg: Config): string {
  return join(learnersRoot(), projectId(cfg.root));
}

/** This machine's id in learner records, made once and kept beside them. */
export function deviceId(): string {
  const path = join(learnersRoot(), "device");
  try {
    const dev = readFileSync(path, "utf8").trim();
    if (DEVICE_RE.test(dev)) return dev;
  } catch { /* not made yet */ }
  const dev = randomBytes(4).toString("hex");
  mkdirSync(learnersRoot(), { recursive: true });
  writeFileSync(path, dev + "\n", "utf8");
  return dev;
}

export function events(cfg: Config, concept?: string): LearnerEvent[] {
  const path = join(recordDir(cfg), "record.jsonl");
  const all = existsSync(path) ? readRecord(readFileSync(path, "utf8")) : [];
  return concept === undefined ? all : all.filter((e) => e.concept === concept);
}

/** Check, stamp and append one event; return it as stored. */
export function append(cfg: Config, event: unknown): LearnerEvent {
  const out = cleanEvent(event, { device: deviceId() });
  const dir = recordDir(cfg);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, "record.jsonl"), JSON.stringify(out) + "\n", "utf8");
  return out;
}

// ------------------------------------------------------------------ private tours
// Your own tours, beside the record: Markdown notes of type Tour in tours/,
// in the same form as a shared Tour note, so publishing one is a move.

const TOUR_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface PrivateTour {
  name: string;
  title: string;
  description: string;
  body: string;
}

function tourPath(cfg: Config, name: string): string {
  if (!TOUR_NAME.test(name)) throw new LearnerError("a tour's name is lowercase letters, digits and dashes");
  return join(recordDir(cfg), "tours", `${name}.md`);
}

export function tours(cfg: Config): PrivateTour[] {
  const dir = join(recordDir(cfg), "tours");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md") && TOUR_NAME.test(f.slice(0, -3))).sort().map((f) => {
    const [meta, body] = parsed(readFileSync(join(dir, f), "utf8"));
    return { name: f.slice(0, -3), title: String(meta.title ?? f.slice(0, -3)), description: String(meta.description ?? ""), body };
  });
}

export function saveTour(cfg: Config, name: string, tour: { title?: unknown; description?: unknown; body?: unknown }): PrivateTour {
  const path = tourPath(cfg, name);
  const title = typeof tour.title === "string" && tour.title.trim() ? tour.title.trim() : null;
  if (!title) throw new LearnerError("a tour needs a title");
  const description = typeof tour.description === "string" ? tour.description.trim() : "";
  const body = typeof tour.body === "string" ? tour.body.replace(/\r\n?/g, "\n") : "";
  const front = editFrontmatter("", { type: "Tour", title, ...(description ? { description } : {}) });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `---\n${front}---\n\n${body.trim()}\n`, "utf8");
  return { name, title, description, body: `${body.trim()}\n` };
}

export function deleteTour(cfg: Config, name: string): { name: string } {
  const path = tourPath(cfg, name);
  if (existsSync(path)) unlinkSync(path);
  return { name };
}
