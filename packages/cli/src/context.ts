// What the teacher is given for a request (T50): named sections, each with a
// token budget, shortened to fit, assembled into messages; and a report of
// exactly what was sent, for "What the teacher sees". Tokens are estimated at
// four characters each, which is near enough for budgets.

import { ModelError, type Message } from "./models.ts";

export interface Section {
  name: string; // "Skill", "Exercise", "Notes", "Your draft", …
  text: string;
  /** At most this many tokens (estimated); longer text is shortened. */
  tokens: number;
  role?: "system" | "user";
  /** Ask the provider to cache everything up to and including this section. */
  cache?: boolean;
  /** Never shortened to meet an input limit (T110): instructions, the person's own words, text that must come back exact. */
  keep?: boolean;
}

export interface Seen {
  name: string;
  role: "system" | "user";
  tokens: number;
  shortened: boolean;
  text: string;
}

export const estimate = (text: string): number => Math.ceil(text.length / 4);
const MARK = "\n[…shortened to fit]";

/** Shorten to about `tokens`, at a paragraph or line break where there is one. */
export function shorten(text: string, tokens: number): { text: string; shortened: boolean } {
  const max = tokens * 4;
  if (text.length <= max) return { text, shortened: false };
  const room = Math.max(0, max - MARK.length);
  let cut = text.lastIndexOf("\n\n", room);
  if (cut < room * 0.6) cut = text.lastIndexOf("\n", room);
  if (cut < room * 0.6) cut = room;
  return { text: text.slice(0, cut).trimEnd() + MARK, shortened: true };
}

/** The least a section is cut to for an input limit: under this it says nothing useful. */
const LEAST = 120;

/** A message's size, as the limits count it. */
export const size = (m: Message): number => estimate(typeof m.content === "string" ? m.content : m.content.map((p) => p.text).join("\n\n")) + (m.calls ?? []).reduce((n, c) => n + estimate(c.name + c.arguments), 0);

/** Put the sections together. With `limit` (T110), the whole is kept to that many tokens: the sections not marked
 *  `keep` are shortened in proportion until it fits, and it is refused if what must be kept is more than the limit. */
export function assemble(sections: Section[], limit?: number | null): { messages: Message[]; seen: Seen[] } {
  const parts = sections.filter((s) => s.text.trim()).map((s) => {
    const { text, shortened } = shorten(s.text.trim(), s.tokens);
    return { s, body: `## ${s.name}\n\n${text}`, shortened };
  });
  if (limit) {
    const total = parts.reduce((n, p) => n + estimate(p.body), 0);
    if (total > limit) {
      const kept = parts.filter((p) => p.s.keep).reduce((n, p) => n + estimate(p.body), 0), loose = parts.filter((p) => !p.s.keep);
      const room = limit - kept;
      if (room < loose.length * LEAST) throw new ModelError(`This request is larger than the input limit set for its tier: about ${kept + loose.length * LEAST} tokens must be sent, and the limit is ${limit}. Raise the limit (the Teacher page, Limits), mark less of the note, or ask at another tier.`, 400);
      // Each loose section in proportion to its size; one that would fall under the least gets the least
      // (or stays whole, if it is smaller), and the others share what is left.
      const give = new Map<(typeof parts)[number], number>();
      let free = loose, left = room;
      for (let again = true; again;) {
        again = false;
        const each = left / Math.max(1, free.reduce((n, p) => n + estimate(p.body), 0));
        for (const p of free) {
          const now = estimate(p.body);
          if (now * each >= LEAST) continue;
          give.set(p, Math.min(now, LEAST)); left -= Math.min(now, LEAST); free = free.filter((x) => x !== p); again = true;
          break;
        }
        if (!again) for (const p of free) give.set(p, Math.floor(estimate(p.body) * each));
      }
      for (const p of loose) {
        const most = give.get(p)!;
        if (most >= estimate(p.body)) continue; // small enough to stay whole
        const head = `## ${p.s.name}\n\n`, cut = shorten(p.body.slice(head.length), Math.max(1, Math.floor((most * 4 - head.length) / 4)));
        p.body = head + cut.text; p.shortened ||= cut.shortened;
      }
    }
  }
  const seen: Seen[] = [];
  const messages: Message[] = [];
  for (const { s, body, shortened } of parts) {
    const role = s.role ?? "system";
    seen.push({ name: s.name, role, tokens: estimate(body), shortened, text: body });
    const last = messages.at(-1);
    if (last && last.role === role && Array.isArray(last.content)) last.content.push({ text: body, ...(s.cache ? { cache: true } : {}) });
    else messages.push({ role, content: [{ text: body, ...(s.cache ? { cache: true } : {}) }] });
  }
  return { messages, seen };
}
