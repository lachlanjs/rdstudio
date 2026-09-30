// Where the private learner record lives, and reading and writing it. The
// record's rules are in @rdstudio/core (record.ts); this is the file side,
// a port of src/rdstudio/learner.py.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { DEVICE_RE, cleanEvent, readRecord, sha256, type LearnerEvent } from "@rdstudio/core";
import { expandUser, readToml, userConfigPath, type Config, type Table } from "./config.ts";

export function settings(): Table {
  const s = readToml(userConfigPath()).learner;
  return typeof s === "object" && s !== null ? (s as Table) : {};
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
