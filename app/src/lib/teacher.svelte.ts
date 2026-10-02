// The teacher (T43): the agent's skills as you have them here, its profile,
// and its history, from the private teacher folder beside the learner
// record. Reached from the Learn tab and Settings, not the main navigation:
// customising how the agent teaches is possible, not encouraged.

import { deleteApiTeacherSkillsByName, getApiTeacher, getApiTeacherSkillsByName, putApiTeacherSkillsByName } from "./api/sdk.gen.ts";
import type { Skill, TeacherState } from "./api/types.gen.ts";
import { learner, store } from "./data.svelte.ts";

export const PROFILE_LABEL: Record<TeacherState["profile"], string> = {
  topic: "Learning a topic",
  codebase: "Learning a codebase",
  project: "Starting a project",
};

const fail = (error: unknown, fallback: string) => new Error((error as { error?: string } | undefined)?.error ?? fallback);

class Teacher {
  state = $state.raw<TeacherState | null>(null);
  loaded = $state(false);

  async load(): Promise<void> {
    if (store.site.static) { this.loaded = true; return; }
    try {
      this.state = (await getApiTeacher()).data ?? null;
    } catch { /* an older server */ }
    this.loaded = true;
  }

  async skill(name: string): Promise<Skill | null> {
    if (store.site.static) return null;
    try {
      return (await getApiTeacherSkillsByName({ path: { name } })).data ?? null;
    } catch {
      return null;
    }
  }

  async save(name: string, text: string): Promise<Skill> {
    const { data, error } = await putApiTeacherSkillsByName({ path: { name }, body: { text }, headers: learner.writeHeaders() });
    if (!data) throw fail(error, "The skill was not saved");
    void this.load();
    return data;
  }

  /** Back to rdstudio's default; null when it was a skill of your own (now gone). */
  async reset(name: string): Promise<Skill | null> {
    const { data, error } = await deleteApiTeacherSkillsByName({ path: { name }, headers: learner.writeHeaders() });
    if (!data) throw fail(error, "The skill was not reset");
    void this.load();
    return data.skill;
  }
}

export const teacher = new Teacher();
