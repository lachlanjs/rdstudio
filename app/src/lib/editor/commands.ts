// Formatting, for the toolbar and the keyboard shortcuts: each changes the
// Markdown text the way you would type it, so it can be undone in one step
// and the file stays ordinary Markdown.

import { startCompletion } from "@codemirror/autocomplete";
import { redo, undo } from "@codemirror/commands";
import { EditorSelection, type ChangeSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export type Format = "bold" | "italic" | "heading" | "list" | "link" | "maths" | "undo" | "redo";

/** Wrap each selection in a marker (** for bold), or unwrap it if it is
 *  wrapped already; with nothing selected, put the cursor between a pair. */
function wrap(view: EditorView, marker: string): boolean {
  const { state } = view;
  const n = marker.length;
  view.dispatch(state.changeByRange((r) => {
    const before = state.sliceDoc(r.from - n, r.from), after = state.sliceDoc(r.to, r.to + n);
    if (before === marker && after === marker) {
      return {
        changes: [{ from: r.from - n, to: r.from }, { from: r.to, to: r.to + n }],
        range: EditorSelection.range(r.from - n, r.to - n),
      };
    }
    return {
      changes: [{ from: r.from, insert: marker }, { from: r.to, insert: marker }],
      range: EditorSelection.range(r.from + n, r.to + n),
    };
  }), { scrollIntoView: true, userEvent: "input" });
  return true;
}

/** The lines the selection touches. */
function lines(view: EditorView) {
  const { state } = view;
  const out = new Map<number, { from: number; text: string }>();
  for (const r of state.selection.ranges) {
    for (let pos = r.from; pos <= r.to;) {
      const line = state.doc.lineAt(pos);
      out.set(line.number, { from: line.from, text: line.text });
      pos = line.to + 1;
    }
  }
  return [...out.values()];
}

/** No heading, then #, ##, ###, and back to none. */
function heading(view: EditorView): boolean {
  const changes: ChangeSpec[] = lines(view).map(({ from, text }) => {
    const m = /^(#{1,6}) /.exec(text);
    const level = m ? m[1]!.length : 0;
    const next = level >= 3 ? "" : "#".repeat(level + 1) + " ";
    return { from, to: from + (m ? m[0].length : 0), insert: next };
  });
  view.dispatch({ changes, scrollIntoView: true, userEvent: "input" });
  return true;
}

/** A bulleted list from the lines, or plain lines again if they all are one. */
function list(view: EditorView): boolean {
  const all = lines(view);
  const listed = all.every(({ text }) => /^\s*[-*+] /.test(text));
  const changes: ChangeSpec[] = all.map(({ from, text }) => {
    if (listed) {
      const m = /^(\s*)[-*+] /.exec(text)!;
      return { from: from + m[1]!.length, to: from + m[0].length };
    }
    return { from: from + /^\s*/.exec(text)![0].length, insert: "- " };
  });
  view.dispatch({ changes, scrollIntoView: true, userEvent: "input" });
  return true;
}

/** A link: the selected text becomes [text](…) with the address suggested;
 *  with nothing selected, [[ offers notes by title. */
function link(view: EditorView): boolean {
  const { state } = view;
  const r = state.selection.main;
  if (r.empty) {
    view.dispatch({ changes: { from: r.from, insert: "[[]]" }, selection: { anchor: r.from + 2 }, userEvent: "input" });
  } else {
    const text = state.sliceDoc(r.from, r.to);
    view.dispatch({ changes: { from: r.from, to: r.to, insert: `[${text}]()` }, selection: { anchor: r.from + text.length + 3 }, userEvent: "input" });
  }
  startCompletion(view);
  return true;
}

export function format(view: EditorView, what: Format): boolean {
  switch (what) {
    case "bold": return wrap(view, "**");
    case "italic": return wrap(view, "*");
    case "maths": return wrap(view, "$");
    case "heading": return heading(view);
    case "list": return list(view);
    case "link": return link(view);
    case "undo": return undo(view);
    case "redo": return redo(view);
  }
}

export const formatKeymap = [
  { key: "Mod-b", preventDefault: true, run: (v: EditorView) => format(v, "bold") },
  { key: "Mod-i", preventDefault: true, run: (v: EditorView) => format(v, "italic") },
  { key: "Mod-k", preventDefault: true, run: (v: EditorView) => format(v, "link") },
  { key: "Mod-Shift-m", preventDefault: true, run: (v: EditorView) => format(v, "maths") },
  { key: "Mod-Shift-h", preventDefault: true, run: (v: EditorView) => format(v, "heading") },
  { key: "Mod-Shift-8", preventDefault: true, run: (v: EditorView) => format(v, "list") },
];
