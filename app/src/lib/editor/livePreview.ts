// Live preview: the Markdown looks like the note while it is written. Headings
// are set large, emphasis and links render, and the markup (#, **, [..](..))
// is hidden except on the lines being edited, where it shows so it can be
// changed. Only decorations: the text, and so the file, is never altered.

import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";

class BulletWidget extends WidgetType {
  eq(): boolean { return true; }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-lp-bullet";
    span.textContent = "•";
    return span;
  }
}

class RuleWidget extends WidgetType {
  eq(): boolean { return true; }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-lp-hr";
    return span;
  }
}

const hide = Decoration.replace({});
const bullet = Decoration.replace({ widget: new BulletWidget() });
const rule = Decoration.replace({ widget: new RuleWidget() });
const mark = (cls: string) => Decoration.mark({ class: cls });
const line = (cls: string) => Decoration.line({ class: cls });

/** Lines the cursor or a selection touches, while the editor has focus: their markup shows. */
function activeLines(state: EditorState, focused: boolean): Set<number> {
  const out = new Set<number>();
  if (!focused) return out;
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number, b = state.doc.lineAt(r.to).number;
    for (let n = a; n <= b; n++) out.add(n);
  }
  return out;
}

function build(view: EditorView): DecorationSet {
  const { state } = view;
  const active = activeLines(state, view.hasFocus);
  const isActive = (pos: number) => active.has(state.doc.lineAt(pos).number);
  const decos: Range<Decoration>[] = [];
  const lineClass = (from: number, to: number, cls: string) => {
    for (let n = state.doc.lineAt(from).number, last = state.doc.lineAt(to).number; n <= last; n++) {
      decos.push(line(cls).range(state.doc.line(n).from));
    }
  };

  // One pass over everything visible (separate ranges would visit shared nodes twice).
  const ranges = view.visibleRanges;
  if (ranges.length) {
    const from = ranges[0]!.from, to = ranges[ranges.length - 1]!.to;
    syntaxTree(state).iterate({
      from, to,
      enter: (node) => {
        const name = node.name;
        const heading = /^(?:ATX|Setext)Heading(\d)$/.exec(name);
        if (heading) {
          lineClass(node.from, node.to, `cm-lp-h${heading[1]}`);
          return;
        }
        switch (name) {
          case "HeaderMark": {
            if (isActive(node.from)) break;
            const parent = node.node.parent?.name ?? "";
            if (parent.startsWith("SetextHeading")) { decos.push(hide.range(state.doc.lineAt(node.from).from, node.to)); break; }
            // "# " at the start (and closing #s): hide with the space after.
            const end = state.sliceDoc(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
            if (end > node.from) decos.push(hide.range(node.from, end));
            break;
          }
          case "EmphasisMark":
          case "StrikethroughMark":
            if (!isActive(node.from)) decos.push(hide.range(node.from, node.to));
            break;
          case "Emphasis": decos.push(mark("cm-lp-em").range(node.from, node.to)); break;
          case "StrongEmphasis": decos.push(mark("cm-lp-strong").range(node.from, node.to)); break;
          case "Strikethrough": decos.push(mark("cm-lp-strike").range(node.from, node.to)); break;
          case "InlineCode": {
            decos.push(mark("cm-lp-code").range(node.from, node.to));
            if (!isActive(node.from)) {
              const n = node.node;
              for (let c = n.firstChild; c; c = c.nextSibling) if (c.name === "CodeMark") decos.push(hide.range(c.from, c.to));
            }
            return false;
          }
          case "Link": {
            // [text](url "title"): the text as a link; the rest hidden off the editing line.
            const n = node.node;
            const marks = [];
            let url = false;
            for (let c = n.firstChild; c; c = c.nextSibling) {
              if (c.name === "LinkMark") marks.push(c);
              if (c.name === "URL") url = true;
            }
            const open = marks[0], close = marks[1];
            if (open && close && close.from > open.to) decos.push(mark("cm-lp-link").range(open.to, close.from));
            if (!isActive(node.from) && url && open && close) {
              decos.push(hide.range(open.from, open.to));
              decos.push(hide.range(close.from, node.to));
            }
            return false;
          }
          case "ListMark": {
            const text = state.sliceDoc(node.from, node.to);
            if (!isActive(node.from) && /^[-*+]$/.test(text)) decos.push(bullet.range(node.from, node.to));
            else decos.push(mark("cm-lp-listmark").range(node.from, node.to));
            break;
          }
          case "TaskMarker": decos.push(mark("cm-lp-task").range(node.from, node.to)); break;
          case "Blockquote": lineClass(node.from, node.to, "cm-lp-quote"); break;
          case "QuoteMark":
            if (!isActive(node.from)) {
              const end = state.sliceDoc(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
              decos.push(hide.range(node.from, end));
            }
            break;
          case "HorizontalRule":
            if (!isActive(node.from)) decos.push(rule.range(node.from, node.to));
            break;
          case "FencedCode":
          case "CodeBlock":
            lineClass(node.from, node.to, "cm-lp-codeblock");
            return false;
          case "HTMLBlock":
          case "CommentBlock":
            lineClass(node.from, node.to, "cm-lp-codeblock");
            return false;
        }
        return undefined;
      },
    });
  }
  // Line decorations must come before others at the same position.
  decos.sort((a, b) => a.from - b.from || (a.value.startSide - b.value.startSide));
  const builder = new RangeSetBuilder<Decoration>();
  for (const d of decos) builder.add(d.from, d.to, d.value);
  return builder.finish();
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = build(view); }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
        this.decorations = build(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

/** How live preview looks: the note's own reading type, from the theme's variables. */
export const livePreviewTheme = EditorView.theme({
  ".cm-scroller": { fontFamily: "var(--font-text)", fontSize: "var(--text-size)", lineHeight: "1.68" },
  ".cm-content": { fontVariationSettings: '"opsz" 18' },
  ".cm-lp-h1, .cm-lp-h2, .cm-lp-h3, .cm-lp-h4, .cm-lp-h5, .cm-lp-h6": {
    fontWeight: "600", lineHeight: "1.3", fontVariationSettings: '"opsz" 36', paddingTop: ".5em !important",
  },
  ".cm-lp-h1": { fontSize: "26px" },
  ".cm-lp-h2": { fontSize: "22px" },
  ".cm-lp-h3": { fontSize: "19px" },
  ".cm-lp-h4": { fontSize: "17px", fontWeight: "700" },
  ".cm-lp-em": { fontStyle: "italic" },
  ".cm-lp-strong": { fontWeight: "700" },
  ".cm-lp-strike": { textDecoration: "line-through" },
  ".cm-lp-code": { fontFamily: "var(--font-mono)", fontSize: ".86em", background: "var(--paper-sunk)", borderRadius: "4px", padding: ".1em .2em" },
  ".cm-lp-link": { color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: "2px" },
  ".cm-lp-bullet": { color: "var(--ink-faint)", display: "inline-block", minWidth: "1ch" },
  ".cm-lp-listmark, .cm-lp-task": { color: "var(--ink-faint)", fontFamily: "var(--font-mono)" },
  ".cm-lp-quote": { borderLeft: "3px solid var(--accent)", paddingLeft: "14px !important", color: "var(--ink-soft)" },
  ".cm-lp-codeblock": { fontFamily: "var(--font-mono)", fontSize: "15px", lineHeight: "1.5", background: "var(--paper-sunk)", padding: "0 12px !important" },
  ".cm-lp-hr": { display: "inline-block", width: "100%", borderTop: "1px solid var(--rule)", verticalAlign: "middle" },
});
