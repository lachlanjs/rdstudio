// Small structured decisions: whether an edit is significant, and which step
// of a procedure an agent is on. The deterministic rules, a port of
// src/rdstudio/classify.py (an external command backend lives with the caller).

import { tokenize } from "./search.ts";
import { strip } from "./text.ts";

export interface Decision {
  choice: string | null;
  confidence: number;
  backend: string;
}

export interface Classifier {
  choose(question: string, options: string[], state: Record<string, unknown>): Decision;
}

// ------------------------------------------------------------ difflib

type Opcode = ["replace" | "delete" | "insert" | "equal", number, number, number, number];

/** Python's difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes(), with no junk. */
export function opcodes(a: readonly string[], b: readonly string[]): Opcode[] {
  const b2j = new Map<string, number[]>();
  b.forEach((x, j) => { if (!b2j.has(x)) b2j.set(x, []); b2j.get(x)!.push(j); });

  const longest = (alo: number, ahi: number, blo: number, bhi: number): [number, number, number] => {
    let besti = alo, bestj = blo, bestsize = 0;
    let j2len = new Map<number, number>();
    for (let i = alo; i < ahi; i++) {
      const next = new Map<number, number>();
      for (const j of b2j.get(a[i]!) ?? []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        next.set(j, k);
        if (k > bestsize) { besti = i - k + 1; bestj = j - k + 1; bestsize = k; }
      }
      j2len = next;
    }
    // Extend with equal neighbours (no junk here, so these only lengthen a match).
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) { besti--; bestj--; bestsize++; }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) bestsize++;
    return [besti, bestj, bestsize];
  };

  const blocks: [number, number, number][] = [];
  const queue: [number, number, number, number][] = [[0, a.length, 0, b.length]];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop()!;
    const [i, j, k] = longest(alo, ahi, blo, bhi);
    if (k) {
      blocks.push([i, j, k]);
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  blocks.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  const merged: [number, number, number][] = [];
  let [i1, j1, k1] = [0, 0, 0];
  for (const [i2, j2, k2] of blocks) {
    if (i1 + k1 === i2 && j1 + k1 === j2) k1 += k2;
    else { if (k1) merged.push([i1, j1, k1]); [i1, j1, k1] = [i2, j2, k2]; }
  }
  if (k1) merged.push([i1, j1, k1]);
  merged.push([a.length, b.length, 0]);

  const out: Opcode[] = [];
  let i = 0, j = 0;
  for (const [ai, bj, size] of merged) {
    const tag = i < ai && j < bj ? "replace" : i < ai ? "delete" : j < bj ? "insert" : null;
    if (tag) out.push([tag, i, ai, j, bj]);
    i = ai + size; j = bj + size;
    if (size) out.push(["equal", ai, i, bj, j]);
  }
  return out;
}

// ------------------------------------------------------------ rules

const norm = (text: string): string => strip(text.toLowerCase().replace(/[^\p{L}\p{N}_\s]/gu, "").replace(/\s+/gu, " "));

/** "minor" for formatting, punctuation, case or very small wording changes; "significant" otherwise. */
export function editSignificance(before: string, after: string): Decision {
  if (norm(before) === norm(after)) return { choice: "minor", confidence: 0.95, backend: "rules" };
  const a = tokenize(before), b = tokenize(after);
  const changed = opcodes(a, b).filter(([tag]) => tag !== "equal")
    .reduce((s, [, i1, i2, j1, j2]) => s + Math.max(i2 - i1, j2 - j1), 0);
  if (changed <= 3 && changed / Math.max(a.length, 1) < 0.05) return { choice: "minor", confidence: 0.7, backend: "rules" };
  return { choice: "significant", confidence: changed > 10 ? 0.8 : 0.6, backend: "rules" };
}

/** The step whose label shares the most words with `description`. */
export function matchStep(description: string, steps: Record<string, string>): Decision {
  // Tolerate inflection: "renamed" ~ "rename".
  const same = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
  const words = new Set(tokenize(description));
  let best: string | null = null, bestScore = 0;
  for (const [sid, label] of Object.entries(steps)) {
    const labelWords = new Set([...tokenize(label), ...tokenize(sid.replaceAll("-", " ").replaceAll("_", " "))]);
    if (!labelWords.size || !words.size) continue;
    const shared = [...words].filter((w) => [...labelWords].some((l) => same(w, l))).length;
    const score = shared / (words.size + labelWords.size - shared);
    if (score > bestScore) { best = sid; bestScore = score; }
  }
  return { choice: bestScore >= 0.34 ? best : null, confidence: Number(bestScore.toFixed(2)), backend: "rules" };
}

export class RulesClassifier implements Classifier {
  choose(question: string, _options: string[], state: Record<string, unknown>): Decision {
    if (question === "edit_significance") return editSignificance(String(state.before ?? ""), String(state.after ?? ""));
    if (question === "procedure_step") return matchStep(String(state.description ?? ""), (state.steps ?? {}) as Record<string, string>);
    return { choice: null, confidence: 0, backend: "rules" };
  }
}
