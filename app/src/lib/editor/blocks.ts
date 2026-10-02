// Blocks the live preview draws as the note page does: display maths ($$…$$,
// \[…\]), Mermaid diagrams and tables. Away from the cursor a block is
// replaced by its rendering; with the cursor in it, its source shows for
// editing, and maths and diagrams keep their rendering beneath it, updated
// as you type. Clicking a rendering puts the cursor in its source.
// (Decorations that replace whole lines must come from a state field, not a
// view plugin, so this is separate from livePreview.ts.)

import { syntaxTree } from "@codemirror/language";
import { StateField, type EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { renderDiagrams } from "$lib/diagrams.ts";
import { render } from "$lib/markdown.ts";

type Kind = "maths" | "diagram" | "table";

// A diagram's drawing, kept by its source, so a block redrawn (the cursor
// leaving it, a scroll) shows at once instead of flickering while Mermaid runs.
const drawn = new Map<string, string>();

class BlockWidget extends WidgetType {
  constructor(readonly kind: Kind, readonly source: string, readonly at: number, readonly beneath: boolean) { super(); }

  eq(other: BlockWidget): boolean {
    return other.kind === this.kind && other.source === this.source && other.at === this.at && other.beneath === this.beneath;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement("div");
    el.className = `cm-lp-block cm-lp-${this.kind}${this.beneath ? " cm-lp-beneath" : ""}`;
    const inner = document.createElement("div");
    inner.className = "prose";
    el.append(inner);
    const key = this.source;
    const known = this.kind === "diagram" ? drawn.get(key) : undefined;
    if (known) {
      inner.innerHTML = known;
    } else {
      // The same rendering as the note page (render() sanitises it).
      inner.innerHTML = render(this.kind === "diagram" ? "```mermaid\n" + this.source + "\n```" : this.source);
      if (this.kind === "diagram") {
        void renderDiagrams(inner).then(() => {
          if (inner.querySelector('.mermaid-block[data-rendered="done"]')) drawn.set(key, inner.innerHTML);
          view.requestMeasure();
        });
      }
    }
    if (!this.beneath) {
      el.title = "Click to edit";
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        view.dispatch({ selection: { anchor: this.at }, scrollIntoView: true });
        view.focus();
      });
    }
    return el;
  }

  ignoreEvent(): boolean { return true; }
  get estimatedHeight(): number { return this.kind === "diagram" ? 240 : this.kind === "maths" ? 60 : 120; }
}

function build(state: EditorState): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const sel = state.selection.ranges;
  const tree = syntaxTree(state);
  tree.iterate({
    enter: (node) => {
      let kind: Kind | null = null;
      let source = "";
      if (node.name === "BlockMath") { kind = "maths"; source = state.sliceDoc(node.from, node.to); }
      else if (node.name === "Table") { kind = "table"; source = state.sliceDoc(node.from, node.to); }
      else if (node.name === "FencedCode") {
        const info = node.node.getChild("CodeInfo");
        if (info && state.sliceDoc(info.from, info.to).trim().toLowerCase() === "mermaid") {
          kind = "diagram";
          // The lines between the opening fence and the closing one (if written yet).
          const first = state.doc.lineAt(node.from), last = state.doc.lineAt(node.to);
          const closed = last.number > first.number && /^\s*(`{3,}|~{3,})\s*$/.test(last.text);
          const end = closed ? last.number - 1 : last.number;
          source = end > first.number ? state.sliceDoc(state.doc.line(first.number + 1).from, state.doc.line(end).to) : "";
        }
      } else if (node.name === "Document" || node.name === "Blockquote" || /List|ListItem/.test(node.name)) {
        return undefined; // blocks can sit inside these
      }
      if (!kind) return false;
      const from = state.doc.lineAt(node.from).from, to = state.doc.lineAt(node.to).to;
      const editing = sel.some((r) => r.to >= from && r.from <= to);
      if (!editing) {
        decos.push(Decoration.replace({ widget: new BlockWidget(kind, source, node.from, false), block: true }).range(from, to));
      } else if (kind !== "table" && source.trim()) {
        decos.push(Decoration.widget({ widget: new BlockWidget(kind, source, node.from, true), block: true, side: 1 }).range(to));
      }
      return false;
    },
  });
  return Decoration.set(decos, true);
}

export const renderedBlocks = StateField.define<DecorationSet>({
  create: build,
  update(value, tr) {
    if (tr.docChanged || tr.selection || syntaxTree(tr.startState) !== syntaxTree(tr.state)) return build(tr.state);
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const blocksTheme = EditorView.theme({
  ".cm-lp-block": { padding: "6px 0", cursor: "text" },
  ".cm-lp-block .prose": { maxWidth: "none" },
  ".cm-lp-block .prose > :last-child, .cm-lp-block .mermaid-block, .cm-lp-block .table-wrap": { marginBottom: "0" },
  ".cm-lp-block .katex-display": { margin: "0" },
  ".cm-lp-beneath": { borderLeft: "2px solid var(--rule)", paddingLeft: "12px", marginTop: "4px", opacity: ".9" },
  ".cm-lp-block:not(.cm-lp-beneath):hover": { outline: "1px dashed var(--rule)", outlineOffset: "2px", borderRadius: "4px" },
});
