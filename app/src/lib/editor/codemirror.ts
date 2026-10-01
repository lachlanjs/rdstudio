// The note editor: CodeMirror 6 on the Markdown source. Loaded only when a
// note is opened for editing (NoteEditor imports it), so reading pays nothing.
// Colours and fonts come from the theme's variables, so every theme and mode
// applies.

import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap, placeholder } from "@codemirror/view";
import { tags } from "@lezer/highlight";

export interface EditorOptions {
  doc: string;
  onChange: (text: string) => void;
  onSave: () => void;
  label: string;
}

const theme = EditorView.theme({
  "&": { color: "var(--ink)", backgroundColor: "transparent", fontSize: "16px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6", overflow: "visible" },
  ".cm-content": { padding: "12px 0 40vh", caretColor: "var(--accent)" },
  ".cm-line": { padding: "0 2px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--accent-soft) !important",
  },
  ".cm-placeholder": { color: "var(--ink-faint)" },
});

const highlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "700", color: "var(--ink)" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--accent)" },
  { tag: [tags.processingInstruction, tags.punctuation, tags.contentSeparator], color: "var(--ink-faint)" },
  { tag: tags.monospace, color: "var(--ink-soft)" },
  { tag: tags.quote, color: "var(--ink-soft)", fontStyle: "italic" },
]);

export function createEditor(parent: HTMLElement, opts: EditorOptions): EditorView {
  const state = EditorState.create({
    doc: opts.doc,
    extensions: [
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(highlight),
      theme,
      placeholder("Write the note here. Markdown: # for headings, [text](other-note.md) for links, $x$ for maths."),
      EditorView.contentAttributes.of({ "aria-label": opts.label, spellcheck: "true", autocapitalize: "sentences", autocorrect: "on" }),
      keymap.of([
        { key: "Mod-s", preventDefault: true, run: () => { opts.onSave(); return true; } },
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      EditorView.updateListener.of((u) => { if (u.docChanged) opts.onChange(u.state.doc.toString()); }),
    ],
  });
  return new EditorView({ state, parent });
}

/** Replace the whole text (a restored draft, or their version after a conflict). */
export function setText(view: EditorView, text: string): void {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}
