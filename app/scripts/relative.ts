// Make the built index.html ask for its files relative to itself (./_app/...),
// so the dashboard works below the site root too, as on GitHub Pages. With hash
// routing SvelteKit writes this page as a fallback page, whose file addresses
// start at the root (/_app/...) even with paths.relative; it already works out
// its base at run time. The page is always at the dashboard's root, so "./" is
// right. Run after vite build.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const page = fileURLToPath(new URL("../../src/rdstudio/web/index.html", import.meta.url));
const before = readFileSync(page, "utf8");
const after = before.replace(/(href|src)="\/(?!\/)/g, '$1="./').replace(/import\("\/(?!\/)/g, 'import("./');
if (/(href|src)="\/[^/]|import\("\/[^/]/.test(after)) throw new Error("index.html still has root-relative addresses");
if (!after.includes('import("./_app/')) throw new Error("index.html no longer imports from /_app/: check the SvelteKit build");
writeFileSync(page, after);
