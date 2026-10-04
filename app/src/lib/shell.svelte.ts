// The shell's own state (T53): whether the command palette is open, and the
// project's mode (Learning or Project), shown as a tag beside its name.

import { store } from "./data.svelte.ts";
import { teacher } from "./teacher.svelte.ts";

export const palette = $state({ open: false });

/** Learning for a topic, Project for a codebase or a project being started
 *  (from the teacher's profile until projects say so themselves, T59). */
export function projectMode(): "Learning" | "Project" | null {
  if (store.site.static) return null;
  const p = teacher.state?.profile;
  return !p ? null : p === "topic" ? "Learning" : "Project";
}
