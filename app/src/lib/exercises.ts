// Goals and exercises (T44). An Exercise note is answered in the dashboard:
// a choice or a value is checked here; a text answer is marked by you against
// the solution, or waits for an agent (the exercise skill, through MCP). A Goal
// note states an outcome; its progress is the notes it requires (and what
// those require) and the exercises that name it. All read from the private
// learner record by @rdstudio/core/learning.

import type { ConceptRecord } from "@rdstudio/core";
import { answerSpec, assignments, attempts, exerciseStatus, goalProgress, needsMarking, refIds, type Assignment, type Attempt, type ExerciseStatus, type GoalProgress, type Result } from "@rdstudio/core/learning";
import { learner, store } from "./data.svelte.ts";
import { understanding } from "./understanding.svelte.ts";

export const STATUS_LABEL: Record<ExerciseStatus, string> = {
  untried: "Not tried",
  waiting: "Waiting for marking",
  missed: "Missed",
  partly: "Partly",
  passed: "Passed",
};
export const BY_LABEL = (by: string | null): string =>
  by === "dashboard" ? "checked here" : by === "self" ? "marked by you" : by ? `marked by ${by.replace(/^[^:]*:/, "")}` : "waiting for marking";

const byTitle = (a: ConceptRecord, b: ConceptRecord) => a.title.localeCompare(b.title);
export const exerciseNotes = (): ConceptRecord[] => [...store.concepts.values()].filter((c) => c.type === "Exercise").sort(byTitle);
export const goalNotes = (): ConceptRecord[] => [...store.concepts.values()].filter((c) => c.type === "Goal").sort(byTitle);

/** The notes an exercise tests, that exist. */
export const testsOf = (c: ConceptRecord): string[] => refIds(c.meta?.tests, c.directory).filter((id) => store.concepts.has(id));
/** The goals an exercise serves, that exist. */
export const goalsOf = (c: ConceptRecord): string[] => refIds(c.meta?.goals, c.directory).filter((id) => store.concepts.get(id)?.type === "Goal");
export const exercisesFor = (goal: string): ConceptRecord[] => exerciseNotes().filter((c) => goalsOf(c).includes(goal));
export const exercisesTesting = (note: string): ConceptRecord[] => exerciseNotes().filter((c) => testsOf(c).includes(note));

export const spec = (c: ConceptRecord) => answerSpec(c.meta);

/** Every attempt at each exercise, with markings. */
export const tried = (): Map<string, Attempt[]> => attempts(learner.events);
export const statusOf = (id: string, all = tried()): ExerciseStatus => exerciseStatus(all.get(id));

export function progressOf(goal: ConceptRecord): GoalProgress {
  return goalProgress(goal.requires, (id) => store.concepts.get(id)?.requires, exercisesFor(goal.id).map((c) => c.id), understanding.states, tried());
}

/** Answers waiting for an agent, newest first. */
export const waiting = (): Attempt[] => [...tried().values()].flat().filter(needsMarking).sort((a, b) => (a.at < b.at ? 1 : -1));

/** Record an answer: settled here (`result` and `by`), or left for an agent;
 *  with the working behind it, sent for review or not. Its id, or null. */
export async function submitAttempt(ex: ConceptRecord, answer: string, settled: { result: Result; by: "dashboard" | "self"; gaveUp?: boolean } | null,
  shown: { working: string; review: boolean } = { working: "", review: false }, help: { hint: number; feedback: number; discuss: number } | null = null): Promise<string | null> {
  const tests = testsOf(ex);
  const hashes = Object.fromEntries(tests.map((id) => [id, store.concepts.get(id)!.hash]));
  const event = {
    event: "attempt", exercise: ex.id, tests, hashes, answer,
    ...(settled ? { result: settled.result, by: settled.by, ...(settled.gaveUp ? { gave_up: true } : {}) } : {}),
    ...(shown.working.trim() ? { working: shown.working.trim(), ...(shown.review ? { review: true } : {}) } : {}),
    ...(help && help.hint + help.feedback + help.discuss ? { help } : {}),
    kind: settled && !(shown.review && shown.working.trim()) ? "interactive" : "ai",
  };
  const stored = await learner.record(event);
  return typeof stored?.id === "string" ? stored.id : null;
}

/** Send the working behind an answer already checked, for review. */
export async function requestReview(ref: string, working: string): Promise<boolean> {
  return (await learner.record({ event: "review_requested", ref, working: working.trim(), kind: "ai" })) !== null;
}

/** Settle a waiting answer yourself, against the solution. The answer's own
 *  event is kept; the marking is a second event, as an agent's would be. */
export async function markYourself(ref: string, result: Result): Promise<boolean> {
  return (await learner.record({ event: "attempt_marked", ref, result, by: "self", kind: "interactive" })) !== null;
}

/** Sets of exercises an agent set for you, newest first; open ones have something left to do. */
export const sets = (): Assignment[] => (learner.enabled ? assignments(learner.events, tried()) : []);
export const openSets = (): Assignment[] => sets().filter((a) => !a.closed);
/** How many exercises are set for you and not yet answered: the Learn tab's count. */
export const setCount = (): number => openSets().reduce((n, a) => n + a.exercises.length - a.done.length, 0);

/** Put a set aside without answering the rest. */
export async function putAside(ref: string): Promise<boolean> {
  return (await learner.record({ event: "assigned_closed", ref, kind: "ai" })) !== null;
}
