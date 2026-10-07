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
import { blocksTheme, noteDir, renderedBlocks } from "./blocks.ts";
import { format, formatKeymap, type Format } from "./commands.ts";
import { livePreview, livePreviewTheme } from "./livePreview.ts";
import { mathsSyntax } from "./maths.ts";
import { linkControl } from "./linkControl.ts";
import { pinsField, pinsTheme } from "./pins.ts";
import { setSuggestion, suggestionHandler, suggestions, type Suggestion } from "./suggest.ts";

export type { Format, Suggestion };
export { acceptSuggestion, pendingSuggestion, rejectSuggestion } from "./suggest.ts";

export interface EditorOptions {
  doc: string;
  onChange: (text: string) => void;
  onSave: () => void;
  label: string;
  notes: () => LinkTarget[];
  /** The note's folder, for showing the pictures and artifacts it cites by a relative path. */
  dir?: string;
  source?: boolean; // plain Markdown instead of the live preview
  placeholder?: string;
  /** A box within a page (an answer), rather than the whole page: no room
   *  left below the text for scrolling past the end. */
  inline?: boolean;
  /** The selection changed: its text ("" when nothing is selected). */
  onSelect?: (text: string) => void;
  /** A suggestion (suggest.ts) was accepted into the text, or rejected. */
  onSuggestion?: (what: "accepted" | "rejected", s: Suggestion) => void;
}

const mode = new Compartment();
// Plain source is set in the monospaced face; the live preview in the reading one.
const sourceTheme = EditorView.theme({ ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" } });
const modeExtensions = (source: boolean) => (source ? [sourceTheme] : [livePreview, livePreviewTheme, renderedBlocks, blocksTheme]);

const theme = EditorView.theme({
  "&": { color: "var(--ink)", backgroundColor: "transparent", fontSize: "16px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "visible" },
  ".cm-content": { padding: "12px 0 40vh", caretColor: "var(--accent)" },
  ".cm-line": { padding: "0 2px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  // The selection, clearly visible in every theme: the soft accent alone is
  // too close to the paper in some dark ones (space). Dimmer when not focused.
  ".cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent) !important" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "color-mix(in srgb, var(--accent) 40%, transparent) !important",
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

// An answer box: the editor fills its framed box (padded by .answer-editor in
// app.css), and grows with the text.
const inlineTheme = EditorView.theme({
  ".cm-content": { paddingBottom: "12px" },
  ".cm-scroller": { minHeight: "inherit" },
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

/** How much of the window a bar covers, from the top (its bottom edge) or
 *  from the bottom (its top edge); 0 when it is not fixed there or hidden. */
function covered(selector: string, edge: "top" | "bottom"): number {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el || el.hidden) return 0;
  // Only a fixed bar covers the bottom (on a desktop the toolbar is sticky, at the top).
  const pos = getComputedStyle(el).position;
  if (edge === "top" ? pos !== "fixed" : pos !== "fixed" && pos !== "sticky") return 0;
  const r = el.getBoundingClientRect();
  return edge === "bottom" ? Math.max(0, r.bottom) : Math.max(0, innerHeight - r.top);
}

export function createEditor(parent: HTMLElement, opts: EditorOptions): EditorView {
  const state = EditorState.create({
    doc: opts.doc,
    extensions: [
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, extensions: [mathsSyntax], completeHTMLTags: false }),
      syntaxHighlighting(highlight),
      noteDir.of(opts.dir ?? ""),
      theme,
      ...(opts.inline ? [inlineTheme, pinsField, pinsTheme] : [suggestions, suggestionHandler.of((what, s) => opts.onSuggestion?.(what, s)), linkControl]),
      mode.of(modeExtensions(Boolean(opts.source))),
      closeBrackets(),
      // Only brackets: closing quotes would get in the way of apostrophes in prose.
      EditorState.languageData.of(() => [{ closeBrackets: { brackets: ["(", "["] } }]),
      linkCompletion(opts.notes),
      placeholder(opts.placeholder ?? "Write the note here. # for a heading, [[ to link to another note, $x$ for maths."),
      EditorView.contentAttributes.of({ "aria-label": opts.label, spellcheck: "true", autocapitalize: "sentences", autocorrect: "on" }),
      // (The suggestion's own keys, Mod-Enter and Escape, come first: suggest.ts.)
      keymap.of([
        { key: "Mod-s", preventDefault: true, run: () => { opts.onSave(); return true; } },
        ...formatKeymap,
        ...closeBracketsKeymap,
        ...completionKeymap,
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      // Scrolling to the cursor keeps it clear of the sticky bars above and
      // the toolbar below (fixed above the keyboard on a phone).
      EditorView.scrollMargins.of(() => ({ top: covered(".edit-top", "bottom"), bottom: covered(".format-bar", "top") + 8 })),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) opts.onChange(u.state.doc.toString());
        if (opts.onSelect && (u.selectionSet || u.docChanged)) {
          const r = u.state.selection.main;
          opts.onSelect(r.empty ? "" : u.state.sliceDoc(r.from, r.to));
        }
      }),
    ],
  });
  return new EditorView({ state, parent });
}

/** Bold, a heading, a link…, from the toolbar; the editor keeps the focus. */
export function applyFormat(view: EditorView, what: Format): void {
  format(view, what);
  view.focus();
}

/** Switch between the live preview and plain source. */
export function setSource(view: EditorView, source: boolean): void {
  view.dispatch({ effects: mode.reconfigure(modeExtensions(source)) });
}

/** Show a suggestion in the text, in view (null takes one away). */
export function suggest(view: EditorView, s: Suggestion | null): void {
  view.dispatch({ effects: s ? [setSuggestion.of(s), EditorView.scrollIntoView(s.to, { y: "center" })] : setSuggestion.of(null) });
}

/** The selection, or the caret (from === to), as offsets in the text. */
export const selectionOf = (view: EditorView): { from: number; to: number } => { const r = view.state.selection.main; return { from: r.from, to: r.to }; };

/** Replace the whole text (a restored draft, or their version after a conflict). */
export function setText(view: EditorView, text: string): void {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}
