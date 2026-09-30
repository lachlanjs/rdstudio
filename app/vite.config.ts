import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

// In development (npm run dev), data/, api/ and reports/ come from a running
// `rdstudio serve` (RDSTUDIO_SERVE, default http://127.0.0.1:8000).
const serve = process.env.RDSTUDIO_SERVE ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: process.env.HOST ?? "127.0.0.1",
    proxy: Object.fromEntries(["/data", "/api", "/reports"].map((p) => [p, { target: serve, changeOrigin: false }])),
  },
});
