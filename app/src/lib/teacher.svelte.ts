// The teacher (T43): the agent's skills as you have them here, its profile,
// and its history, from the private teacher folder beside the learner
// record. Reached from the Learn tab and Settings, not the main navigation:
// customising how the agent teaches is possible, not encouraged.

import { deleteApiTeacherSkillsByName, getApiTeacher, getApiTeacherFilesByName, getApiTeacherSkillsByName, putApiTeacherFilesByName, putApiTeacherSkillsByName } from "./api/sdk.gen.ts";
import type { Skill, TeacherFile, TeacherState } from "./api/types.gen.ts";
import { learner, store } from "./data.svelte.ts";
import { RESULT_LABEL } from "./explain.ts";

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

  /** The profile or the sources log (null when the record is off, or on an older server). */
  async file(name: TeacherFile["name"]): Promise<TeacherFile | null> {
    if (store.site.static || !learner.enabled) return null;
    try {
      return (await getApiTeacherFilesByName({ path: { name } })).data ?? null;
    } catch {
      return null;
    }
  }

  async saveFile(name: TeacherFile["name"], text: string): Promise<TeacherFile> {
    const { data, error } = await putApiTeacherFilesByName({ path: { name }, body: { text }, headers: learner.writeHeaders() });
    if (!data) throw fail(error, "Not saved");
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

// ------------------------------------------------------------------ evidence
// The profile cites events from the learner record as [e:<id>]; each becomes
// a link to the event, labelled with what it was.

type Event = Record<string, unknown> & { id?: string };
const EVIDENCE_REF = /\[e:([0-9A-HJKMNP-TV-Z]{26})\]/g;
const titleOf = (id: unknown) => (typeof id === "string" ? store.concepts.get(id)?.title ?? id : "");
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

export interface Evidence {
  event: Event;
  /** A few words: what it was, and how it went. */
  label: string;
  result: string | null;
  /** The note or exercise it is about. */
  about: string | null;
  /** For an answer: its marking, if any; for a marking: the answer. */
  related: Event | null;
}

export function evidence(id: string): Evidence | null {
  const events = learner.events as Event[];
  const e = events.find((x) => x.id === id);
  if (!e) return null;
  const marking = (ref: string, kind: string) => events.findLast((x) => x.event === kind && x.ref === ref) ?? null;
  const res = (x: Event | null | undefined) => (x && typeof x.result === "string" ? x.result : null);
  switch (e.event) {
    case "attempt": {
      const m = res(e) ? null : marking(id, "attempt_marked");
      const r = res(e) ?? res(m);
      return { event: e, label: `${titleOf(e.exercise)}: ${e.gave_up ? "gave up" : r ? RESULT_LABEL[r] ?? r : "waiting"}`, result: r, about: String(e.exercise), related: m };
    }
    case "attempt_marked": {
      const a = events.find((x) => x.id === e.ref) ?? null;
      return { event: e, label: `${titleOf(a?.exercise)}: ${RESULT_LABEL[String(e.result)] ?? e.result}`, result: res(e), about: a ? String(a.exercise) : null, related: a };
    }
    case "explain": {
      const m = marking(id, "explain_marked");
      return { event: e, label: `Explained ${titleOf(e.concept)}: ${res(m) ? RESULT_LABEL[res(m)!] : "waiting"}`, result: res(m), about: String(e.concept), related: m };
    }
    case "explain_marked": {
      const a = events.find((x) => x.id === e.ref) ?? null;
      return { event: e, label: `Explained ${titleOf(e.concept)}: ${RESULT_LABEL[String(e.result)] ?? e.result}`, result: res(e), about: String(e.concept), related: a };
    }
    case "exercise":
      return { event: e, label: `${String(e.exercise)} on ${titleOf(e.concept)}: ${RESULT_LABEL[String(e.result)] ?? e.result}`, result: res(e), about: String(e.concept), related: null };
    case "mark":
      return { event: e, label: `Marked ${titleOf(e.concept)} ${String(e.state)}`, result: null, about: String(e.concept), related: null };
    case "seen":
      return { event: e, label: `Opened ${titleOf(e.concept)}`, result: null, about: String(e.concept), related: null };
    default:
      return { event: e, label: String(e.event), result: res(e), about: typeof e.concept === "string" ? e.concept : null, related: null };
  }
}

/** Rendered Markdown with its [e:<id>] citations turned into links to the evidence. */
export function linkEvidence(html: string): string {
  return html.replace(EVIDENCE_REF, (_all, id: string) => {
    const ev = evidence(id);
    if (!ev) return `<span class="ev-ref missing" title="Not in your learner record">${id.slice(-6)}</span>`;
    const when = typeof ev.event.at === "string" ? new Date(ev.event.at).toLocaleDateString() : "";
    return `<a class="ev-ref${ev.result ? " r-" + ev.result : ""}" href="#/teacher/evidence/${id}" title="${esc(`${ev.label}, ${when}`)}">${esc(ev.label)}</a>`;
  });
}
