// JSON written exactly as Python's json.dumps writes it (ASCII escapes, ", " and
// ": " separators, or an indent), so the Node and Python command lines print
// the same bytes while both exist.

/** A number Python holds as a float, so it prints as one (2.0, 1e-05). */
export class PyFloat {
  readonly value: number;
  constructor(value: number) { this.value = value; }
}

/** Python's repr() of a float. */
export function floatRepr(x: number): string {
  if (!Number.isFinite(x)) return Number.isNaN(x) ? "NaN" : x > 0 ? "Infinity" : "-Infinity";
  const a = Math.abs(x);
  if (x !== 0 && (a >= 1e16 || a < 1e-4)) {
    return x.toExponential().replace(/e([+-])(\d)$/, "e$10$2");
  }
  return Number.isInteger(x) ? `${x.toFixed(0)}.0` : String(x);
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
