// Stands in for @codemirror/lang-html (vite.config.ts aliases it here) in the
// editor. The Markdown language imports it to parse inline HTML and to
// complete tags, which brings the HTML, CSS and JavaScript parsers with it,
// about a third of the editor's code. Notes rarely hold HTML, and the live
// preview shows HTML blocks as code anyway, so HTML is left as plain text:
// one node, nothing to highlight.

import { Parser, NodeType, Tree, type Input, type PartialParse, type TreeFragment } from "@lezer/common";
import { Language, LanguageSupport, defineLanguageFacet } from "@codemirror/language";

const top = NodeType.define({ id: 0, name: "Document", top: true });

class PlainParser extends Parser {
  createParse(input: Input, _fragments: readonly TreeFragment[], ranges: readonly { from: number; to: number }[]): PartialParse {
    const from = ranges[0]?.from ?? 0, to = ranges[ranges.length - 1]?.to ?? input.length;
    return {
      parsedPos: to,
      stoppedAt: null,
      stopAt() {},
      advance: () => new Tree(top, [], [], to - from),
    };
  }
}
const language = new Language(defineLanguageFacet(), new PlainParser(), [], "html");

export function html(_config?: unknown): LanguageSupport {
  return new LanguageSupport(language);
}

export function htmlCompletionSource(): null {
  return null;
}
