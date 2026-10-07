// A suggestion (T74): text a model proposes for a place in the note, shown in
// the editor before anything changes. What it would replace is struck
// through, the proposed text follows it, and it is accepted (Mod-Enter) or
// rejected (Escape) there. There is one at a time; it keeps its place as the
// note is edited round it.

import { Facet, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, keymap, type DecorationSet } from "@codemirror/view";

export interface Suggestion {
  from: number;
  to: number;
  insert: string;
  model: string;
}

export const setSuggestion = StateEffect.define<Suggestion | null>();
/** Told when a suggestion is accepted or rejected. */
export const suggestionHandler = Facet.define<(what: "accepted" | "rejected", s: Suggestion) => void>();

/** The text as it goes in: a block (several lines, or a fence) stands clear of the text round it by a blank line. */
export function placed(doc: string, s: Suggestion): string {
  // A block: several lines, a fence, or a line that is one picture or one embedded artifact.
  const block = s.insert.includes("\n") || s.insert.startsWith("```") || /^!\[[^\]]*\]\([^)]+\)$/.test(s.insert.trim());
  if (!block) return s.insert;
  const before = doc.slice(Math.max(0, s.from - 2), s.from), after = doc.slice(s.to, s.to + 2);
  const lead = s.from === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const tail = s.to >= doc.length || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  return lead + s.insert.replace(/\n+$/, "") + tail;
}

export function acceptSuggestion(view: EditorView): boolean {
  const s = view.state.field(suggestField, false);
  if (!s) return false;
  const insert = placed(view.state.doc.toString(), s);
  view.dispatch({ changes: { from: s.from, to: s.to, insert }, selection: { anchor: s.from + insert.length }, effects: setSuggestion.of(null), userEvent: "input.suggest", scrollIntoView: true });
  for (const f of view.state.facet(suggestionHandler)) f("accepted", s);
  view.focus();
  return true;
}

export function rejectSuggestion(view: EditorView): boolean {
  const s = view.state.field(suggestField, false);
  if (!s) return false;
  view.dispatch({ effects: setSuggestion.of(null) });
  for (const f of view.state.facet(suggestionHandler)) f("rejected", s);
  view.focus();
  return true;
}

class Proposed extends WidgetType {
  constructor(readonly s: Suggestion, readonly block: boolean) { super(); }
  eq(o: Proposed) { return o.s.insert === this.s.insert && o.block === this.block && o.s.model === this.s.model; }
  toDOM(view: EditorView) {
    const el = document.createElement(this.block ? "div" : "span");
    el.className = "cm-suggest" + (this.block ? " block" : "");
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", "Suggested text");
    const text = document.createElement(this.block ? "pre" : "span");
    text.className = "cm-suggest-text";
    text.textContent = this.s.insert;
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
    bar.append(button("Accept", "Put this in the note (Ctrl+Enter)", () => acceptSuggestion(view), true), button("Reject", "Leave the note as it is (Esc)", () => rejectSuggestion(view)));
    el.append(text, bar);
    return el;
  }
  ignoreEvent() { return true; }
}

const suggestField = StateField.define<Suggestion | null>({
  create: () => null,
  update(value, tr) {
    let s = value;
    if (s && tr.docChanged) {
      const from = tr.changes.mapPos(s.from, 1), to = Math.max(from, tr.changes.mapPos(s.to, -1));
      s = { ...s, from, to };
    }
    for (const e of tr.effects) if (e.is(setSuggestion)) s = e.value && { ...e.value, from: Math.min(e.value.from, tr.state.doc.length), to: Math.min(Math.max(e.value.from, e.value.to), tr.state.doc.length) };
    return s;
  },
  provide: (f) => EditorView.decorations.from(f, (s): DecorationSet => {
    if (!s) return Decoration.none;
    const block = s.insert.includes("\n") || s.insert.startsWith("```") || /^!\[[^\]]*\]\([^)]+\)$/.test(s.insert.trim());
    const marks = [];
    if (s.to > s.from) marks.push(Decoration.mark({ class: "cm-suggest-old" }).range(s.from, s.to));
    marks.push(Decoration.widget({ widget: new Proposed(s, block), side: 1, block }).range(s.to));
    return Decoration.set(marks);
  }),
});

/** The suggestion waiting in the editor, if there is one. */
export const pendingSuggestion = (view: EditorView): Suggestion | null => view.state.field(suggestField, false) ?? null;

const suggestTheme = EditorView.theme({
  ".cm-suggest-old": { textDecoration: "line-through", textDecorationColor: "var(--stale)", background: "color-mix(in srgb, var(--stale) 12%, transparent)" },
  ".cm-suggest": { background: "color-mix(in srgb, var(--reviewed) 13%, transparent)", borderLeft: "3px solid var(--reviewed)", borderRadius: "2px", padding: "1px 6px", margin: "0 2px" },
  ".cm-suggest.block": { display: "block", margin: "8px 0", padding: "8px 12px" },
  ".cm-suggest-text": { whiteSpace: "pre-wrap", font: "inherit", margin: "0", color: "var(--ink)" },
  ".cm-suggest.block .cm-suggest-text": { fontFamily: "var(--font-mono)", fontSize: "14px", lineHeight: "1.55" },
  ".cm-suggest-bar": { display: "inline-flex", gap: "6px", marginLeft: "10px", verticalAlign: "middle" },
  ".cm-suggest.block .cm-suggest-bar": { display: "flex", margin: "8px 0 0" },
  ".cm-suggest-bar .toggle": { minHeight: "26px", padding: "2px 10px", fontSize: "13px" },
});

export const suggestions: Extension = [
  suggestField,
  suggestTheme,
  keymap.of([{ key: "Mod-Enter", run: acceptSuggestion }, { key: "Escape", run: rejectSuggestion }]),
];
