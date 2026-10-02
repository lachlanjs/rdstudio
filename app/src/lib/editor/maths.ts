// Maths in the editor's Markdown parser, matching the note page (markdown-it
// with texmath, "dollars" and "brackets"): $x$ and $$x$$ inline, \(x\) inline,
// and $$…$$ or \[…\] as a block of their own, with an optional equation
// number after it, "(1)". Recognised here so the live preview can draw them
// and so * and _ inside a formula are not read as emphasis.

import type { BlockContext, Line, MarkdownConfig, InlineContext } from "@lezer/markdown";
import type { Input } from "@lezer/common";
import { tags } from "@lezer/highlight";

const DOLLAR = 36, BACKSLASH = 92, PAREN = 40;

// The same patterns as texmath's, anchored at the opening delimiter.
const INLINE_DOUBLE = /^\$\$([^$]*?[^\\])\$\$/;
const INLINE = /^\$((?:[^\s\\])|(?:\S.*?[^\s\\]))\$(?!\d)/;
const INLINE_PAREN = /^\\\((.+?)\\\)/;
const BLOCK_DOLLARS = /^\$\$([^$]*?[^\\])\$\$(?:[ \t]*\([^)\s]+?\))?(?=[ \t]*(?:\n|$))/;
const BLOCK_BRACKETS = /^\\\[([\s\S]+?)\\\](?:[ \t]*\([^)$\r\n]+?\))?(?=[ \t]*(?:\n|$))/;

function inlineMaths(cx: InlineContext, next: number, pos: number): number {
  if (next === DOLLAR) {
    if (pos > cx.offset && cx.char(pos - 1) === BACKSLASH) return -1;
    const rest = cx.slice(pos, cx.end);
    const m = (rest.charCodeAt(1) === DOLLAR ? INLINE_DOUBLE : INLINE).exec(rest);
    if (!m) return -1;
    return cx.addElement(cx.elt("InlineMath", pos, pos + m[0].length, [
      cx.elt("MathMark", pos, pos + (m[0].startsWith("$$") ? 2 : 1)),
      cx.elt("MathMark", pos + m[0].length - (m[0].startsWith("$$") ? 2 : 1), pos + m[0].length),
    ]));
  }
  if (next === BACKSLASH && cx.char(pos + 1) === PAREN) {
    const m = INLINE_PAREN.exec(cx.slice(pos, cx.end));
    if (!m) return -1;
    const end = pos + m[0].length;
    return cx.addElement(cx.elt("InlineMath", pos, end, [cx.elt("MathMark", pos, pos + 2), cx.elt("MathMark", end - 2, end)]));
  }
  return -1;
}

// A block starts with $$ or \[ at the start of a line (texmath's block rule)
// and runs to where it closes, possibly lines later; unclosed, it is not maths.
// (The parser only lets a block look one line ahead, so the text after the
// line is read from the input, up to a limit.)
const LOOKAHEAD = 20000;

function blockMaths(cx: BlockContext, line: Line): boolean {
  const start = line.text.slice(line.pos);
  const pattern = start.startsWith("$$") ? BLOCK_DOLLARS : start.startsWith("\\[") ? BLOCK_BRACKETS : null;
  if (!pattern) return false;
  const from = cx.lineStart + line.pos;
  const input = (cx as unknown as { input: Input }).input;
  const m = pattern.exec(input.read(from, Math.min(input.length, from + LOOKAHEAD)));
  if (!m) return false;
  const to = from + m[0].length;
  // Consume the lines it covers (the pattern has checked its last line ends there).
  while (cx.lineStart + line.text.length < to) if (!cx.nextLine()) break;
  cx.addElement(cx.elt("BlockMath", from, to));
  cx.nextLine();
  return true;
}

export const mathsSyntax: MarkdownConfig = {
  defineNodes: [
    { name: "InlineMath", style: tags.special(tags.content) },
    { name: "BlockMath", block: true, style: tags.special(tags.content) },
    { name: "MathMark", style: tags.processingInstruction },
  ],
  parseInline: [{ name: "InlineMath", parse: inlineMaths, before: "Escape" }],
  parseBlock: [{ name: "BlockMath", parse: blockMaths, before: "FencedCode" }],
};

/** The TeX inside a formula's source, and whether it is set as display. */
export function formula(source: string): { tex: string; display: boolean } {
  let m: RegExpExecArray | null;
  if ((m = /^\$\$([\s\S]*?)\$\$/.exec(source))) return { tex: m[1]!, display: true };
  if ((m = /^\\\[([\s\S]*?)\\\]/.exec(source))) return { tex: m[1]!, display: true };
  if ((m = /^\\\(([\s\S]*?)\\\)$/.exec(source))) return { tex: m[1]!, display: false };
  if ((m = /^\$([\s\S]*?)\$$/.exec(source))) return { tex: m[1]!, display: false };
  return { tex: source, display: false };
}

/** The equation number after a block, "(1)", if any. */
export function equationNumber(source: string): string | null {
  return /\(([^)\s$]+?)\)[ \t]*$/.exec(source.replace(/^[\s\S]*(?:\$\$|\\\])/, ""))?.[1] ?? null;
}
