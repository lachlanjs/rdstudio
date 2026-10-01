// The note editor: CodeMirror 6 on the Markdown source, shown as a live
// preview (livePreview.ts) or as plain source. Loaded only when a note is
// opened for editing (NoteEditor imports it), so reading pays nothing. Colours
// and fonts come from the theme's variables, so every theme and mode applies.

import { closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap, placeholder } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { linkCompletion, type LinkTarget } from "./links.ts";
import { livePreview, livePreviewTheme } from "./livePreview.ts";

export interface EditorOptions {
  doc: string;
  onChange: (text: string) => void;
  onSave: () => void;
  label: string;
  notes: () => LinkTarget[];
  source?: boolean; // plain Markdown instead of the live preview
}

const mode = new Compartment();
// Plain source is set in the monospaced face; the live preview in the reading one.
const sourceTheme = EditorView.theme({ ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" } });
const modeExtensions = (source: boolean) => (source ? [sourceTheme] : [livePreview, livePreviewTheme]);

const theme = EditorView.theme({
  "&": { color: "var(--ink)", backgroundColor: "transparent", fontSize: "16px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "visible" },
  ".cm-content": { padding: "12px 0 40vh", caretColor: "var(--accent)" },
  ".cm-line": { padding: "0 2px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--accent-soft) !important",
  },
  ".cm-placeholder": { color: "var(--ink-faint)" },
  ".cm-tooltip-autocomplete": {
    background: "var(--paper-raised)", border: "1px solid var(--rule)", borderRadius: "var(--radius)",
    fontFamily: "var(--font-ui)", fontSize: "15px", boxShadow: "0 6px 20px rgb(0 0 0 / .12)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-ui)", maxHeight: "16em" },
  ".cm-tooltip-autocomplete > ul > li": { padding: "6px 10px !important", lineHeight: "1.3" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { background: "var(--accent-soft)", color: "var(--ink)" },
  ".cm-completionDetail": { color: "var(--ink-faint)", fontStyle: "normal", marginLeft: "10px" },
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
      mode.of(modeExtensions(Boolean(opts.source))),
      closeBrackets(),
      // Only brackets: closing quotes would get in the way of apostrophes in prose.
      EditorState.languageData.of(() => [{ closeBrackets: { brackets: ["(", "["] } }]),
      linkCompletion(opts.notes),
      placeholder("Write the note here. # for a heading, [[ to link to another note, $x$ for maths."),
      EditorView.contentAttributes.of({ "aria-label": opts.label, spellcheck: "true", autocapitalize: "sentences", autocorrect: "on" }),
      keymap.of([
        { key: "Mod-s", preventDefault: true, run: () => { opts.onSave(); return true; } },
        ...closeBracketsKeymap,
        ...completionKeymap,
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      EditorView.updateListener.of((u) => { if (u.docChanged) opts.onChange(u.state.doc.toString()); }),
    ],
  });
  return new EditorView({ state, parent });
}

/** Switch between the live preview and plain source. */
export function setSource(view: EditorView, source: boolean): void {
  view.dispatch({ effects: mode.reconfigure(modeExtensions(source)) });
}

/** Replace the whole text (a restored draft, or their version after a conflict). */
export function setText(view: EditorView, text: string): void {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}
