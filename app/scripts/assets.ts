// Copy the dashboard's shared static files (themes, fonts, the service worker,
// icons) from the Python package's web folder into static/, until the old
// dashboard is retired and they move here for good. Run before dev and build.

import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("../", import.meta.url));
const WEB = join(APP, "..", "src", "rdstudio", "web");
const STATIC = join(APP, "static");

rmSync(STATIC, { recursive: true, force: true });
mkdirSync(join(STATIC, "vendor"), { recursive: true });
for (const f of ["themes", "fonts.css", "sw.js", "icon-192.png", "icon-512.png", "report.css", "report.js"]) {
  cpSync(join(WEB, f), join(STATIC, f), { recursive: true });
}
cpSync(join(WEB, "vendor", "fonts"), join(STATIC, "vendor", "fonts"), { recursive: true });
