import { expect, test } from "vitest";
import { PyFloat, floatRepr, pyDumps } from "../src/pyjson.ts";

test("floats print as Python prints them", () => {
  expect([0, 2, -3, 0.1, 5.3, 1e-5, 1.5e-7, 1e16, 12345678901234567890, 0.0001].map(floatRepr))
    .toEqual(["0.0", "2.0", "-3.0", "0.1", "5.3", "1e-05", "1.5e-07", "1e+16", "1.2345678901234567e+19", "0.0001"]);
});

test("json.dumps: ASCII escapes, separators, indent", () => {
  expect(pyDumps({ a: "géo ℝ", b: [1, new PyFloat(2)], c: {} })).toBe('{"a": "g\\u00e9o \\u211d", "b": [1, 2.0], "c": {}}');
  expect(pyDumps({ a: [1, { b: null }], e: [] }, { indent: 2 })).toBe('{\n  "a": [\n    1,\n    {\n      "b": null\n    }\n  ],\n  "e": []\n}');
  expect(pyDumps("😀")).toBe('"\\ud83d\\ude00"');
});
