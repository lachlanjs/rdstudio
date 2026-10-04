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
