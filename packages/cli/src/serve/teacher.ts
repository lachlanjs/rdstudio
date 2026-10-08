// rdstudio serve: the teacher's skills, files and profile, your drafts, and the tutor.

import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import * as api from "./api.ts";
import type { Ctx } from "./shared.ts";
import { streamSSE } from "hono/streaming";
import * as learner from "../learner.ts";
import * as models from "../models.ts";
import * as teacher from "../teacher.ts";
import * as tutor from "../tutor.ts";

export function teacherRoutes(app: OpenAPIHono, ctx: Ctx): void {
  const { cfg, token, readOnly, onWrite, actor, hostOk, json, refuse, writeRefused, change, tourChange, str } = ctx;
  const teacherState = () => {
    const on = learner.enabled(cfg), p = teacher.profile(cfg);
    return { enabled: on, profile: p.profile, profileSet: p.set, guessed: teacher.guessProfile(cfg), dir: on ? teacher.teacherDir(cfg) : null,
      skills: teacher.skills(cfg), history: on ? teacher.history(cfg) : [] };
  };
  app.openapi(api.getTeacher, ((c: Context) => (hostOk(c) ? json(c, 200, teacherState()) : json(c, 403, { error: "host not allowed" }))) as never);
  // The mode, switched from the app (the tag beside the project's name, or Settings): the profile in rdstudio.toml.
  app.openapi(api.putProfile, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (readOnly) return refuse(c, 403, "this server is read-only (rdstudio serve --read-only)");
    let body: { profile?: unknown };
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    try { teacher.setProfile(cfg, String(body.profile ?? "")); } catch (err) { return refuse(c, 400, (err as Error).message); }
    onWrite?.(); // whether the code is indexed follows the profile
    return json(c, 200, teacherState(), true);
  }) as never);
  app.openapi(api.getSkill, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    let found: teacher.Skill | null = null;
    try { found = teacher.skill(cfg, c.req.param("name") ?? ""); } catch { /* a bad name */ }
    return found ? json(c, 200, found) : json(c, 404, { error: "no such skill" });
  }) as never);
  app.openapi(api.getTeacherFile, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    if (!learner.enabled(cfg)) return json(c, 409, { error: "the learner record is off ([learner] enabled in the user config)" });
    try { return json(c, 200, teacher.readFile(cfg, c.req.param("name") ?? "")); } catch (err) { return json(c, 400, { error: (err as Error).message }); }
  }) as never);
  app.openapi(api.putTeacherFile, ((c: Context) => tourChange(c, (b) => teacher.writeFile(cfg, c.req.param("name") ?? "", b.text, teacher.BY_DEVELOPER))) as never);

  app.openapi(api.askTutor, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (!learner.enabled(cfg)) return refuse(c, 409, "the learner record is off ([learner] enabled in the user config)");
    let body: Record<string, unknown>;
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const a: tutor.Ask = { exercise: c.req.param("id") ?? "", mode: body.mode as tutor.Mode, text: str(body.text) ?? "", working: str(body.working),
      prompt: str(body.prompt), selection: str(body.selection), confidence: str(body.confidence) };
    // Problems found before anything is sent are plain errors; after, they are events.
    if (!(tutor.MODES as readonly string[]).includes(a.mode)) return refuse(c, 400, `a mode is one of ${tutor.MODES.join(", ")}`);
    if (!models.apiKey()) return refuse(c, 409, "No OpenRouter key: connect an account on the Teacher page.");
    return streamSSE(c, async (stream) => {
      try {
        const { turn, seen } = await tutor.ask(cfg, a, (piece) => { void stream.writeSSE({ event: "text", data: JSON.stringify(piece) }); });
        await stream.writeSSE({ event: "done", data: JSON.stringify({ turn, seen }) });
      } catch (err) {
        await stream.writeSSE({ event: "error", data: JSON.stringify((err as Error).message) });
      }
    });
  }) as never);


  app.openapi(api.listDraftsRoute, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    return json(c, 200, learner.enabled(cfg) ? teacher.listDrafts(cfg) : []);
  }) as never);
  app.openapi(api.getDraft, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    if (!learner.enabled(cfg)) return json(c, 409, { error: "the learner record is off ([learner] enabled in the user config)" });
    try { return json(c, 200, teacher.readDraft(cfg, c.req.param("id") ?? "")); } catch (err) { return json(c, 400, { error: (err as Error).message }); }
  }) as never);
  const draftId = (c: Context) => c.req.param("id") ?? "";
  app.openapi(api.putDraft, ((c: Context) => tourChange(c, (b) => teacher.saveDraft(cfg, draftId(c), b))) as never);
  app.openapi(api.keepDraftVersion, ((c: Context) => tourChange(c, (b) => teacher.keepVersion(cfg, draftId(c), b.reason))) as never);
  app.openapi(api.restoreDraft, ((c: Context) => tourChange(c, (b) => teacher.restoreVersion(cfg, draftId(c), b.version))) as never);
  app.openapi(api.fileDraftRoute, ((c: Context) => tourChange(c, (b) => teacher.fileDraft(cfg, draftId(c), b.attempt))) as never);
  app.openapi(api.putSkill, ((c: Context) => tourChange(c, (b) => teacher.saveSkill(cfg, c.req.param("name") ?? "", b.text))) as never);
  app.openapi(api.deleteSkill, ((c: Context) => tourChange(c, () => ({ skill: teacher.resetSkill(cfg, c.req.param("name") ?? "") }), false)) as never);
}
