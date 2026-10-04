// Working together on one exercise (T51, laid out by T55): the asking (the
// tools above the answer) and the replies (the teacher's margin beside it)
// share this, so a reply streams into the margin while the tools wait.

import { askTutor, type Asking, type Mode, type Seen, type Turn } from "./tutor.ts";

export class TutorSession {
  turns = $state<Turn[]>([]);
  asking = $state<Mode | null>(null);
  streaming = $state("");
  error = $state("");
  /** What the teacher was given for the latest reply. */
  seen = $state<{ turn: string; seen: Seen[] } | null>(null);
  readonly exercise: string;

  constructor(exercise: string) { this.exercise = exercise; }

  get hints(): number { return this.turns.filter((t) => t.mode === "hint").length; }

  async ask(body: Asking): Promise<boolean> {
    this.asking = body.mode; this.streaming = ""; this.error = "";
    try {
      const r = await askTutor(this.exercise, body, (s) => { this.streaming = s; });
      this.turns = [...this.turns, r.turn];
      this.seen = { turn: r.turn.id, seen: r.seen };
      return true;
    } catch (err) {
      this.error = (err as Error).message;
      return false;
    } finally {
      this.asking = null;
    }
  }
}
