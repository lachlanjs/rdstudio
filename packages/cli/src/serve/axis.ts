// rdstudio serve: Axis beside a note and on the Atlas: asking, what it proposes, and the chats and questions kept.

import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import * as api from "./api.ts";
import { MAX_NOTE_BYTES, type Ctx } from "./shared.ts";
import { streamSSE } from "hono/streaming";
import * as assist from "../assist.ts";
import * as assistchats from "../assistchats.ts";
import * as atlasask from "../atlasask.ts";
import * as atlasasks from "../atlasasks.ts";
import * as learner from "../learner.ts";
import * as models from "../models.ts";
import * as proposals from "../proposals.ts";

export function axisRoutes(app: OpenAPIHono, ctx: Ctx): void {
  const { cfg, token, readOnly, onWrite, actor, hostOk, json, refuse, writeRefused, change, tourChange, str } = ctx;
  // An agent in the editor (T74): the note is the editor's text, not the file's, so nothing need be saved first.
  app.openapi(api.assistNote, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (Number(c.req.header("content-length") ?? 0) > MAX_NOTE_BYTES) return refuse(c, 413, "note too large");
    let body: Record<string, unknown>;
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    const str = (v: unknown) => (typeof v === "string" ? v : undefined), num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0);
    const a: assist.Ask = { note: c.req.param("id") ?? "", mode: body.mode as assist.Mode, body: str(body.body) ?? "", from: num(body.from), to: num(body.to), prompt: str(body.prompt), title: str(body.title) };
    if ((models.TIERS as readonly string[]).includes(body.tier as string)) a.tier = body.tier as models.Tier;
    const fix = body.fix as { html?: unknown; problems?: unknown } | undefined;
    if (fix && typeof fix.html === "string" && Array.isArray(fix.problems)) a.fix = { html: fix.html, problems: fix.problems.filter((x) => typeof x === "string").slice(0, 12) as string[] };
    if (a.mode === "chat") {
      if (typeof body.at === "number" && Number.isFinite(body.at)) a.at = Math.trunc(body.at);
      const may = body.may as { passage?: unknown; note?: unknown } | undefined;
      a.may = { passage: may?.passage === true, note: may?.note === true };
      if (Array.isArray(body.thread)) a.thread = (body.thread as { question?: unknown; answer?: unknown }[]).filter((t) => t && typeof t.question === "string" && typeof t.answer === "string").map((t) => ({ question: t.question as string, answer: t.answer as string }));
    }
    if (!(assist.MODES as readonly string[]).includes(a.mode)) return refuse(c, 400, `a mode is one of ${assist.MODES.join(", ")}`);
    if (!models.apiKey()) return refuse(c, 409, "No model account is connected: connect one on the Teacher page.");
    try { assist.prepare(cfg, a); } catch (err) { return refuse(c, 400, (err as Error).message); } // what is wrong with the request, before anything is sent
    return streamSSE(c, async (stream) => {
      try {
        const { reply, seen } = await assist.ask(cfg, a, {
          onText: (piece) => { void stream.writeSSE({ event: "text", data: JSON.stringify(piece) }); },
          // Something looked up: what was written before it was not the reply, so the text starts again.
          onStep: (step) => { void stream.writeSSE({ event: "step", data: JSON.stringify(step) }); },
        });
        if (a.mode !== "chat") { await stream.writeSSE({ event: "done", data: JSON.stringify({ reply, seen }) }); return; }
        // A chat's turn is kept in the learner record (T97), where that is on; failing to keep it does not lose the reply.
        const turn = assistchats.turnOf(a, reply);
        let chat: string | null = null;
        try { chat = assistchats.keep(cfg, a.note, a.title?.trim() || a.note, turn, str(body.chat))?.id ?? null; } catch { /* not kept */ }
        await stream.writeSSE({ event: "done", data: JSON.stringify({ reply, seen, turn, chat }) });
      } catch (err) {
        await stream.writeSSE({ event: "error", data: JSON.stringify((err as Error).message) });
      }
    });
  }) as never);

  // Ask Atlas (T85): the same lookups, asked from the map.
  app.openapi(api.askAtlas, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    let body: Record<string, unknown>;
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    const q: atlasask.Question = { question: typeof body.question === "string" ? body.question : "", start: typeof body.start === "string" ? body.start : undefined };
    if ((models.TIERS as readonly string[]).includes(body.tier as string)) q.tier = body.tier as models.Tier;
    // Proposals are offered only where a note could be written at all.
    if ((body.may as { propose?: unknown } | undefined)?.propose === true && !readOnly) q.may = { propose: true };
    if (!models.apiKey()) return refuse(c, 409, "No model account is connected: connect one on the Axis page.");
    try { atlasask.prepare(cfg, q); } catch (err) { return refuse(c, 400, (err as Error).message); }
    return streamSSE(c, async (stream) => {
      try {
        const { answer, seen } = await atlasask.ask(cfg, q, {
          onText: (piece) => { void stream.writeSSE({ event: "text", data: JSON.stringify(piece) }); },
          onStep: (step) => { void stream.writeSSE({ event: "step", data: JSON.stringify(step) }); },
        });
        // Kept in the learner record (T94), where that is on; failing to keep it does not lose the answer.
        let kept: string | null = null;
        try { kept = atlasasks.keep(cfg, answer, q.start)?.id ?? null; } catch { /* not kept */ }
        await stream.writeSSE({ event: "done", data: JSON.stringify({ answer, seen, kept }) });
      } catch (err) {
        await stream.writeSSE({ event: "error", data: JSON.stringify((err as Error).message) });
      }
    });
  }) as never);

  // The questions kept (T94).
  app.openapi(api.acceptProposal, ((c: Context) => change(c, (b) =>
    proposals.apply(cfg.knowledgeDir, b.proposal, { actor, model: str(b.model, "model") }))) as never);

  app.openapi(api.listAsks, ((c: Context) => (hostOk(c) ? json(c, 200, { enabled: learner.enabled(cfg), asks: atlasasks.list(cfg) }) : json(c, 403, { error: "host not allowed" }))) as never);
  app.openapi(api.getAsk, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    try { return json(c, 200, atlasasks.read(cfg, c.req.param("id") ?? "")); } catch (err) { return json(c, 404, { error: (err as Error).message }); }
  }) as never);
  app.openapi(api.forgetAsk, ((c: Context) => {
    const refused = writeRefused(c, false);
    if (refused) return refused;
    try { return json(c, 200, atlasasks.forget(cfg, c.req.param("id") ?? "")); } catch (err) { return refuse(c, 400, (err as Error).message); }
  }) as never);

  // The chats kept (T97).
  app.openapi(api.listChats, ((c: Context) => (hostOk(c) ? json(c, 200, { enabled: learner.enabled(cfg), chats: assistchats.list(cfg, c.req.query("note") || undefined) }) : json(c, 403, { error: "host not allowed" }))) as never);
  app.openapi(api.getChat, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    try { return json(c, 200, assistchats.read(cfg, c.req.param("id") ?? "")); } catch (err) { return json(c, 404, { error: (err as Error).message }); }
  }) as never);
  app.openapi(api.forgetChat, ((c: Context) => {
    const refused = writeRefused(c, false);
    if (refused) return refused;
    try { return json(c, 200, assistchats.forget(cfg, c.req.param("id") ?? "")); } catch (err) { return refuse(c, 400, (err as Error).message); }
  }) as never);
}
