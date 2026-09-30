// rdstudio serve: the dashboard's files, the private learner record's API, and
// a rebuild whenever a source changes. A port of src/rdstudio/serve.py on Hono.
//
// Writes to the learner record are accepted only from the dashboard's own
// pages: the Origin must match the Host, the body must be JSON, and the
// request must carry the token handed out by GET (which other sites cannot
// read). When bound to localhost, the API answers only to localhost names,
// Tailscale names (*.ts.net, which `tailscale serve` passes through) and
// --allow-host names, against DNS rebinding.

import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { serve as nodeServe } from "@hono/node-server";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { MAX_EVENT_BYTES } from "@rdstudio/core";
import { build, WEB_DIR } from "./build.ts";
import type { Config } from "./config.ts";
import * as learner from "./learner.ts";
import { pyDumps } from "./pyjson.ts";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);
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

export interface ServerOptions {
  cfg: Config;
  site: string;
  token: string;
  loopback: boolean;
  allowHosts?: Iterable<string>;
}

// ------------------------------------------------------------------ learner API (documented as OpenAPI)

const ErrorBody = z.object({ error: z.string() }).openapi("Error");
const Event = z.record(z.string(), z.unknown()).openapi("LearnerEvent", {
  description: "One event: `event` (a name), optionally `concept`, `hash`, `kind` (autodidactic, interactive or ai), `id` and `device`; the server stamps `at`.",
});
const State = z.object({
  enabled: z.boolean(),
  token: z.string().nullable().openapi({ description: "Send as X-Rdstudio-Token when writing." }),
  dir: z.string().nullable(),
  events: z.array(Event),
}).openapi("LearnerState");

const getLearner = createRoute({
  method: "get", path: "/api/learner", summary: "The learner record: whether it is on, a write token, and every event",
  responses: {
    200: { description: "The record", content: { "application/json": { schema: State } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
  },
});
const postLearner = createRoute({
  method: "post", path: "/api/learner", summary: "Append one event to the learner record",
  request: {
    headers: z.object({ "x-rdstudio-token": z.string() }),
    body: { content: { "application/json": { schema: Event } }, required: true },
  },
  responses: {
    200: { description: "The event as stored", content: { "application/json": { schema: Event } } },
    400: { description: "Not a valid event", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } },
    409: { description: "The learner record is off", content: { "application/json": { schema: ErrorBody } } },
    413: { description: "Event too large", content: { "application/json": { schema: ErrorBody } } },
    415: { description: "Not JSON", content: { "application/json": { schema: ErrorBody } } },
  },
});

export function createApp({ cfg, site, token, loopback, allowHosts = [] }: ServerOptions): OpenAPIHono {
  const allowed = new Set([...allowHosts].map((h) => h.toLowerCase()));
  // No automatic validation: the checks below run in a fixed order, as in the Python server.
  const app = new OpenAPIHono({ defaultHook: () => undefined });

  const hostOk = (c: Context): boolean => {
    let host = "";
    try { host = new URL("http://" + (c.req.header("host") ?? "")).hostname.replace(/^\[|\]$/g, "").toLowerCase(); } catch { /* none */ }
    return !loopback || LOOPBACK.has(host) || host.endsWith(".ts.net") || allowed.has(host);
  };
  const json = (c: Context, status: number, value: unknown, close = false) => {
    const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store" };
    if (close) headers.Connection = "close";
    return c.body(pyDumps(value, { ensureAscii: false }), status as 200, headers);
  };

  app.openapi(getLearner, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    const on = learner.enabled(cfg);
    return json(c, 200, { enabled: on, token: on ? token : null, dir: on ? learner.recordDir(cfg) : null, events: on ? learner.events(cfg) : [] });
  }) as never);

  app.openapi(postLearner, (async (c: Context) => {
    // A refused body is never read, so this connection is not reused.
    const refuse = (status: number, error: string) => json(c, status, { error }, true);
    let origin = "";
    try { origin = new URL(c.req.header("origin") ?? "").host; } catch { /* no origin */ }
    if (!hostOk(c) || !c.req.header("origin") || origin !== c.req.header("host")) return refuse(403, "cross-origin request refused");
    if (c.req.header("x-rdstudio-token") !== token) return refuse(403, "bad token");
    if (!(c.req.header("content-type") ?? "").startsWith("application/json")) return refuse(415, "JSON only");
    if (!learner.enabled(cfg)) return refuse(409, "the learner record is off ([learner] enabled in the user config)");
    if (Number(c.req.header("content-length") ?? 0) > MAX_EVENT_BYTES) return refuse(413, "event too large");
    const raw = await c.req.text();
    let event: unknown;
    try { event = raw ? JSON.parse(raw) : null; } catch (err) { return refuse(400, (err as Error).message); }
    try {
      return json(c, 200, learner.append(cfg, event), true);
    } catch (err) {
      return refuse(400, (err as Error).message);
    }
  }) as never);

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
  return stamp.sort().join("\n");
}

const clock = () => new Date().toTimeString().slice(0, 8);

export function serve(cfg: Config, { host = "127.0.0.1", port = 8000, watch = true, allowHosts = [] as string[] } = {}): void {
  const site = build(cfg);
  const app = createApp({ cfg, site, token: randomBytes(24).toString("base64url"), loopback: LOOPBACK.has(host), allowHosts });
  const server = nodeServe({ fetch: app.fetch, hostname: host, port });
  if (watch) {
    let last = fingerprint(cfg);
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
  const stop = () => { server.close(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

