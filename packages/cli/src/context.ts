// What the teacher is given for a request (T50): named sections, each with a
// token budget, shortened to fit, assembled into messages; and a report of
// exactly what was sent, for "What the teacher sees". Tokens are estimated at
// four characters each, which is near enough for budgets.

import type { Message } from "./models.ts";

export interface Section {
  name: string; // "Skill", "Exercise", "Notes", "Your draft", …
  text: string;
  /** At most this many tokens (estimated); longer text is shortened. */
  tokens: number;
  role?: "system" | "user";
  /** Ask the provider to cache everything up to and including this section. */
  cache?: boolean;
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

export function assemble(sections: Section[]): { messages: Message[]; seen: Seen[] } {
  const seen: Seen[] = [];
  const messages: Message[] = [];
  for (const s of sections) {
    if (!s.text.trim()) continue;
    const role = s.role ?? "system";
    const { text, shortened } = shorten(s.text.trim(), s.tokens);
    const body = `## ${s.name}\n\n${text}`;
    seen.push({ name: s.name, role, tokens: estimate(body), shortened, text: body });
    const last = messages.at(-1);
    if (last && last.role === role && Array.isArray(last.content)) last.content.push({ text: body, ...(s.cache ? { cache: true } : {}) });
    else messages.push({ role, content: [{ text: body, ...(s.cache ? { cache: true } : {}) }] });
  }
  return { messages, seen };
}
