import { expect, test } from "vitest";
import { lineDiff } from "./linediff.ts";

test("a line diff marks added and removed lines, folding unchanged runs", () => {
  const a = ["one", "two", "three", "four", "five", "six", "seven", "eight"].join("\n") + "\n";
  const b = ["one", "two", "three", "4", "five", "six", "seven", "eight", "nine"].join("\n");
  expect(lineDiff(a, b, 1)).toEqual([
    { kind: "hunk", text: "" },
    { kind: "same", text: "three" },
    { kind: "del", text: "four" },
    { kind: "add", text: "4" },
    { kind: "same", text: "five" },
    { kind: "hunk", text: "" },
    { kind: "same", text: "eight" },
    { kind: "add", text: "nine" },
  ]);
  expect(lineDiff("same\n", "same")).toEqual([{ kind: "hunk", text: "" }]);
  expect(lineDiff("", "new")).toEqual([{ kind: "del", text: "" }, { kind: "add", text: "new" }]);
});
