import { expect, test } from "vitest";
import { assemble, estimate, shorten } from "../src/context.ts";

test("text is shortened to its budget at a break, and says so", () => {
  expect(shorten("short", 10)).toEqual({ text: "short", shortened: false });
  const long = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} ${"x".repeat(30)}`).join("\n\n");
  const s = shorten(long, 100);
  expect(s.shortened).toBe(true);
  expect(s.text.length).toBeLessThanOrEqual(400);
  expect(s.text).toMatch(/x\n\[…shortened to fit\]$/);
  expect(estimate("abcd".repeat(10))).toBe(10);
});

test("sections become system and user messages, cached where asked, with a report of what was sent", () => {
  const { messages, seen } = assemble([
    { name: "Skill", text: "Teach well.", tokens: 1000, cache: true },
    { name: "Exercise", text: "Find x.", tokens: 1000, cache: true },
    { name: "Empty", text: "  ", tokens: 10 },
    { name: "Your draft", text: "x = 2", tokens: 1000, role: "user" },
    { name: "Asked", text: "Hint, please.", tokens: 1000, role: "user" },
  ]);
  expect(messages).toEqual([
    { role: "system", content: [{ text: "## Skill\n\nTeach well.", cache: true }, { text: "## Exercise\n\nFind x.", cache: true }] },
    { role: "user", content: [{ text: "## Your draft\n\nx = 2" }, { text: "## Asked\n\nHint, please." }] },
  ]);
  expect(seen.map((s) => [s.name, s.role, s.shortened])).toEqual([["Skill", "system", false], ["Exercise", "system", false], ["Your draft", "user", false], ["Asked", "user", false]]);
});

test("with an input limit, loose sections are shortened in proportion and kept ones are not (T110)", () => {
  const long = (n: number) => Array.from({ length: n }, (_, i) => `Line ${i} ${"y".repeat(36)}`).join("\n");
  const sections = [
    { name: "How", text: "Be exact.", tokens: 500, keep: true },
    { name: "Found", text: long(200), tokens: 4000 },
    { name: "Code", text: long(100), tokens: 4000 },
    { name: "Aside", text: "A short aside.", tokens: 500 },
    { name: "Asked", text: "What is the point?", tokens: 500, role: "user" as const, keep: true },
  ];
  const whole = assemble(sections);
  const total = (r: { seen: { tokens: number }[] }) => r.seen.reduce((n, x) => n + x.tokens, 0);
  expect(total(whole)).toBeGreaterThan(3000);
  expect(assemble(sections, 100_000).seen).toEqual(whole.seen); // a limit not reached changes nothing

  const fit = assemble(sections, 1500), by = Object.fromEntries(fit.seen.map((x) => [x.name, x]));
  expect(total(fit)).toBeLessThanOrEqual(1500);
  expect(total(fit)).toBeGreaterThan(1200); // and the room is used
  expect(by.How!.text).toBe("## How\n\nBe exact.");
  expect(by.Asked!.text).toBe("## Asked\n\nWhat is the point?");
  expect(by.Aside!.shortened).toBe(false); // small enough to stay whole
  expect(by.Found!.shortened && by.Code!.shortened).toBe(true);
  expect(by.Found!.text).toMatch(/\[…shortened to fit\]$/);
  expect(by.Found!.tokens / by.Code!.tokens).toBeGreaterThan(1.6); // twice the text, about twice the room
  // What must be kept is more than the limit: refused, with what to do.
  expect(() => assemble([{ name: "Note", text: long(400), tokens: 9000, keep: true }, { name: "Found", text: long(50), tokens: 900 }], 2000)).toThrow(/larger than the input limit.*limit is 2000/);
});
