// Streaks (T48) as the dashboard shows them: local days starting at 4 a.m.,
// worked out from the learner record by @rdstudio/core/learning.

import { isStudyNote, streaks, type Streak, type StreakKind } from "@rdstudio/core/learning";
import { learner, store } from "./data.svelte.ts";

const DAY = 86_400_000, SHIFT = 4 * 3_600_000;
/** Local days, starting at 4 a.m., numbered as days since 1970-01-01. */
export const dayOf = (ms: number): number => { const d = new Date(ms - SHIFT); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); };
export const dayStart = (n: number): number => { const u = new Date(n * DAY); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), 4).getTime(); };
export const dateOf = (n: number): string => new Date(n * DAY).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function currentStreaks(now = Date.now()): Record<StreakKind, Streak> {
  return streaks(learner.events, [...store.concepts.values()].filter(isStudyNote), now, { dayOf, dayStart, weekDays: learner.weekDays });
}

export const STREAK_NAME: Record<StreakKind, string> = { all: "All three", recall: "Recall", learning: "New learning", problems: "Problem solving" };
export const STREAK_WHAT: Record<StreakKind, string> = {
  all: "Recall, new learning and problem solving, the same day.",
  recall: "Practising the notes due for review. With nothing due, the day rests.",
  learning: "A note newly worked through or understood.",
  problems: "An exercise answered (giving up does not count).",
};
export const STREAK_ORDER: StreakKind[] = ["all", "recall", "learning", "problems"];
