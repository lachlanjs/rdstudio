// JSON written exactly as Python's json.dumps writes it (ASCII escapes, ", " and
// ": " separators, or an indent), so the Node and Python command lines print
// the same bytes while both exist.

/** A number Python holds as a float, so it prints as one (2.0, 1e-05). */
import { floatRepr, pyRepr as coreRepr } from "@rdstudio/core";

export { floatRepr };

export class PyFloat {
  readonly value: number;
  constructor(value: number) { this.value = value; }
}

export function pyDumps(value: unknown, { indent, ensureAscii = true }: { indent?: number; ensureAscii?: boolean } = {}): string {
  const esc = (s: string): string => {
    let out = JSON.stringify(s);
    if (ensureAscii) out = out.replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
    return out;
  };
  const walk = (v: unknown, depth: number): string => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : v > 0 ? "Infinity" : v < 0 ? "-Infinity" : "NaN";
    if (typeof v === "string") return esc(v);
    if (v instanceof PyFloat) return floatRepr(v.value);
    const pad = indent === undefined ? "" : "\n" + " ".repeat(indent * (depth + 1));
    const end = indent === undefined ? "" : "\n" + " ".repeat(indent * depth);
    const sep = indent === undefined ? ", " : ",";
    if (Array.isArray(v)) {
      if (!v.length) return "[]";
      return "[" + v.map((x) => pad + walk(x, depth + 1)).join(sep) + end + "]";
    }
    const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
    if (!entries.length) return "{}";
    return "{" + entries.map(([k, x]) => pad + esc(k) + ": " + walk(x, depth + 1)).join(sep) + end + "}";
  };
  return walk(value, 0);
}

/** Python's repr(), for values that may be marked as floats. */
export const pyRepr = (v: unknown): string => (v instanceof PyFloat ? floatRepr(v.value) : coreRepr(v));

/** Python's str(): text as is, anything else as repr() shows it. */
export const pyStr = (v: unknown): string => (typeof v === "string" ? v : pyRepr(v));
