// The editor's pure parts: where maths is recognised (it must agree with the
// note page, markdown-it with texmath), and what the formatting commands do
// to the text.

import { describe, expect, test } from "vitest";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import katex from "katex";
import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import { format } from "./commands.ts";
import { formula, mathsSyntax } from "./maths.ts";

// The note page's renderer, as markdown.ts sets it up.
const page = new MarkdownIt({ html: true }).use(texmath, { engine: katex, delimiters: ["dollars", "brackets"], katexOptions: { throwOnError: false } });

const language = markdown({ base: markdownLanguage, extensions: [mathsSyntax], completeHTMLTags: false });

/** The maths nodes in a text, as [name, source]. */
function maths(doc: string): [string, string][] {
  const state = EditorState.create({ doc, extensions: [language] });
  const out: [string, string][] = [];
  ensureSyntaxTree(state, doc.length, 5000)!.iterate({
    enter: (n) => { if (n.name === "InlineMath" || n.name === "BlockMath") out.push([n.name, doc.slice(n.from, n.to)]); },
  });
  return out;
}

describe("maths is recognised as the note page does", () => {
  test.each([
    ["inline", "a $x^2$ b", [["InlineMath", "$x^2$"]]],
    ["inline, display", "so $$\\sum_i a_i$$ holds", [["InlineMath", "$$\\sum_i a_i$$"]]],
    ["brackets inline", "a \\(x\\) b", [["InlineMath", "\\(x\\)"]]],
    ["prices are not maths", "costs $5 and $10 now", []],
    ["a space inside the delimiters is not maths", "a $ x $ b", []],
    ["an escaped dollar is not maths", "a \\$x$ b", []],
    ["not inside inline code", "a `$x$` b", []],
    ["not inside a code block", "```\n$x$\n$$\ny\n$$\n```", []],
    ["a block", "before\n\n$$\n\\int_M d\\omega\n$$\n\nafter", [["BlockMath", "$$\n\\int_M d\\omega\n$$"]]],
    ["a block on one line, numbered", "$$ e^{i\\pi} = -1 $$ (1)\n", [["BlockMath", "$$ e^{i\\pi} = -1 $$ (1)"]]],
    ["a bracket block", "\\[\nx\n\\]\n", [["BlockMath", "\\[\nx\n\\]"]]],
    ["an unclosed block is text", "$$\nx\n\nmore", []],
  ])("%s", (_name, doc, expected) => {
    expect(maths(doc)).toEqual(expected);
    // The note page agrees: it sets as many formulas.
    const html = page.render(doc);
    expect((html.match(/<eqn?>|<section><eqn>/g) ?? []).length, html).toBe(expected.length);
  });

  test("emphasis marks inside a formula are not emphasis", () => {
    const doc = "*a $b*c$ d*";
    const state = EditorState.create({ doc, extensions: [language] });
    const names: string[] = [];
    ensureSyntaxTree(state, doc.length, 5000)!.iterate({ enter: (n) => { names.push(n.name); } });
    expect(names).toContain("InlineMath");
    expect(maths(doc)).toEqual([["InlineMath", "$b*c$"]]);
  });

  test("formula: the TeX and whether it is displayed", () => {
    expect(formula("$x$")).toEqual({ tex: "x", display: false });
    expect(formula("$$x$$")).toEqual({ tex: "x", display: true });
    expect(formula("\\(x\\)")).toEqual({ tex: "x", display: false });
    expect(formula("\\[\nx\n\\]")).toEqual({ tex: "\nx\n", display: true });
  });
});

/** Enough of an editor for the commands: a state that transactions replace. */
function editor(doc: string, from: number, to = from) {
  const view = {
    state: EditorState.create({ doc, selection: EditorSelection.single(from, to), extensions: [language] }),
    dispatch(...specs: TransactionSpec[]) { this.state = this.state.update(...specs).state; },
    focus() {},
  };
  return view as typeof view & EditorView;
}

describe("formatting commands", () => {
  test("bold wraps the selection, and unwraps it again", () => {
    const v = editor("a word here", 2, 6);
    format(v, "bold");
    expect(v.state.doc.toString()).toBe("a **word** here");
    expect(v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to)).toBe("word");
    format(v, "bold");
    expect(v.state.doc.toString()).toBe("a word here");
  });

  test("with nothing selected, the cursor goes between the markers", () => {
    const v = editor("ab", 1);
    format(v, "maths");
    expect(v.state.doc.toString()).toBe("a$$b");
    expect(v.state.selection.main.head).toBe(2);
  });

  test("heading cycles #, ##, ### and back", () => {
    const v = editor("Title\nbody", 2);
    const seen = [];
    for (let i = 0; i < 4; i++) { format(v, "heading"); seen.push(v.state.doc.line(1).text); }
    expect(seen).toEqual(["# Title", "## Title", "### Title", "Title"]);
    expect(v.state.doc.line(2).text).toBe("body");
  });

  test("list marks every selected line, and unmarks them", () => {
    const v = editor("one\ntwo\nthree", 0, 7);
    format(v, "list");
    expect(v.state.doc.toString()).toBe("- one\n- two\nthree");
    format(v, "list");
    expect(v.state.doc.toString()).toBe("one\ntwo\nthree");
  });

  test("link: selected text becomes [text]() with the cursor in the address", () => {
    const v = editor("see Stokes", 4, 10);
    format(v, "link");
    expect(v.state.doc.toString()).toBe("see [Stokes]()");
    expect(v.state.selection.main.head).toBe(13);
  });

  test("link: with nothing selected, [[ ]] to choose a note", () => {
    const v = editor("see ", 4);
    format(v, "link");
    expect(v.state.doc.toString()).toBe("see [[]]");
    expect(v.state.selection.main.head).toBe(6);
  });
});
