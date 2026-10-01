// Link suggestions while writing: "[[" offers notes by title and inserts an
// ordinary Markdown link to the note ([Title](/folder/note.md)), the form the
// bundle's other links use; inside "](" it offers note paths.

import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";

export interface LinkTarget {
  id: string; // such as forms/orientation
  title: string;
  folder: string; // for telling apart notes with the same title
}

function fromTitle(notes: () => LinkTarget[]) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const before = ctx.matchBefore(/\[\[[^\]\n]*$/);
    if (!before) return null;
    const options: Completion[] = notes().map((n) => ({
      label: n.title,
      detail: n.folder,
      apply: (view, _c, from, to) => {
        const text = `[${n.title}](/${n.id}.md)`;
        // Replace the "[[" too, and the "]]" that bracket closing added.
        const start = from - 2, end = view.state.sliceDoc(to, to + 2) === "]]" ? to + 2 : to;
        view.dispatch({ changes: { from: start, to: end, insert: text }, selection: { anchor: start + text.length } });
      },
    }));
    // Matched against what follows the "[[".
    return { from: before.from + 2, options, filter: true, validFor: /^[^\]\n]*$/ };
  };
}

function fromPath(notes: () => LinkTarget[]) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const before = ctx.matchBefore(/\]\([^)\s]*$/);
    if (!before) return null;
    return {
      from: before.from + 2,
      options: notes().map((n) => ({ label: `/${n.id}.md`, detail: n.title })),
      validFor: /^[^)\s]*$/,
    };
  };
}

export function linkCompletion(notes: () => LinkTarget[]) {
  return autocompletion({ override: [fromTitle(notes), fromPath(notes)], icons: false, activateOnTyping: true });
}
