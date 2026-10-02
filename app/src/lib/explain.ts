// Explain-back (T28): answers you write in the dashboard wait in the learner
// record until an agent marks them (the explain-back skill, through the MCP
// tools); the dashboard never calls a model. Questions an agent set wait here
// too. Read from the record's events.

import { learner } from "./data.svelte.ts";

type Event = Record<string, unknown> & { id?: string };

export interface Answer {
  id: string;
  concept: string;
  question: string | null;
  answer: string;
  at: string;
  marked: { result: string; feedback: string; gaps: string[]; at: string } | null;
}

export interface Question {
  id: string;
  concept: string;
  question: string;
  at: string;
}

/** Every explain-back answer, newest first, with its marking if it has one. */
export function answers(concept?: string): Answer[] {
  const marks = new Map<string, Event>();
  for (const e of learner.events as Event[]) if (e.event === "explain_marked" && typeof e.ref === "string") marks.set(e.ref, e);
  return (learner.events as Event[])
    .filter((e) => e.event === "explain" && typeof e.id === "string" && (!concept || e.concept === concept))
    .map((e) => {
      const m = marks.get(e.id!);
      return {
        id: e.id!, concept: String(e.concept), question: typeof e.question === "string" ? e.question : null, answer: String(e.answer ?? ""), at: String(e.at),
        marked: m ? { result: String(m.result), feedback: String(m.feedback ?? ""), gaps: Array.isArray(m.gaps) ? m.gaps.map(String) : [], at: String(m.at) } : null,
      };
    })
    .reverse();
}

/** Questions set by an agent that you have not answered yet, oldest first. */
export function openQuestions(concept?: string): Question[] {
  const answered = new Set((learner.events as Event[]).filter((e) => e.event === "explain" && typeof e.question === "string").map((e) => `${e.concept}\n${e.question}`));
  return (learner.events as Event[])
    .filter((e) => e.event === "question" && typeof e.question === "string" && (!concept || e.concept === concept) && !answered.has(`${e.concept}\n${e.question}`))
    .map((e) => ({ id: String(e.id), concept: String(e.concept), question: String(e.question), at: String(e.at) }));
}

export async function submit(concept: string, answer: string, question: string | null): Promise<boolean> {
  return (await learner.record({ event: "explain", concept, answer: answer.trim(), ...(question ? { question } : {}), kind: "ai" })) !== null;
}

export const RESULT_LABEL: Record<string, string> = { got: "Got it", partly: "Partly", missed: "Missed" };
