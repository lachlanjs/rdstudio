// Pins (T51): the teacher's replies, marked on the passages of the draft they
// are about, in their colour. CodeMirror maps each mark through the edits that
// follow, so a pin stays on its words as the draft changes; after a reload,
// pins are placed again by finding their quotes (locate).

import { StateEffect, StateField, type Range } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

export interface PinMark {
  id: string; // turn id and pin index: "t3.1"
  from: number;
  to: number;
  colour: "red" | "green" | "blue" | "hint";
}

export const setPins = StateEffect.define<PinMark[]>();
const focusPin = StateEffect.define<string | null>();

export const pinsField = StateField.define<{ marks: DecorationSet; focus: string | null }>({
  create: () => ({ marks: Decoration.none, focus: null }),
  update(value, tr) {
    let { marks, focus } = value;
    marks = marks.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setPins)) {
        const ranges: Range<Decoration>[] = e.value.filter((p) => p.to > p.from && p.to <= tr.state.doc.length)
          .sort((a, b) => a.from - b.from || a.to - b.to)
          .map((p) => Decoration.mark({ class: `cm-pin cm-pin-${p.colour}`, attributes: { "data-pin": p.id }, pin: p.id }).range(p.from, p.to));
        marks = Decoration.set(ranges, true);
      }
      if (e.is(focusPin)) focus = e.value;
    }
    return { marks, focus };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.marks),
});

/** Where a pin is now, after the edits since it was placed. */
export function pinRange(view: EditorView, id: string): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null;
  view.state.field(pinsField).marks.between(0, view.state.doc.length, (from, to, d) => {
    if ((d.spec as { pin?: string }).pin === id) { found = { from, to }; return false; }
  });
  return found;
}

/** Select a pin's passage and bring it into view. */
export function revealPin(view: EditorView, id: string): boolean {
  const r = pinRange(view, id);
  if (!r) return false;
  view.dispatch({ selection: { anchor: r.from, head: r.to }, effects: [EditorView.scrollIntoView(r.from, { y: "center" }), focusPin.of(id)] });
  view.focus();
  return true;
}

export const pinsTheme = EditorView.theme({
  ".cm-pin": { borderRadius: "2px", paddingBottom: "1px" },
  ".cm-pin-red": { background: "color-mix(in srgb, #d6453d 18%, transparent)", borderBottom: "2px solid #d6453d" },
  ".cm-pin-green": { background: "color-mix(in srgb, #2f9e5b 18%, transparent)", borderBottom: "2px solid #2f9e5b" },
  ".cm-pin-blue": { background: "color-mix(in srgb, #3a76d8 18%, transparent)", borderBottom: "2px solid #3a76d8" },
  ".cm-pin-hint": { borderBottom: "2px dashed var(--accent)" },
});

/** Where `quote` is in `text`: exactly, or with any run of spaces taken as any other. */
export function locate(text: string, quote: string): { from: number; to: number } | null {
  if (!quote) return null;
  const at = text.indexOf(quote);
  if (at >= 0) return { from: at, to: at + quote.length };
  const words = quote.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return null;
  const m = new RegExp(words.join("\\s+")).exec(text);
  return m ? { from: m.index, to: m.index + m[0].length } : null;
}
