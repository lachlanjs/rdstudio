// Small text helpers that must behave exactly like the Python core's, since
// the conformance fixtures compare the two byte for byte.

// Python's str.strip() whitespace (str.isspace), which differs from JavaScript's trim().
const WS = "\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const LEAD = new RegExp(`^[${WS}]+`, "u");
const TRAIL = new RegExp(`[${WS}]+$`, "u");

export const strip = (s: string): string => s.replace(LEAD, "").replace(TRAIL, "");
export const rstrip = (s: string): string => s.replace(TRAIL, "");

/** Compare by code point, as Python sorts strings. */
export function cmp(a: string, b: string): number {
  if (a === b) return 0;
  const x = [...a], y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i]!.codePointAt(0)! - y[i]!.codePointAt(0)!;
    if (d) return d;
  }
  return x.length - y.length;
}

/** Compare arrays of strings (or numbers) element by element, as Python compares tuples. */
export function cmpTuple(a: readonly (string | number)[], b: readonly (string | number)[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i]!, y = b[i]!;
    const d = typeof x === "number" && typeof y === "number" ? x - y : cmp(String(x), String(y));
    if (d) return d;
  }
  return a.length - b.length;
}

/** A frontmatter value as text: true/false, whole-number floats without ".0",
 *  nothing for null. */
export function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

// The date and time forms frontmatter may use (the Python core accepts the
// same): a date, or a date and time with optional seconds, fraction and
// offset; no offset means UTC.
const DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:([Zz])|([+-])(\d{2}):?(\d{2}))?)?$/;

/** Milliseconds since the epoch for a frontmatter time, or null when it is not one. */
export function toTime(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string") return null;
  const m = DATETIME.exec(strip(value));
  if (!m) return null;
  const [, y, mo, d, hh = "0", mm = "0", ss = "0", frac = "0", , sign, oh = "0", om = "0"] = m;
  const n = (s: string | undefined) => Number(s);
  const fields = [n(y), n(mo), n(d), n(hh), n(mm), n(ss)] as const;
  const [Y, M, D, H, Mi, S] = fields;
  // Reject what a calendar does not have (month 13, 31 June, hour 24).
  const probe = new Date(Date.UTC(Y, M - 1, D, H, Mi, S));
  if (Y < 1 || probe.getUTCFullYear() !== Y || probe.getUTCMonth() !== M - 1 || probe.getUTCDate() !== D
      || probe.getUTCHours() !== H || probe.getUTCMinutes() !== Mi || probe.getUTCSeconds() !== S) return null;
  const micro = Number(frac.slice(0, 6).padEnd(6, "0"));
  let t = probe.getTime() + Math.floor(micro / 1000);
  if (sign) {
    if (n(oh) > 23 || n(om) > 59) return null;
    const offset = (n(oh) * 60 + n(om)) * 60_000;
    t += sign === "+" ? -offset : offset;
  }
  return t;
}

/** ISO 8601 in UTC to the second, as the Python core writes times. */
export function iso(time: number): string {
  return new Date(Math.floor(time / 1000) * 1000).toISOString().replace(".000Z", "Z");
}

/** Decode %XX escapes as UTF-8, replacing invalid sequences (Python's unquote). */
export function unquote(s: string): string {
  if (!s.includes("%")) return s;
  const bytes: number[] = [];
  const enc = new TextEncoder();
  for (let i = 0; i < s.length; ) {
    if (s[i] === "%" && /^[0-9a-fA-F]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 3;
    } else {
      const cp = s.codePointAt(i)!;
      const ch = String.fromCodePoint(cp);
      bytes.push(...enc.encode(ch));
      i += ch.length;
    }
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

// ------------------------------------------------------------ paths (POSIX)

/** Python's posixpath.dirname. */
export function dirname(p: string): string {
  let head = p.slice(0, p.lastIndexOf("/") + 1);
  if (head && !/^\/+$/.test(head)) head = head.replace(/\/+$/, "");
  return head;
}

export function basename(p: string): string {
  return p.slice(p.lastIndexOf("/") + 1);
}

export function join(a: string, b: string): string {
  if (b.startsWith("/") || !a) return b;
  return a.endsWith("/") ? a + b : `${a}/${b}`;
}

/** Python's posixpath.normpath. */
export function normpath(p: string): string {
  if (!p) return ".";
  const initial = p.startsWith("/") ? (p.startsWith("//") && !p.startsWith("///") ? 2 : 1) : 0;
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (!part || part === ".") continue;
    if (part !== ".." || (!initial && !out.length) || out[out.length - 1] === "..") out.push(part);
    else if (out.length) out.pop();
  }
  const joined = "/".repeat(initial) + out.join("/");
  return joined || ".";
}

// ------------------------------------------------------------ hashing

/** SHA-256 as hex, synchronous and dependency-free, so the core runs anywhere. */
export function sha256(message: string): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const data = new TextEncoder().encode(message);
  const len = data.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(len / 0x20000000));
  view.setUint32(padded.length - 4, (len << 3) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!, b = w[i - 2]!;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as unknown as number[];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e!, 6) ^ rotr(e!, 11) ^ rotr(e!, 25);
      const ch = (e! & f!) ^ (~e! & g!);
      const t1 = (hh! + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a!, 2) ^ rotr(a!, 13) ^ rotr(a!, 22);
      const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d! + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0]! += a!; h[1]! += b!; h[2]! += c!; h[3]! += d!; h[4]! += e!; h[5]! += f!; h[6]! += g!; h[7]! += hh!;
  }
  return [...h].map((x) => x.toString(16).padStart(8, "0")).join("");
}

/** The version of a note that learner-record events refer to. */
export function contentHash(body: string): string {
  return sha256(strip(body)).slice(0, 12);
}
