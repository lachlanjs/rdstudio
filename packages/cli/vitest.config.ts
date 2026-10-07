import { defineConfig } from "vitest/config";

// Search by meaning (T89) is off in tests unless a test turns it on: whether its model is installed on this
// machine must not change what the other tests see (the tools offered, what a prompt says).
export default defineConfig({ test: { env: { RDSTUDIO_EMBED: "off" } } });
