// Apply write operations with the Node store, for fixtures/agree_writes.py:
//   node packages/cli/scripts/writes.ts <knowledge folder>  < operations.json
// Each operation is {op: "record" | "verify" | "propose" | "resolve", id, ...options}.

import { readFileSync } from "node:fs";
import { propose, resolve } from "../src/procedures.ts";
import { record, verify } from "../src/store.ts";

const root = process.argv[2]!;
const ops = JSON.parse(readFileSync(0, "utf8")) as Record<string, unknown>[];
const results = ops.map(({ op, id, ...opts }) => {
  try {
    if (op === "verify") return verify(root, String(id), String(opts.actor));
    if (op === "propose") return propose(root, String(id), opts as never);
    if (op === "resolve") return resolve(root, String(id), Number(opts.proposal), opts as never);
    return record(root, String(id), opts as never);
  } catch (err) {
    return { error: (err as Error).message };
  }
});
process.stdout.write(JSON.stringify(results));
