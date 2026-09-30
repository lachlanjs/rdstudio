// Write the OpenAPI description of rdstudio serve's API (from the server's
// own zod schemas) to openapi.json, for HeyAPI to generate the typed client
// in src/lib/api/ (npm run generate).

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../packages/cli/src/config.ts";
import { createApp } from "../../packages/cli/src/serve.ts";

const app = createApp({ cfg: loadConfig(), site: ".", token: "", loopback: true });
const doc = app.getOpenAPI31Document({ openapi: "3.1.0", info: { title: "rdstudio serve", version: "0.1.0" } });
writeFileSync(fileURLToPath(new URL("../openapi.json", import.meta.url)), JSON.stringify(doc, null, 2) + "\n");
console.log("wrote openapi.json");
