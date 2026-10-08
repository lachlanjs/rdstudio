// The learner record: what a person has done to learn a project, one JSON
// event per line, only ever appended. Where the record
// lives and how it is written stay with the caller.
//
// Every event has an `id`, a ULID (a millisecond timestamp, then randomness,
// in 26 sortable characters), and the `device` that wrote it. Records from
// several devices merge as a union by id, in any order and as often as needed.

import { iso, sha256, toTime } from "./text.ts";

export const KINDS = ["autodidactic", "interactive", "ai"] as const;
export const MAX_EVENT_BYTES = 64 * 1024;
export const ID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
export const DEVICE_RE = /^[a-z0-9]{4,16}$/;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
// Python's str.splitlines() line boundaries.
const LINE_BREAKS = new RegExp("\\r\\n|[\\n\\r\\v\\f\\x1c\\x1d\\x1e\\x85\\u2028\\u2029]");

export type LearnerEvent = Record<string, unknown> & { id: string };

export class LearnerError extends Error {}

function encode(n: bigint, length: number): string {
  let out = "";
  for (let i = length - 1; i >= 0; i--) out += CROCKFORD[Number((n >> BigInt(5 * i)) & 31n)];
  return out;
}

const RANDOM_MASK = (1n << 80n) - 1n;
let last: [number, bigint] = [0, 0n]; // the last id's time and random part

function random80(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return bytes.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
}

/** A ULID. Within one millisecond the random part counts up, so ids from one
 *  device sort in the order they were made. */
export function newId(ms = Date.now()): string {
  const rand = ms === last[0] ? last[1] + 1n : random80();
  last = [ms, rand];
  return encode(BigInt(ms), 10) + encode(rand & RANDOM_MASK, 16);
}

/** A fixed id for an event written before events had ids: its time, and a
 *  hash of the line in place of randomness, so every device derives the same one. */
export function legacyId(line: string, at: unknown): string {
  const ms = toTime(typeof at === "string" ? at : null) ?? 0;
  return encode(BigInt(ms), 10) + encode(BigInt("0x" + sha256(line).slice(0, 20)), 16);
}

/** The events in one record's text, in the order written, each once (a retried
 *  write can repeat one); lines that do not parse are skipped. */
export function readRecord(text: string): LearnerEvent[] {
  const out: LearnerEvent[] = [];
  const seen = new Set<string>();
  for (const line of text.split(LINE_BREAKS)) {
    let e: unknown;
    try { e = JSON.parse(line); } catch { continue; }
    if (typeof e !== "object" || e === null || Array.isArray(e)) continue;
    const event = e as Record<string, unknown>;
    const withId: LearnerEvent = typeof event.id === "string"
      ? (event as LearnerEvent)
      : { id: legacyId(line, event.at), ...event };
    if (!seen.has(withId.id)) { seen.add(withId.id); out.push(withId); }
  }
  return out;
}

/** The union of several devices' records, by id, in time order. The same in
 *  any order and however often it is repeated. */
export function mergeRecords(...records: LearnerEvent[][]): LearnerEvent[] {
  const byId = new Map<string, LearnerEvent>();
  for (const record of records) for (const e of record) if (!byId.has(e.id)) byId.set(e.id, e);
  return [...byId.keys()].sort().map((k) => byId.get(k)!);
}

/** Check an event from a page or agent, and stamp it (id, time, device) for
 *  appending. Callers supply the device id and the time. */
export function cleanEvent(event: unknown, { device, now = Date.now() }: { device: string; now?: number }): LearnerEvent {
  if (typeof event !== "object" || event === null || Array.isArray(event)) throw new LearnerError("an event is a JSON object");
  const e = event as Record<string, unknown>;
  if (typeof e.event !== "string" || !e.event || e.event.length > 40) throw new LearnerError("an event needs an 'event' name");
  if (e.kind !== undefined && e.kind !== null && !(KINDS as readonly unknown[]).includes(e.kind)) {
    throw new LearnerError(`'kind' is one of ${KINDS.join(", ")}`);
  }
  if (e.id !== undefined && e.id !== null && !(typeof e.id === "string" && ID_RE.test(e.id))) {
    throw new LearnerError("'id' is a ULID (26 characters)");
  }
  if (e.device !== undefined && e.device !== null && !(typeof e.device === "string" && DEVICE_RE.test(e.device))) {
    throw new LearnerError("'device' is 4 to 16 lowercase letters and digits");
  }
  const { at: _at, id, device: dev, ...rest } = e;
  const out: LearnerEvent = { id: (id as string) || newId(now), at: iso(now), device: (dev as string) || device, ...rest };
  if (new TextEncoder().encode(JSON.stringify(out)).length > MAX_EVENT_BYTES) throw new LearnerError("event too large");
  return out;
}
