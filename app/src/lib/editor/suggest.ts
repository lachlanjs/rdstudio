// Suggestions (T74, T98): text a model proposes for places in the note, shown
// in the editor before anything changes. What each would replace is struck
// through, the proposed text follows it, and it is accepted (Mod-Enter) or
// rejected (Escape) there: the one the cursor is nearest. There may be
// several at once, apart from one another; each keeps its place as the note
// is edited round it.

import { Facet, StateEffect, StateField, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, keymap, type DecorationSet } from "@codemirror/view";

export interface Suggestion {
  /** Tells one from another where there are several; given one when it is shown. */
  id?: string;
  from: number;
  to: number;
  insert: string; // "" proposes that from..to be deleted
  model: string;
}

/** Show these suggestions, in place of any there are. */
export const setSuggestions = StateEffect.define<Suggestion[]>();
const dropSuggestion = StateEffect.define<string>();
/** Told when a suggestion is accepted or rejected. */
export const suggestionHandler = Facet.define<(what: "accepted" | "rejected", s: Suggestion) => void>();

const isBlock = (s: Suggestion) => s.insert.includes("\n") || s.insert.startsWith("```") || /^!\[[^\]]*\]\([^)]+\)$/.test(s.insert.trim());

/** The text as it goes in: a block (several lines, or a fence) stands clear of the text round it by a blank line. */
export function placed(doc: string, s: Suggestion): string {
  // A block: several lines, a fence, or a line that is one picture or one embedded artifact.
  if (!isBlock(s)) return s.insert;
  const before = doc.slice(Math.max(0, s.from - 2), s.from), after = doc.slice(s.to, s.to + 2);
  const lead = s.from === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const tail = s.to >= doc.length || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  return lead + s.insert.replace(/\n+$/, "") + tail;
}

const all = (view: EditorView): Suggestion[] => view.state.field(suggestField, false) ?? [];
/** The suggestion meant: the one named, else the one the cursor is in or nearest. */
function pick(view: EditorView, id?: string): Suggestion | null {
  const list = all(view);
  if (id !== undefined) return list.find((s) => s.id === id) ?? null;
  const at = view.state.selection.main.head;
  const far = (s: Suggestion) => (at < s.from ? s.from - at : at > s.to ? at - s.to : 0);
  return list.reduce<Suggestion | null>((best, s) => (!best || far(s) < far(best) ? s : best), null);
}
const tell = (view: EditorView, what: "accepted" | "rejected", s: Suggestion) => { for (const f of view.state.facet(suggestionHandler)) f(what, s); };

export function acceptSuggestion(view: EditorView, id?: string): boolean {
  const s = pick(view, id);
  if (!s) return false;
  const insert = placed(view.state.doc.toString(), s);
  view.dispatch({ changes: { from: s.from, to: s.to, insert }, selection: { anchor: s.from + insert.length }, effects: dropSuggestion.of(s.id!), userEvent: "input.suggest", scrollIntoView: true });
  tell(view, "accepted", s);
  view.focus();
  return true;
}

export function rejectSuggestion(view: EditorView, id?: string): boolean {
  const s = pick(view, id);
  if (!s) return false;
  view.dispatch({ effects: dropSuggestion.of(s.id!) });
  tell(view, "rejected", s);
  view.focus();
  return true;
}

/** Accept every suggestion there is, as one change (one step to undo). */
export function acceptAll(view: EditorView): boolean {
  const list = all(view);
  if (!list.length) return false;
  const doc = view.state.doc.toString();
  view.dispatch({ changes: list.map((s) => ({ from: s.from, to: s.to, insert: placed(doc, s) })), effects: setSuggestions.of([]), userEvent: "input.suggest" });
  for (const s of list) tell(view, "accepted", s);
  return true;
}

export function rejectAll(view: EditorView): boolean {
  const list = all(view);
  if (!list.length) return false;
  view.dispatch({ effects: setSuggestions.of([]) });
  for (const s of list) tell(view, "rejected", s);
  return true;
}

class Proposed extends WidgetType {
  constructor(readonly s: Suggestion, readonly block: boolean) { super(); }
  eq(o: Proposed) { return o.s.id === this.s.id && o.s.insert === this.s.insert && o.block === this.block && o.s.model === this.s.model; }
  toDOM(view: EditorView) {
    const el = document.createElement(this.block ? "div" : "span");
    el.className = "cm-suggest" + (this.block ? " block" : "") + (this.s.insert ? "" : " gone");
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", this.s.insert ? "Suggested text" : "Suggested deletion");
    el.dataset.suggestion = this.s.id ?? "";
    const text = document.createElement(this.block ? "pre" : "span");
    text.className = "cm-suggest-text";
    text.textContent = this.s.insert || "Delete this";
    const bar = document.createElement("span");
    bar.className = "cm-suggest-bar";
    const button = (label: string, title: string, run: () => void, primary = false) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = label; b.title = title;
      b.className = "toggle" + (primary ? " primary" : "");
      b.addEventListener("mousedown", (e) => e.preventDefault()); // the editor keeps the focus
      b.addEventListener("click", run);
      return b;
    };
    const id = this.s.id;
    bar.append(button("Accept", "Put this in the note (Ctrl+Enter)", () => acceptSuggestion(view, id), true), button("Reject", "Leave the note as it is (Esc)", () => rejectSuggestion(view, id)));
    el.append(text, bar);
    return el;
  }
  ignoreEvent() { return true; }
}

let made = 0;
const suggestField = StateField.define<Suggestion[]>({
  create: () => [],
  update(value, tr) {
    let list = value;
    if (list.length && tr.docChanged) {
      list = list.map((s) => { const from = tr.changes.mapPos(s.from, 1), to = Math.max(from, tr.changes.mapPos(s.to, -1)); return from === s.from && to === s.to ? s : { ...s, from, to }; });
    }
    for (const e of tr.effects) {
      if (e.is(dropSuggestion)) list = list.filter((s) => s.id !== e.value);
      else if (e.is(setSuggestions)) {
        const end = tr.state.doc.length;
        list = e.value.map((s) => ({ ...s, id: s.id ?? `s${++made}`, from: Math.min(s.from, end), to: Math.min(Math.max(s.from, s.to), end) })).sort((a, b) => a.from - b.from || a.to - b.to);
      }
    }
    return list;
  },
  provide: (f) => EditorView.decorations.from(f, (list): DecorationSet => {
    const marks: Range<Decoration>[] = [];
    for (const s of list) {
      const block = isBlock(s);
      if (s.to > s.from) marks.push(Decoration.mark({ class: "cm-suggest-old" }).range(s.from, s.to));
      marks.push(Decoration.widget({ widget: new Proposed(s, block), side: 1, block }).range(s.to));
    }
    return Decoration.set(marks, true);
  }),
});

/** The suggestions waiting in the editor, in the order of the text. */
export const pendingSuggestions = (view: EditorView): Suggestion[] => all(view);
/** The first of them, if there is one. */
export const pendingSuggestion = (view: EditorView): Suggestion | null => all(view)[0] ?? null;

const suggestTheme = EditorView.theme({
  ".cm-suggest-old": { textDecoration: "line-through", textDecorationColor: "var(--stale)", background: "color-mix(in srgb, var(--stale) 12%, transparent)" },
  ".cm-suggest": { background: "color-mix(in srgb, var(--reviewed) 13%, transparent)", borderLeft: "3px solid var(--reviewed)", borderRadius: "2px", padding: "1px 6px", margin: "0 2px" },
  ".cm-suggest.block": { display: "block", margin: "8px 0", padding: "8px 12px" },
  ".cm-suggest.gone": { background: "color-mix(in srgb, var(--stale) 10%, transparent)", borderLeftColor: "var(--stale)" },
  ".cm-suggest.gone .cm-suggest-text": { color: "var(--ink-faint)", fontStyle: "italic" },
  ".cm-suggest-text": { whiteSpace: "pre-wrap", font: "inherit", margin: "0", color: "var(--ink)" },
  ".cm-suggest.block .cm-suggest-text": { fontFamily: "var(--font-mono)", fontSize: "14px", lineHeight: "1.55" },
  ".cm-suggest-bar": { display: "inline-flex", gap: "6px", marginLeft: "10px", verticalAlign: "middle" },
  ".cm-suggest.block .cm-suggest-bar": { display: "flex", margin: "8px 0 0" },
  ".cm-suggest-bar .toggle": { minHeight: "26px", padding: "2px 10px", fontSize: "13px" },
});

export const suggestions: Extension = [
  suggestField,
  suggestTheme,
  keymap.of([{ key: "Mod-Enter", run: (v) => acceptSuggestion(v) }, { key: "Escape", run: (v) => rejectSuggestion(v) }]),
];
