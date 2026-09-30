import { defineConfig } from "@hey-api/openapi-ts";

// npm run generate: openapi.json (from rdstudio serve's schemas) -> a typed
// fetch client for the parts of the dashboard that talk to the server.
export default defineConfig({
  input: "./openapi.json",
  output: { path: "src/lib/api", format: false, lint: false },
  plugins: ["@hey-api/client-fetch", "@hey-api/typescript", "@hey-api/sdk"],
});
