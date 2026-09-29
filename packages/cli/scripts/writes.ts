// Apply write operations with the Node store, for fixtures/agree_writes.py:
//   node packages/cli/scripts/writes.ts <knowledge folder>  < operations.json
// Each operation is {op: "record", id, ...options} or {op: "verify", id, actor}.

import { readFileSync } from "node:fs";
import { record, verify } from "../src/store.ts";

const root = process.argv[2]!;
const ops = JSON.parse(readFileSync(0, "utf8")) as Record<string, unknown>[];
const results = ops.map(({ op, id, ...opts }) => {
  try {
    return op === "verify" ? verify(root, String(id), String(opts.actor)) : record(root, String(id), opts as never);
  } catch (err) {
    return { error: (err as Error).message };
  }
});
process.stdout.write(JSON.stringify(results));
