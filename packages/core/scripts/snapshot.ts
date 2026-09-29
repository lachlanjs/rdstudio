// Print the TypeScript core's conformance snapshot of a bundle folder as JSON:
//   node packages/core/scripts/snapshot.ts path/to/knowledge
// fixtures/agree.py compares it with the Python core's.

import { loadBundle } from "../src/node.ts";
import { snapshot } from "../test/snapshot.ts";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: snapshot.ts <bundle folder>");
  process.exit(2);
}
process.stdout.write(JSON.stringify(snapshot(loadBundle(dir))));
