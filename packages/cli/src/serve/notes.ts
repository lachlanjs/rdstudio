// rdstudio serve: editing: a note's source and history, saving, moving and deleting, and artifacts.

import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import * as api from "./api.ts";
import { MAX_NOTE_BYTES, type Ctx } from "./shared.ts";
import { relative } from "node:path";
import { ArtifactError, SANDBOX, artifactPath, keepPreview, preview, saveArtifact } from "../artifacts.ts";
import { ConflictError, noteSource, saveNote } from "../edit.ts";
import { historySince } from "../gitlog.ts";
import { deleteFolder, deleteNote, moveFolder, moveNote } from "../reshape.ts";
import { StoreError, existingNotePath } from "../store.ts";

export function notesRoutes(app: OpenAPIHono, ctx: Ctx): void {
  const { cfg, token, readOnly, onWrite, actor, hostOk, json, refuse, writeRefused, change, tourChange, str } = ctx;
  app.openapi(api.getEdit, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    return json(c, 200, { enabled: !readOnly, token: readOnly ? null : token, actor });
  }) as never);

  app.openapi(api.getHistory, ((c: Context) => {
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

  app.openapi(api.getNote, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    try {
      return json(c, 200, noteSource(cfg.knowledgeDir, c.req.param("id") ?? ""));
    } catch (err) {
      return json(c, String((err as Error).message).startsWith("no such note") ? 404 : 400, { error: (err as Error).message });
    }
  }) as never);

  app.openapi(api.postMove, ((c: Context) => change(c, (b) =>
    moveNote(cfg.knowledgeDir, c.req.param("id") ?? "", str(b.to, "to"), typeof b.base === "string" ? b.base : null))) as never);
  app.openapi(api.deleteNoteRoute, ((c: Context) => change(c, () =>
    deleteNote(cfg.knowledgeDir, c.req.param("id") ?? "", c.req.query("base") ?? null), false)) as never);
  app.openapi(api.postFolderMove, ((c: Context) => change(c, (b) =>
    moveFolder(cfg.knowledgeDir, str(b.from, "from"), str(b.to, "to")))) as never);
  app.openapi(api.deleteFolderRoute, ((c: Context) => change(c, () =>
    deleteFolder(cfg.knowledgeDir, c.req.param("path") ?? "", c.req.query("withNotes") === "true"), false)) as never);

  app.openapi(api.putNote, (async (c: Context) => {
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
        assist: Array.isArray((edit as { assist?: unknown }).assist) ? ((edit as { assist: unknown[] }).assist.filter((m) => typeof m === "string") as string[]) : null,
      });
      if (saved.changed) onWrite?.();
      return json(c, 200, saved, true);
    } catch (err) {
      if (err instanceof ConflictError) return json(c, 409, { error: err.message, current: err.current }, true);
      if (err instanceof StoreError || (err as Error).name === "FrontmatterError") return refuse(c, 400, (err as Error).message);
      throw err;
    }
  }) as never);

  // Artifacts made in the app (T78): held to be checked, then written beside the notes.
  app.openapi(api.previewArtifact, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    let body: { path?: unknown; html?: unknown };
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    if (typeof body.path !== "string" || typeof body.html !== "string") return refuse(c, 400, "expected {path, html}");
    try { artifactPath(cfg.knowledgeDir, body.path); } catch (err) { return refuse(c, 400, (err as Error).message); }
    const path = body.path.replace(/^\/+/, "");
    return json(c, 200, { url: `p/${keepPreview(path, body.html)}/${path.split("/").map(encodeURIComponent).join("/")}` }, true);
  }) as never);
  app.openapi(api.putArtifact, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (readOnly) return refuse(c, 403, "this server is read-only (rdstudio serve --read-only)");
    let body: { html?: unknown; replace?: unknown; author?: unknown };
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    if (typeof body.html !== "string") return refuse(c, 400, "expected {html}");
    try {
      const made = typeof body.author === "string" && /^[\w./:@ -]{1,160}$/.test(body.author) ? body.author : actor;
      const saved = saveArtifact(cfg.knowledgeDir, c.req.param("path") ?? "", body.html, { author: made, replace: body.replace === true });
      onWrite?.();
      return json(c, 200, saved, true);
    } catch (err) {
      if (err instanceof ArtifactError) return refuse(c, err.status, err.message);
      throw err;
    }
  }) as never);
  app.get("/p/:id/*", (c) => {
    if (!hostOk(c)) return c.text("Host not allowed", 403);
    const html = preview(c.req.param("id"));
    return html === null ? c.text("Not found", 404) : c.body(html, 200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": SANDBOX, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  });
}
