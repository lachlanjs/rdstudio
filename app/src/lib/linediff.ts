// A line diff of two texts, for comparing a customised skill with rdstudio's
// default (and later, any two versions of a teacher file).

export type DiffLine = { kind: "add" | "del" | "same" | "hunk"; text: string };

/** A line diff of two texts (longest common subsequence), with unchanged
 *  runs beyond `context` lines of a change folded into a hunk marker. */
export function lineDiff(a: string, b: string, context = 2): DiffLine[] {
  const x = a.replace(/\n$/, "").split("\n"), y = b.replace(/\n$/, "").split("\n");
  const n = x.length, m = y.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i]![j] = x[i] === y[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const all: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) { all.push({ kind: "same", text: x[i]! }); i++; j++; }
    // Removals before additions, as in a unified diff.
    else if (i < n && (j === m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) { all.push({ kind: "del", text: x[i]! }); i++; }
    else { all.push({ kind: "add", text: y[j]! }); j++; }
  }
  const near = all.map((_, k) => all.slice(Math.max(0, k - context), k + context + 1).some((l) => l.kind !== "same"));
  const out: DiffLine[] = [];
  all.forEach((l, k) => {
    if (near[k]) out.push(l);
    else if (out.at(-1)?.kind !== "hunk") out.push({ kind: "hunk", text: "" });
  });
  return out;
}
