// The dashboard is a single-page app: no server rendering, hash routing (so
// addresses like #/k/design/model keep working, and the files can be served
// from any folder: rdstudio serve, a static export, Tauri), built with
// adapter-static into build/, which rdstudio build then copies into a site.
import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    adapter: adapter({ pages: "build", assets: "build", fallback: "index.html", strict: false }),
    router: { type: "hash" },
    paths: { relative: true },
    output: { bundleStrategy: "split" },
    // rdstudio serve and exports serve data/, api/ and reports/ beside the app.
    alias: { $core: "../packages/core/src" },
  },
};
