// Places marked for Axis (T98): the passage a question is about, and, apart
// from it, the point where new text is to go. The passage follows the
// selection while that is being asked for (`follow`), and stays when the
// cursor moves on, so that a place can then be set elsewhere. Both keep their
// places as the note is edited, and a passage typed over is gone.

import { StateEffect, StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

export interface Places {
  passage: { from: number; to: number } | null;
  here: number | null;
  /** Whether a selection made in the note becomes the passage. */
  follow: boolean;
}

/** Set any of the three; a passage or a place of null takes it away. */
export const setPlaces = StateEffect.define<Partial<Places>>();

class Here extends WidgetType {
  eq() { return true; }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-axis-here";
    el.setAttribute("aria-label", "Axis puts new text here");
    el.title = "Axis puts new text here";
    return el;
  }
  ignoreEvent() { return true; }
}

const placesField = StateField.define<Places>({
  create: () => ({ passage: null, here: null, follow: false }),
  update(value, tr) {
    let { passage, here, follow } = value;
    if (tr.docChanged) {
      if (passage) {
        // Typed over whole, it is gone: what stands there now is not what was marked.
        const was = passage;
        let over = false;
        tr.changes.iterChangedRanges((a, b) => { if (a <= was.from && b >= was.to) over = true; });
        const from = tr.changes.mapPos(passage.from, 1), to = tr.changes.mapPos(passage.to, -1);
        passage = !over && to > from ? { from, to } : null;
      }
      if (here !== null) here = tr.changes.mapPos(here, 1);
    }
    for (const e of tr.effects) if (e.is(setPlaces)) {
      if ("follow" in e.value) follow = !!e.value.follow;
      if ("passage" in e.value) passage = e.value.passage ?? null;
      if ("here" in e.value) here = e.value.here ?? null;
    }
    if (follow && tr.selection) { const r = tr.state.selection.main; if (!r.empty) passage = { from: r.from, to: r.to }; }
    const end = tr.state.doc.length;
    if (passage && passage.to > end) passage = passage.from < end ? { from: passage.from, to: end } : null;
    if (here !== null && here > end) here = end;
    const same = follow === value.follow && here === value.here && (passage === value.passage || (!!passage && !!value.passage && passage.from === value.passage.from && passage.to === value.passage.to));
    return same ? value : { passage, here, follow };
  },
  provide: (f) => EditorView.decorations.from(f, (p): DecorationSet => {
    const marks: Range<Decoration>[] = [];
    if (p.passage) marks.push(Decoration.mark({ class: "cm-axis-passage" }).range(p.passage.from, p.passage.to));
    if (p.here !== null) marks.push(Decoration.widget({ widget: new Here(), side: -1 }).range(p.here));
    return Decoration.set(marks, true);
  }),
});

const NONE: Places = { passage: null, here: null, follow: false };
export const placesIn = (state: EditorState): Places => state.field(placesField, false) ?? NONE;
export const placesOf = (view: EditorView): Places => placesIn(view.state);

const placesTheme = EditorView.theme({
  ".cm-axis-passage": { background: "color-mix(in srgb, var(--pen-blue) 16%, transparent)", boxShadow: "inset 0 -2px 0 color-mix(in srgb, var(--pen-blue) 70%, transparent)" },
  ".cm-axis-here": { display: "inline-block", width: "0", height: "1.15em", verticalAlign: "text-bottom", borderLeft: "2px solid var(--pen-green)", margin: "0 1px", position: "relative" },
  ".cm-axis-here::before": { content: '""', position: "absolute", left: "-5px", top: "-5px", borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "6px solid var(--pen-green)" },
});

export const places: Extension = [placesField, placesTheme];
