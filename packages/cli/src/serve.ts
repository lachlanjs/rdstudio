// rdstudio serve: the dashboard's files, the private learner record's API, and
// a rebuild whenever a source changes. A port of src/rdstudio/serve.py on Hono.
//
// Writes (to the learner record, and edits to notes) are accepted only from
// the dashboard's own pages: the Origin must match the Host, the body must be
// JSON, and the request must carry the token handed out by GET (which other
// sites cannot read). When bound to localhost, the API answers only to
// localhost names, Tailscale names (*.ts.net, which `tailscale serve` passes
// through) and --allow-host names, against DNS rebinding.

import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { serve as nodeServe } from "@hono/node-server";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { MAX_EVENT_BYTES } from "@rdstudio/core";
import { build, WEB_DIR } from "./build.ts";
import type { Config } from "./config.ts";
import { ConflictError, noteSource, saveNote } from "./edit.ts";
import { deleteFolder, deleteNote, moveFolder, moveNote } from "./reshape.ts";
import { StoreError, existingNotePath } from "./store.ts";
import * as learner from "./learner.ts";
import { historySince } from "./gitlog.ts";
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
  /** Refuse edits to notes (rdstudio serve --read-only). */
  readOnly?: boolean;
  /** Called after a note is written, before the reply: rebuild the site. */
  onWrite?: () => void;
}

const MAX_NOTE_BYTES = 2_000_000;

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

const Tour = z.object({
  name: z.string().openapi({ description: "Lowercase letters, digits and dashes." }),
  title: z.string(),
  description: z.string(),
  body: z.string().openapi({ description: "Markdown: a list whose items each start with a link to a stop, then its narration." }),
}).openapi("PrivateTour");
const TourName = z.object({ name: z.string().openapi({ param: { name: "name", in: "path" } }) });
const TourSave = z.object({ title: z.string(), description: z.string().optional(), body: z.string() }).openapi("PrivateTourSave");
const tourErrors = {
  400: { description: "Not a valid tour", content: { "application/json": { schema: ErrorBody } } },
  403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } },
  409: { description: "The learner record is off", content: { "application/json": { schema: ErrorBody } } },
  415: { description: "Not JSON", content: { "application/json": { schema: ErrorBody } } },
};
const getTours = createRoute({
  method: "get", path: "/api/learner/tours", summary: "Your private tours (none while the learner record is off)",
  responses: {
    200: { description: "The tours", content: { "application/json": { schema: z.array(Tour) } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
  },
});
const putTour = createRoute({
  method: "put", path: "/api/learner/tours/{name}", summary: "Write one of your private tours",
  request: { params: TourName, headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: TourSave } }, required: true } },
  responses: { 200: { description: "The tour as saved", content: { "application/json": { schema: Tour } } }, ...tourErrors },
});
const deleteTourRoute = createRoute({
  method: "delete", path: "/api/learner/tours/{name}", summary: "Delete one of your private tours",
  request: { params: TourName, headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: z.object({ name: z.string() }) } } }, ...tourErrors },
});

// ------------------------------------------------------------------ notes API

const Meta = z.record(z.string(), z.unknown()).openapi("NoteMeta", { description: "Frontmatter fields." });
const NoteSourceSchema = z.object({
  id: z.string(),
  path: z.string().openapi({ description: "Relative to the knowledge folder." }),
  version: z.string().openapi({ description: "Of the whole file; send it back as `base` when saving." }),
  meta: Meta,
  frontmatter: z.string().openapi({ description: "The YAML between the --- lines." }),
  body: z.string().openapi({ description: "Everything after the frontmatter, verbatim." }),
}).openapi("NoteSource");
const EditState = z.object({
  enabled: z.boolean(),
  token: z.string().nullable().openapi({ description: "Send as X-Rdstudio-Token when saving." }),
  actor: z.string().openapi({ description: "Who edits are attributed to, such as human:lachlan." }),
}).openapi("EditState");
const SaveBody = z.object({
  base: z.string().nullable().openapi({ description: "The version the edit started from; null creates the note." }),
  body: z.string().nullable().optional(),
  meta: Meta.nullable().optional().openapi({ description: "Fields to set; null removes one." }),
}).openapi("NoteSave");
const SaveReply = z.object({
  note: NoteSourceSchema, created: z.boolean(), changed: z.boolean(), significant: z.boolean(),
}).openapi("NoteSaved");
const Conflict = z.object({ error: z.string(), current: NoteSourceSchema.nullable() }).openapi("NoteConflict");
const NoteId = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" }, description: "The note's id, such as design/model (slashes encoded)." }) });

const History = z.object({
  available: z.boolean().openapi({ description: "Whether the project is a git repository." }),
  commits: z.array(z.object({ hash: z.string(), short: z.string(), author: z.string(), date: z.string(), subject: z.string() })),
  diff: z.string().nullable().openapi({ description: "The note then against now, as a unified diff, uncommitted changes included." }),
  base: z.string().nullable(),
  existed: z.boolean(),
}).openapi("NoteHistory");
const getHistory = createRoute({
  method: "get", path: "/api/history/{id}", summary: "What changed in a note since a time: commits and a diff (catching up)",
  request: { params: NoteId, query: z.object({ since: z.string().openapi({ description: "An ISO time, such as when you last looked." }) }) },
  responses: {
    200: { description: "The history", content: { "application/json": { schema: History } } },
    400: { description: "Not a valid note or time", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
  },
});

const getEdit = createRoute({
  method: "get", path: "/api/edit", summary: "Whether notes can be edited here, and the token to do it with",
  responses: {
    200: { description: "The editing state", content: { "application/json": { schema: EditState } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
  },
});
const getNote = createRoute({
  method: "get", path: "/api/notes/{id}", summary: "A note's source, to edit",
  request: { params: NoteId },
  responses: {
    200: { description: "The note", content: { "application/json": { schema: NoteSourceSchema } } },
    400: { description: "Not a valid note id", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
    404: { description: "No such note", content: { "application/json": { schema: ErrorBody } } },
  },
});
const putNote = createRoute({
  method: "put", path: "/api/notes/{id}", summary: "Save an edit to a note, or create it",
  request: {
    params: NoteId,
    headers: z.object({ "x-rdstudio-token": z.string() }),
    body: { content: { "application/json": { schema: SaveBody } }, required: true },
  },
  responses: {
    200: { description: "Saved", content: { "application/json": { schema: SaveReply } } },
    400: { description: "Not a valid edit", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } },
    409: { description: "The note changed since `base` (or exists, when creating): the current note is included", content: { "application/json": { schema: Conflict } } },
    413: { description: "Too large", content: { "application/json": { schema: ErrorBody } } },
    415: { description: "Not JSON", content: { "application/json": { schema: ErrorBody } } },
  },
});

const MoveBody = z.object({
  to: z.string().openapi({ description: "The new id, such as philosophy/motivation." }),
  base: z.string().nullable().optional().openapi({ description: "The note's version; refused if it changed since." }),
}).openapi("NoteMove");
const Moved = z.object({
  moved: z.array(z.object({ from: z.string(), to: z.string() })),
  rewritten: z.array(z.string()).openapi({ description: "Files whose links were updated." }),
}).openapi("Moved");
const FolderMoveBody = z.object({ from: z.string(), to: z.string() }).openapi("FolderMove");
const Deleted = z.object({
  deleted: z.string(),
  backlinks: z.array(z.string()).openapi({ description: "Notes that linked to it; those links are now broken." }),
}).openapi("NoteDeleted");
const FolderDeleted = z.object({
  deleted: z.string(),
  notes: z.array(z.string()).openapi({ description: "The notes deleted with it." }),
  backlinks: z.array(z.string()).openapi({ description: "Notes elsewhere that linked into it; those links are now broken." }),
}).openapi("FolderDeleted");
const FolderPath = z.object({ path: z.string().openapi({ param: { name: "path", in: "path" }, description: "The folder, such as design/old (slashes encoded)." }) });
const Token = z.object({ "x-rdstudio-token": z.string() });
const writeErrors = {
  400: { description: "Not a valid request", content: { "application/json": { schema: ErrorBody } } },
  403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } },
  409: { description: "The note changed since `base`, or is gone", content: { "application/json": { schema: Conflict } } },
  415: { description: "Not JSON", content: { "application/json": { schema: ErrorBody } } },
};

const postMove = createRoute({
  method: "post", path: "/api/notes/{id}/move", summary: "Move or rename a note, updating the links to it",
  request: { params: NoteId, headers: Token, body: { content: { "application/json": { schema: MoveBody } }, required: true } },
  responses: { 200: { description: "Moved", content: { "application/json": { schema: Moved } } }, ...writeErrors },
});
const deleteNoteRoute = createRoute({
  method: "delete", path: "/api/notes/{id}", summary: "Delete a note",
  request: { params: NoteId, headers: Token, query: z.object({ base: z.string().optional() }) },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: Deleted } } }, ...writeErrors },
});
const postFolderMove = createRoute({
  method: "post", path: "/api/folders/move", summary: "Move or rename a folder with everything in it, updating links",
  request: { headers: Token, body: { content: { "application/json": { schema: FolderMoveBody } }, required: true } },
  responses: { 200: { description: "Moved", content: { "application/json": { schema: Moved } } }, ...writeErrors },
});
const deleteFolderRoute = createRoute({
  method: "delete", path: "/api/folders/{path}", summary: "Delete a folder (with the notes in it, given withNotes)",
  request: { params: FolderPath, headers: Token, query: z.object({ withNotes: z.enum(["true", "false"]).optional() }) },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: FolderDeleted } } }, ...writeErrors },
});

export function createApp({ cfg, site, token, loopback, allowHosts = [], readOnly = false, onWrite }: ServerOptions): OpenAPIHono {
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

  // A refused body is never read, so that connection is not reused.
  const refuse = (c: Context, status: number, error: string) => json(c, status, { error }, true);
  /** Why a write is refused (the Origin, the token, the content type), or null. */
  const writeRefused = (c: Context, json = true) => {
    let origin = "";
    try { origin = new URL(c.req.header("origin") ?? "").host; } catch { /* no origin */ }
    if (!hostOk(c) || !c.req.header("origin") || origin !== c.req.header("host")) return refuse(c, 403, "cross-origin request refused");
    if (c.req.header("x-rdstudio-token") !== token) return refuse(c, 403, "bad token");
    if (json && !(c.req.header("content-type") ?? "").startsWith("application/json")) return refuse(c, 415, "JSON only");
    return null;
  };

  /** Run a change to the bundle for an endpoint: the checks, then `act`, a
   *  rebuild, and errors as replies. */
  const change = async (c: Context, act: (body: Record<string, unknown>) => unknown, json = true) => {
    const refused = writeRefused(c, json);
    if (refused) return refused;
    if (readOnly) return refuse(c, 403, "this server is read-only (rdstudio serve --read-only)");
    let body: Record<string, unknown> = {};
    if (json) {
      try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
      if (typeof body !== "object" || body === null || Array.isArray(body)) return refuse(c, 400, "expected a JSON object");
    }
    try {
      const result = act(body);
      onWrite?.();
      return jsonReply(c, result);
    } catch (err) {
      if (err instanceof ConflictError) return jsonReply(c, { error: err.message, current: err.current }, 409);
      if (err instanceof StoreError || (err as Error).name === "FrontmatterError") return refuse(c, 400, (err as Error).message);
      throw err;
    }
  };
  const jsonReply = (c: Context, value: unknown, status = 200) => json(c, status, value, true);
  const str = (v: unknown, name: string): string => {
    if (typeof v !== "string" || !v) throw new StoreError(`expected '${name}'`);
    return v;
  };

  app.openapi(postLearner, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (!learner.enabled(cfg)) return refuse(c, 409, "the learner record is off ([learner] enabled in the user config)");
    if (Number(c.req.header("content-length") ?? 0) > MAX_EVENT_BYTES) return refuse(c, 413, "event too large");
    const raw = await c.req.text();
    let event: unknown;
    try { event = raw ? JSON.parse(raw) : null; } catch (err) { return refuse(c, 400, (err as Error).message); }
    try {
      return json(c, 200, learner.append(cfg, event), true);
    } catch (err) {
      return refuse(c, 400, (err as Error).message);
    }
  }) as never);

  app.openapi(getTours, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    return json(c, 200, learner.enabled(cfg) ? learner.tours(cfg) : []);
  }) as never);
  /** A write to your private tours: the same checks as the record's. */
  const tourChange = async (c: Context, act: (body: Record<string, unknown>) => unknown, withBody = true) => {
    const refused = writeRefused(c, withBody);
    if (refused) return refused;
    if (!learner.enabled(cfg)) return refuse(c, 409, "the learner record is off ([learner] enabled in the user config)");
    let body: Record<string, unknown> = {};
    if (withBody) {
      try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
      if (typeof body !== "object" || body === null || Array.isArray(body)) return refuse(c, 400, "expected a JSON object");
    }
    try {
      return json(c, 200, act(body), true);
    } catch (err) {
      return refuse(c, 400, (err as Error).message);
    }
  };
  app.openapi(putTour, ((c: Context) => tourChange(c, (b) => learner.saveTour(cfg, c.req.param("name") ?? "", b))) as never);
  app.openapi(deleteTourRoute, ((c: Context) => tourChange(c, () => learner.deleteTour(cfg, c.req.param("name") ?? ""), false)) as never);

  const actor = cfg.human || "human:unknown";
  app.openapi(getEdit, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    return json(c, 200, { enabled: !readOnly, token: readOnly ? null : token, actor });
  }) as never);

  app.openapi(getHistory, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    const since = c.req.query("since") ?? "";
    if (Number.isNaN(Date.parse(since))) return json(c, 400, { error: "'since' is an ISO time" });
    try {
      const path = existingNotePath(cfg.knowledgeDir, c.req.param("id") ?? "");
      return json(c, 200, historySince(cfg.root, relative(cfg.root, path).split("\\").join("/"), new Date(since).toISOString()));
    } catch (err) {
      return json(c, 400, { error: (err as Error).message });
    }
  }) as never);

  app.openapi(getNote, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    try {
      return json(c, 200, noteSource(cfg.knowledgeDir, c.req.param("id") ?? ""));
    } catch (err) {
      return json(c, String((err as Error).message).startsWith("no such note") ? 404 : 400, { error: (err as Error).message });
    }
  }) as never);

  app.openapi(postMove, ((c: Context) => change(c, (b) =>
    moveNote(cfg.knowledgeDir, c.req.param("id") ?? "", str(b.to, "to"), typeof b.base === "string" ? b.base : null))) as never);
  app.openapi(deleteNoteRoute, ((c: Context) => change(c, () =>
    deleteNote(cfg.knowledgeDir, c.req.param("id") ?? "", c.req.query("base") ?? null), false)) as never);
  app.openapi(postFolderMove, ((c: Context) => change(c, (b) =>
    moveFolder(cfg.knowledgeDir, str(b.from, "from"), str(b.to, "to")))) as never);
  app.openapi(deleteFolderRoute, ((c: Context) => change(c, () =>
    deleteFolder(cfg.knowledgeDir, c.req.param("path") ?? "", c.req.query("withNotes") === "true"), false)) as never);

  app.openapi(putNote, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (readOnly) return refuse(c, 403, "this server is read-only (rdstudio serve --read-only)");
    if (Number(c.req.header("content-length") ?? 0) > MAX_NOTE_BYTES) return refuse(c, 413, "note too large");
    let edit: { base?: unknown; body?: unknown; meta?: unknown };
    try { edit = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    if (typeof edit !== "object" || edit === null || !("base" in edit) || (edit.base !== null && typeof edit.base !== "string")
      || (edit.body != null && typeof edit.body !== "string")
      || (edit.meta != null && (typeof edit.meta !== "object" || Array.isArray(edit.meta)))) {
      return refuse(c, 400, "expected {base, body?, meta?}");
    }
    try {
      const saved = saveNote(cfg.knowledgeDir, c.req.param("id") ?? "", {
        actor, base: edit.base as string | null, body: edit.body as string | null | undefined, meta: edit.meta as Record<string, unknown> | null | undefined,
      });
      if (saved.changed) onWrite?.();
      return json(c, 200, saved, true);
    } catch (err) {
      if (err instanceof ConflictError) return json(c, 409, { error: err.message, current: err.current }, true);
      if (err instanceof StoreError || (err as Error).name === "FrontmatterError") return refuse(c, 400, (err as Error).message);
      throw err;
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

export function serve(cfg: Config, { host = "127.0.0.1", port = 8000, watch = true, allowHosts = [] as string[], readOnly = false } = {}): void {
  const site = build(cfg);
  let last = fingerprint(cfg);
  // After an edit, rebuild at once, so the page sees it on its next look.
  const onWrite = () => {
    try { build(cfg); } catch (err) { console.error(`[${clock()}] build failed: ${(err as Error).message}`); }
    last = fingerprint(cfg);
  };
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

