// What Axis may propose to the knowledge base from the Atlas (T101): a new
// note, a change to a note, a move. A second box of tools beside the lookups
// (agent.ts). Nothing here writes while it is asked: each call is checked
// against the base and kept as a proposal, which the person accepts or
// rejects one by one. An accepted proposal is applied by `apply`, through the
// same saving and moving the app's own edits use (edit.ts, reshape.ts), with
// the model named in the note's stamp.

import type { Bundle } from "@rdstudio/core";
import type { Toolbox } from "./agent.ts";
import { locate } from "./assist.ts";
import { noteSource, saveNote, type SaveResult } from "./edit.ts";
import { noteId, type Step } from "./lookup.ts";
import type { ToolDef } from "./models.ts";
import { moveNote, type MoveResult } from "./reshape.ts";
import { StoreError, conceptPath } from "./store.ts";

export type Proposal =
  | { kind: "create"; id: string; type: string; title: string; description: string; tags: string[]; body: string }
  /** Each `old` is text of the note, found in one place once the changes before it are made; an empty `old` adds `new` at the end. */
  | { kind: "change"; id: string; title: string; edits: { old: string; new: string }[] }
  | { kind: "move"; from: string; to: string; title: string; /** Notes whose links to it would be rewritten. */ links: number };

export const MAX_PROPOSALS = 12, MAX_BODY = 40_000;

const str = { type: "string" } as const;
const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[]): ToolDef => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } } });

export const TOOLS: ToolDef[] = [
  fn("propose_note", "Propose a new note. Nothing is written: the person sees it and accepts or rejects it. Give the whole note.",
    { id: { ...str, description: "Where it goes: a folder and a short name in lower case with hyphens, such as design/retry-policy. It must not exist." },
      type: { ...str, description: "The kind of note, as this base uses them: Design, Decision, Question, Task, Idea, Reference, Procedure and so on." },
      title: str, description: { ...str, description: "One sentence saying what the note holds." },
      tags: { type: "array", items: str }, body: { ...str, description: "The note's Markdown, without frontmatter. Link to other notes as [title](/path.md)." } }, ["id", "type", "title", "description", "body"]),
  fn("propose_change", "Propose a change to a note that exists. Nothing is written: the person sees what would change and accepts or rejects it. Read the note first. Several calls for one note are shown as one proposal.",
    { id: { ...str, description: "The note's id or path." },
      old: { ...str, description: "Text copied exactly from the note as you read it: whole lines or sentences, enough to be found in one place only. Leave it empty to add `new` at the end of the note." },
      new: { ...str, description: "What stands in its place. Empty deletes the text. To add after a line, give that line as `old`, and the line followed by the new text here." } }, ["id", "old", "new"]),
  fn("propose_move", "Propose moving or renaming a note. Nothing is moved: the person accepts or rejects it. Links to the note are rewritten when it is accepted.",
    { from: { ...str, description: "The note's id or path now." }, to: { ...str, description: "Its new id: a folder and a short name, such as decisions/retry-policy. It must not exist." } }, ["from", "to"]),
];

/** Said to the model where it may propose. */
export const HOW = `You may also propose changes to the knowledge base, with the tools
propose_note, propose_change and propose_move. Proposing writes nothing:
each proposal is shown to the person, who accepts or rejects it.

- Propose only what was asked for. A question that asks for no change gets
  an answer and no proposal.
- Look first. Search before proposing a new note, so that one which exists
  is changed and not written twice. Read a note before proposing a change
  to it: the text you replace is found by matching it exactly.
- A change is as small as it can be: the sentence or the lines, never the
  whole note in one.
- A new note is whole and in the base's own manner: its type, a title, one
  sentence of description, and a body that links to the notes it rests on.
- When a call is refused, the reply says why: put it right and call again,
  or leave it out and say so in the answer.
- In the answer, say in a sentence or two what you propose and why. Do not
  repeat the proposed text there: it is shown beside the answer.`;

const args = (raw: string): Record<string, unknown> => {
  try { const a = raw.trim() ? JSON.parse(raw) : {}; return typeof a === "object" && a !== null && !Array.isArray(a) ? a : {}; } catch { return {}; }
};
const text = (v: unknown) => (typeof v === "string" ? v : "");
const short = (t: string) => { const l = t.trim().split("\n")[0]!.trim(); return l.length > 60 ? l.slice(0, 57) + "…" : l; };

/** The proposals made in one request, checked as they are made against the base as it was when asked. */
export class Proposals implements Toolbox {
  readonly made: Proposal[] = [];
  /** Each changed note's body as it would stand with the changes proposed so far. */
  private bodies = new Map<string, string>();
  private readonly root: string;
  private readonly b: Bundle;

  constructor(root: string, b: Bundle) { this.root = root; this.b = b; }

  defs(): ToolDef[] { return TOOLS; }

  async call(name: string, raw: string): Promise<{ text: string; step: Step }> {
    // The step names no notes: the map marks what was looked up, and a proposal is shown beside the answer.
    const a = args(raw), step: Step = { tool: name, args: a, said: "", how: "propose", notes: [] };
    let out: string;
    try {
      if (this.made.length >= MAX_PROPOSALS && !(name === "propose_change" && this.made.some((p) => p.kind === "change" && p.id === noteId(this.b, a.id)))) throw new StoreError(`${MAX_PROPOSALS} proposals are the most for one request: say in the answer what is left to do`);
      out = name === "propose_note" ? this.create(a, step) : name === "propose_change" ? this.change(a, step) : name === "propose_move" ? this.move(a, step) : this.refuse(step, `There is no tool ${name}.`);
    } catch (err) { out = this.refuse(step, `That cannot be proposed: ${(err as Error).message}.`); }
    return { text: out, step };
  }

  private refuse(step: Step, why: string): string { step.failed = true; step.said = why; return why; }

  /** A new id, as the store would take it: its path checked, and nothing there or proposed there. */
  private fresh(raw: unknown): string {
    const path = conceptPath(this.root, text(raw)), id = path.slice(this.root.replace(/\/+$/, "").length + 1, -3);
    if (this.b.concepts.has(id) || this.made.some((p) => (p.kind === "create" && p.id === id) || (p.kind === "move" && p.to === id))) throw new StoreError(`${id} already exists`);
    if (!id.includes("/")) throw new StoreError("a note goes in a folder: give the id as folder/name");
    return id;
  }

  private create(a: Record<string, unknown>, step: Step): string {
    const id = this.fresh(a.id), type = text(a.type).trim(), title = text(a.title).trim(), description = text(a.description).trim().replace(/\s+/g, " ");
    const body = text(a.body).replace(/\r\n?/g, "\n").replace(/^---\n[\s\S]*?\n---\n+/, "").trim();
    if (!type) throw new StoreError("a note needs a type");
    if (!title) throw new StoreError("a note needs a title");
    if (!body) throw new StoreError("a note needs a body");
    if (body.length > MAX_BODY) throw new StoreError(`that note is too long (${body.length} characters; ${MAX_BODY} at most)`);
    const tags = Array.isArray(a.tags) ? [...new Set(a.tags.filter((t): t is string => typeof t === "string" && /^[\w.-]{1,40}$/.test(t.trim())).map((t) => t.trim()))].slice(0, 12) : [];
    this.made.push({ kind: "create", id, type, title, description, tags, body });
    step.said = `Proposed a new note: ${title} (${id})`;
    return `Proposed: a new note ${title} at /${id}.md. It is not written until the person accepts it.`;
  }

  private change(a: Record<string, unknown>, step: Step): string {
    const id = noteId(this.b, a.id);
    if (!id) {
      const made = this.made.find((p) => p.kind === "create" && p.id === text(a.id).replace(/^\/+/, "").replace(/\.md$/i, ""));
      throw new StoreError(made ? "that note is only proposed so far: give its whole text in propose_note" : `there is no note ${text(a.id)}`);
    }
    const c = this.b.concepts.get(id)!, old = text(a.old).replace(/\r\n?/g, "\n"), next = text(a.new).replace(/\r\n?/g, "\n");
    const now = this.bodies.get(id) ?? c.body;
    let after: string, kept: { old: string; new: string };
    if (!old.trim()) {
      if (!next.trim()) throw new StoreError("nothing to add: give the new text");
      after = now.replace(/\n*$/, "\n\n") + next.trim() + "\n";
      kept = { old: "", new: next.trim() };
    } else {
      const at = locate(now, old);
      if (at === "missing") throw new StoreError(`“${short(old)}” is not in ${c.title}: copy the text exactly as read_note gave it`);
      if (at === "many") throw new StoreError(`“${short(old)}” is in ${c.title} more than once: give more of the text round it`);
      // What is kept is the note's own text at that place, so that it is found again when the change is made.
      const was = now.slice(at.from, at.to), into = was === old ? next : next.trim();
      if (was === into) throw new StoreError("that changes nothing");
      after = now.slice(0, at.from) + into + now.slice(at.to);
      kept = { old: was, new: into };
    }
    if (after.length > MAX_BODY * 2) throw new StoreError("the note would be too long");
    this.bodies.set(id, after);
    const p = this.made.find((x): x is Extract<Proposal, { kind: "change" }> => x.kind === "change" && x.id === id);
    if (p) p.edits.push(kept); else this.made.push({ kind: "change", id, title: c.title, edits: [kept] });
    step.said = `Proposed a change to ${c.title}`;
    return `Proposed: a change to ${c.title} (/${id}.md). It is not made until the person accepts it.`;
  }

  private move(a: Record<string, unknown>, step: Step): string {
    const from = noteId(this.b, a.from);
    if (!from) throw new StoreError(`there is no note ${text(a.from)}`);
    if (this.made.some((p) => p.kind === "move" && p.from === from)) throw new StoreError(`a move of ${from} is already proposed`);
    const to = this.fresh(a.to), c = this.b.concepts.get(from)!;
    if (to === from) throw new StoreError("that is where it is");
    this.made.push({ kind: "move", from, to, title: c.title, links: this.b.backlinks(from).length });
    step.said = `Proposed moving ${c.title} to ${to}`;
    return `Proposed: ${c.title} moved from /${from}.md to /${to}.md. It is not moved until the person accepts it.`;
  }
}

// ------------------------------------------------------------------ accepting

/** A proposal as it came back from the page, checked: nothing in it is trusted but its shape. */
export function read(raw: unknown): Proposal {
  const p = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  if (p.kind === "create" && typeof p.id === "string" && typeof p.type === "string" && typeof p.title === "string" && typeof p.body === "string") {
    return { kind: "create", id: p.id, type: p.type, title: p.title, description: text(p.description), tags: Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === "string") : [], body: p.body };
  }
  if (p.kind === "change" && typeof p.id === "string" && Array.isArray(p.edits) && p.edits.length && p.edits.every((e) => typeof e === "object" && e !== null && typeof (e as { old?: unknown }).old === "string" && typeof (e as { new?: unknown }).new === "string")) {
    return { kind: "change", id: p.id, title: text(p.title), edits: (p.edits as { old: string; new: string }[]).map((e) => ({ old: e.old, new: e.new })) };
  }
  if (p.kind === "move" && typeof p.from === "string" && typeof p.to === "string") return { kind: "move", from: p.from, to: p.to, title: text(p.title), links: 0 };
  throw new StoreError("expected a proposal: {kind: create | change | move, …}");
}

/** A note's body with a change proposal's edits made, each found in its one place in the note as it is now. */
export function changed(body: string, edits: { old: string; new: string }[]): string {
  let now = body;
  for (const e of edits) {
    if (!e.old.trim()) {
      if (now.trimEnd().endsWith(e.new.trim())) throw new StoreError("that change is already made");
      now = now.replace(/\n*$/, "\n\n") + e.new.trim() + "\n";
      continue;
    }
    const at = locate(now, e.old);
    if (at === "missing") throw new StoreError(`the note has changed since this was proposed: “${short(e.old)}” is no longer in it`);
    if (at === "many") throw new StoreError(`the note has changed since this was proposed: “${short(e.old)}” is now in it more than once`);
    // New text that holds the old (a sentence added after one kept) still finds the old once it is made:
    // if the new text already stands there, the change was made before, and making it again would double it.
    const k = e.new.indexOf(now.slice(at.from, at.to));
    if (k >= 0 && now.slice(at.from - k, at.from - k + e.new.length) === e.new) throw new StoreError("that change is already made");
    now = now.slice(0, at.from) + e.new + now.slice(at.to);
  }
  return now;
}

export type Applied = { kind: "create" | "change"; id: string; saved: SaveResult } | { kind: "move"; id: string; moved: MoveResult };

/** Make an accepted proposal: the note written, changed or moved as the app's own edits are, the model named in its stamp. */
export function apply(root: string, raw: unknown, by: { actor: string; model: string }): Applied {
  const p = read(raw);
  if (p.kind === "create") {
    if (!p.type.trim() || !p.title.trim() || !p.body.trim()) throw new StoreError("a note needs a type, a title and a body");
    if (p.body.length > MAX_BODY) throw new StoreError("that note is too long");
    const meta: Record<string, unknown> = { type: p.type.trim(), title: p.title.trim(), ...(p.description.trim() ? { description: p.description.trim() } : {}), ...(p.tags.length ? { tags: p.tags } : {}) };
    const saved = saveNote(root, p.id, { actor: by.actor, base: null, body: p.body, meta, assist: [by.model] });
    return { kind: "create", id: saved.note.id, saved };
  }
  if (p.kind === "change") {
    const src = noteSource(root, p.id);
    // The body as it is in the file, with its own line ends put to \n, as the editor has it.
    const saved = saveNote(root, p.id, { actor: by.actor, base: src.version, body: changed(src.body.replace(/\r\n/g, "\n"), p.edits), assist: [by.model] });
    if (!saved.changed) throw new StoreError("that change is already made");
    return { kind: "change", id: saved.note.id, saved };
  }
  // A move changes no text, so the note's stamp is left as it is.
  const moved = moveNote(root, p.from, p.to);
  return { kind: "move", id: p.to.replace(/^\/+/, "").replace(/\.md$/i, ""), moved };
}
