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
import { placed } from "./suggest.ts";
import { choices, kindOf, labelOf, linkAt, ratingOf, setEmbed, setTitle, sideOf } from "./linkControl.ts";

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

describe("a suggestion as it goes into the note (T74)", () => {
  const at = (doc: string, from: number, to: number, insert: string) => placed(doc, { from, to, insert, model: "m" });
  test("a phrase goes in as it is", () => {
    expect(at("One two.", 4, 7, "three")).toBe("three");
  });
  test("a block stands clear of the text round it by a blank line, without adding lines that are there", () => {
    const code = "```python\nx = 1\n```";
    expect(at("Before. After.", 8, 8, code)).toBe("\n\n" + code + "\n\n");
    expect(at("Before.\n\nAfter.", 9, 9, code)).toBe(code + "\n\n");
    expect(at("Before.\n\n\n\nAfter.", 9, 9, code)).toBe(code);
    expect(at("Before.\n", 8, 8, "Line one.\nLine two.\n")).toBe("\nLine one.\nLine two.");
    expect(at("", 0, 0, code)).toBe(code);
    expect(at("A sentence.", 11, 11, "![A figure](fig.html)")).toBe("\n\n![A figure](fig.html)"); // an embed is a block of its own
  });
});

describe("the link control (T79)", () => {
  const stateOf = (doc: string) => { const st = EditorState.create({ doc, extensions: [language] }); ensureSyntaxTree(st, doc.length, 5000); return st; };
  const at = (doc: string, needle: string) => { const st = stateOf(doc); return { st, l: linkAt(st, doc.indexOf(needle) + 1) }; };
  const after = (st: EditorState, changes: import("@codemirror/state").ChangeSpec) => st.update({ changes }).state.doc.toString();

  test("what an address points at", () => {
    expect([kindOf("/a/b.md"), kindOf("b.md#h"), kindOf("sub/"), kindOf("fig.html"), kindOf("p.PNG"), kindOf("https://x.org/a.md"), kindOf("#top"), kindOf("data.csv")])
      .toEqual(["note", "note", "note", "artifact", "image", null, null, null]);
  });
  test("the link under the cursor: its address, its title, whether it is shown", () => {
    const doc = 'See [the metric](/r/metric.md "requires"), [a figure](fig.html), ![a sphere](s.png "left") and [the web](https://x.org).';
    const { l } = at(doc, "the metric");
    expect(l).toMatchObject({ kind: "note", url: "/r/metric.md", title: "requires", embed: false });
    expect(ratingOf(l!)).toBe("requires");
    expect(at(doc, "a figure").l).toMatchObject({ kind: "artifact", title: null, embed: false });
    const pic = at(doc, "a sphere").l!;
    expect(pic).toMatchObject({ kind: "image", embed: true });
    expect(sideOf(pic)).toBe("left");
    expect(at(doc, "the web").l).toBeNull(); // the web is not ours to rate
    expect(linkAt(stateOf(doc), 1)).toBeNull();
    // At either end of a link counts as in it.
    const st = stateOf(doc);
    expect(linkAt(st, doc.indexOf("[the metric]"))).not.toBeNull();
    expect(linkAt(st, doc.indexOf('"requires")') + '"requires")'.length)).not.toBeNull();
  });
  test("a rating is the title: set, changed, taken away, and nothing else moves", () => {
    const doc = 'A [one](/a.md) and [two](/b.md "uses").';
    const one = at(doc, "one"), two = at(doc, "two");
    expect(after(one.st, setTitle(one.l!, "requires"))).toBe('A [one](/a.md "requires") and [two](/b.md "uses").');
    expect(after(two.st, setTitle(two.l!, "see also"))).toBe('A [one](/a.md) and [two](/b.md "see also").');
    expect(after(two.st, setTitle(two.l!, null))).toBe("A [one](/a.md) and [two](/b.md).");
  });
  test("shown here or a link is the ! before it; a rating or a side does not carry across", () => {
    const doc = 'A [figure](fig.html "uses") and ![pic](p.png "left").';
    const fig = at(doc, "figure"), pic = at(doc, "pic");
    expect(after(fig.st, setEmbed(fig.l!, true))).toBe('A ![figure](fig.html) and ![pic](p.png "left").');
    expect(after(pic.st, setEmbed(pic.l!, false))).toBe('A [figure](fig.html "uses") and [pic](p.png).');
    expect(setEmbed(pic.l!, true)).toEqual([]);
  });
  test("what is offered for each kind, and what the button says", () => {
    const doc = 'A [n](/a.md "uses"), [f](fig.html), ![g](fig.html), ![p](p.png) and [q](p.png).';
    const names = (needle: string) => choices(at(doc, needle).l!).map((c) => (c.on ? "*" : "") + c.label);
    expect(names("[n]")).toEqual(["Requires", "*Uses", "See also", "Unrated"]);
    expect(names("[f]")).toEqual(["Shown here", "*Link", "Requires", "Uses", "See also", "*Unrated"]);
    expect(names("![g]")).toEqual(["*Shown here", "Link"]);
    expect(names("![p]")).toEqual(["*Shown here", "Link", "*Centre", "Left"]);
    expect(names("[q]")).toEqual(["Shown here", "*Link"]);
    expect(["[n]", "[f]", "![g]", "![p]", "[q]"].map((n) => labelOf(at(doc, n).l!))).toEqual(["Uses", "Link", "Shown here", "Shown, centre", "Link"]);
  });
});
