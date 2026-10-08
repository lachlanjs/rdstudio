// rdstudio serve: the dashboard's files, the API, and a rebuild whenever a
// source changes. On Hono. The API's routes are described in serve/api.ts, and
// what each does is in serve/, by area; what they all share (who may ask, who
// may write) is serve/shared.ts.
//
// Writes (to the learner record, and edits to notes) are accepted only from
// the dashboard's own pages: the Origin must match the Host, the body must be
// JSON, and the request must carry the token handed out by GET (which other
// sites cannot read). When bound to localhost, the API answers only to
// localhost names, Tailscale names (*.ts.net, which `tailscale serve` passes
// through) and --allow-host names, against DNS rebinding.

import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { serve as nodeServe } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { SANDBOX } from "./artifacts.ts";
import { build, WEB_DIR } from "./build.ts";
import { codeStamp } from "./code.ts";
import type { Config } from "./config.ts";
import * as embed from "./embed.ts";
import { agentsRoutes } from "./serve/agents.ts";
import { aiRoutes } from "./serve/ai.ts";
import { axisRoutes } from "./serve/axis.ts";
import { learnerRoutes } from "./serve/learner.ts";
import { notesRoutes } from "./serve/notes.ts";
import { LOOPBACK, context, type ServerOptions } from "./serve/shared.ts";
import { teacherRoutes } from "./serve/teacher.ts";

export type { ServerOptions };

// Text worth compressing: on a slow link the dashboard's scripts and data shrink to about a third.
const COMPRESSIBLE = [".html", ".js", ".mjs", ".css", ".json", ".md", ".svg", ".txt", ".webmanifest", ".map"];
const TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".md": "text/markdown", ".svg": "image/svg+xml", ".txt": "text/plain",
  ".webmanifest": "application/manifest+json", ".map": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/vnd.microsoft.icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".pdf": "application/pdf",
  ".wasm": "application/wasm", ".csv": "text/csv", ".xml": "text/xml", ".mp4": "video/mp4", ".webm": "video/webm",
};
const gzipped = new Map<string, Buffer>();

export function createApp(opts: ServerOptions): OpenAPIHono {
  // No automatic validation: each handler's checks run in a fixed order.
  const app = new OpenAPIHono({ defaultHook: () => undefined });
  const ctx = context(opts), { json } = ctx, { site } = opts;
  learnerRoutes(app, ctx);
  teacherRoutes(app, ctx);
  aiRoutes(app, ctx);
  axisRoutes(app, ctx);
  agentsRoutes(app, ctx);
  notesRoutes(app, ctx);
  app.doc31("/api/openapi.json", { openapi: "3.1.0", info: { title: "rdstudio serve", version: "0.1.0" } });

  app.all("/api/*", (c) => json(c, 404, { error: "not found" }));
  app.on(["GET", "HEAD"], "*", (c) => staticFile(c, site));
  return app;
}

// ------------------------------------------------------------------ static files

function cacheControl(path: string): string | null {
  if (path.startsWith("/vendor/")) return "public, max-age=604800"; // changes only when rdstudio is upgraded
  if (path.startsWith("/data/") || /\.(html|js|css)$/.test(path) || path === "/") return "no-cache"; // revalidate (cheap: 304)
  return null;
}

const httpDate = (seconds: number) => new Date(seconds * 1000).toUTCString();

function staticFile(c: Context, site: string): Response {
  const url = new URL(c.req.url);
  let rel: string;
  try { rel = decodeURIComponent(url.pathname); } catch { return c.text("Bad request", 400); }
  let file = resolve(site, "." + rel);
  if (file !== resolve(site) && !file.startsWith(resolve(site) + sep)) return c.text("File not found", 404);
  const headers: Record<string, string> = {};
  const cc = cacheControl(url.pathname);
  if (cc) headers["Cache-Control"] = cc;
  // An artifact is sandboxed, so to it the app's fonts are another origin's: without this it could not load
  // the theme's type. Fonts only: they are rdstudio's own files and say nothing of the project.
  if (/\.(woff2?|ttf|otf)$/i.test(url.pathname)) headers["Access-Control-Allow-Origin"] = "*";
  let st;
  try { st = statSync(file); } catch { return c.body("File not found", 404, headers); }
  if (st.isDirectory()) {
    if (!url.pathname.endsWith("/")) return c.body(null, 301, { ...headers, Location: url.pathname + "/" + url.search });
    file = join(file, "index.html");
    try { st = statSync(file); } catch { return c.body("File not found", 404, headers); }
  }
  if (!st.isFile()) return c.body("File not found", 404, headers);
  const mtime = Math.floor(st.mtimeMs / 1000);
  const since = c.req.header("if-modified-since");
  const gzip = (c.req.header("accept-encoding") ?? "").includes("gzip") && COMPRESSIBLE.some((e) => file.endsWith(e));
  if (gzip) headers.Vary = "Accept-Encoding";
  if (since && !c.req.header("if-none-match")) {
    const t = Date.parse(since);
    if (!Number.isNaN(t) && mtime <= t / 1000) return c.body(null, 304, headers);
  }
  headers["Content-Type"] = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  // An artifact (T76) runs apart from the app, whether framed or opened on its own: no access to the
  // app's page, its storage or the write token.
  if (/^\/a\//.test(url.pathname)) { headers["Content-Security-Policy"] = SANDBOX; headers["X-Content-Type-Options"] = "nosniff"; }
  headers["Last-Modified"] = httpDate(mtime);
  let body: Buffer;
  if (gzip) {
    const key = `${file}\0${st.mtimeMs}\0${st.size}`;
    body = gzipped.get(key) ?? gzipSync(readFileSync(file), { level: 6 });
    if (gzipped.size > 512) gzipped.clear();
    gzipped.set(key, body);
    headers["Content-Encoding"] = "gzip";
  } else {
    body = readFileSync(file);
  }
  headers["Content-Length"] = String(body.length);
  if (c.req.method === "HEAD") return c.body(null, 200, headers);
  return c.body(new Uint8Array(body), 200, headers);
}

// ------------------------------------------------------------------ watching

/** A cheap summary of everything the build reads. */
function fingerprint(cfg: Config): string {
  const stamp: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith(".")) walk(p); continue; }
      try { const st = statSync(p); stamp.push(`${p}\0${st.mtimeMs}\0${st.size}`); } catch { /* gone */ }
    }
  };
  for (const root of [cfg.knowledgeDir, cfg.reportsDir, join(cfg.root, ".claude"), WEB_DIR]) walk(root);
  for (const f of [join(cfg.root, "rdstudio.toml"), join(cfg.root, ".git", "HEAD"), join(cfg.root, ".git", "index")]) {
    if (existsSync(f)) { const st = statSync(f); stamp.push(`${f}\0${st.mtimeMs}\0${st.size}`); }
  }
  return stamp.sort().join("\n") + "\n" + codeStamp(cfg); // the code map follows the code
}

const clock = () => new Date().toTimeString().slice(0, 8);

export function serve(cfg: Config, { host = "127.0.0.1", port = 8000, watch = true, allowHosts = [] as string[], readOnly = false } = {}): void {
  const site = build(cfg);
  let last = fingerprint(cfg);
  // After an edit, rebuild at once, so the page sees it on its next look.
  const onWrite = () => {
    try { build(cfg); } catch (err) { console.error(`[${clock()}] build failed: ${(err as Error).message}`); }
    last = fingerprint(cfg);
    embed.refreshInBackground(cfg); // the sections that changed, for search by meaning (T89); the save does not wait
  };
  embed.refreshInBackground(cfg); // and whatever changed while this was not running
  const app = createApp({ cfg, site, token: randomBytes(24).toString("base64url"), loopback: LOOPBACK.has(host), allowHosts, readOnly, onWrite });
  const server = nodeServe({ fetch: app.fetch, hostname: host, port });
  if (watch) {
    setInterval(() => {
      const current = fingerprint(cfg);
      if (current === last) return;
      try {
        build(cfg);
        console.log(`[${clock()}] rebuilt`);
      } catch (err) {
        console.error(`[${clock()}] build failed: ${(err as Error).message}`); // keep serving the last good build
      }
      last = fingerprint(cfg); // the build may regenerate index.md files
    }, 1000).unref();
  }
  const shown = host === "127.0.0.1" || host === "0.0.0.0" ? "localhost" : host;
  console.log(`Serving ${cfg.title} at http://${shown}:${port}/  (Ctrl+C to stop)`);
  if (host === "0.0.0.0") console.log("Listening on all interfaces (reachable over your tailnet/LAN).");
  if (!readOnly) console.log("Notes can be edited from the dashboard (--read-only to turn that off).");
  const stop = () => { server.close(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

