// The core runs in browsers and Tauri as well as Node, so only node.ts (the
// folder loader) may use Node's modules.

import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

const SRC = new URL("../src/", import.meta.url);

test.each(readdirSync(SRC).filter((f) => f.endsWith(".ts") && f !== "node.ts"))("%s imports no Node modules", (file) => {
  const source = readFileSync(new URL(file, SRC), "utf8");
  expect(source).not.toMatch(/from\s+["'](node:|fs|path|crypto|os)["']/);
  expect(source).not.toMatch(/\bprocess\.|\bBuffer\b|\brequire\(/);
});
