// rdstudio serve: agents outside the app: their sessions, what they do as they do it, and what is sent to them.

import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import * as api from "./api.ts";
import type { Ctx } from "./shared.ts";
import { streamSSE } from "hono/streaming";
import { loadBundle } from "@rdstudio/core/node";
import * as inbox from "../inbox.ts";
import * as trace from "../trace.ts";

export function agentsRoutes(app: OpenAPIHono, ctx: Ctx): void {
  const { cfg, token, readOnly, onWrite, actor, hostOk, json, refuse, writeRefused, change, tourChange, str } = ctx;
  app.openapi(api.agentSessions, ((c: Context) => (hostOk(c) ? json(c, 200, { enabled: trace.enabled(cfg), quietMs: trace.QUIET_MS, sessions: trace.sessions(cfg).slice(0, 40) }) : json(c, 403, { error: "host not allowed" }))) as never);
  app.openapi(api.agentSession, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    const id = c.req.param("id") ?? "", events = trace.events(cfg, id);
    if (!events.length) return json(c, 404, { error: "no such session" });
    return json(c, 200, { id, client: events.find((e) => e.client && e.client !== "an agent")?.client ?? events[0]!.client, events: events.map(({ at, source, step }) => ({ at, source, step })) });
  }) as never);
  app.openapi(api.forgetAgentSession, ((c: Context) => {
    const refused = writeRefused(c, false);
    if (refused) return refused;
    try { return json(c, 200, trace.forget(cfg, c.req.param("id") ?? "")); } catch (err) { return refuse(c, 400, (err as Error).message); }
  }) as never);
  app.openapi(api.sendToAgent, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    let body: Record<string, unknown>;
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    try { return json(c, 200, inbox.send(cfg, body ?? {}, loadBundle(cfg.knowledgeDir)), true); } catch (err) { return refuse(c, 400, (err as Error).message); }
  }) as never);
  app.openapi(api.sentToAgent, ((c: Context) => (hostOk(c) ? json(c, 200, { sent: inbox.list(cfg).reverse().slice(0, 12) }) : json(c, 403, { error: "host not allowed" }))) as never);
  app.openapi(api.unsendToAgent, ((c: Context) => {
    const refused = writeRefused(c, false);
    if (refused) return refused;
    return json(c, 200, inbox.drop(cfg, c.req.param("id") ?? ""));
  }) as never);
  // One standing stream for each page that listens: the log is followed for it, and left when the page goes.
  app.openapi(api.agentsLive, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    return streamSSE(c, async (stream) => {
      let stop = () => {}, beat: ReturnType<typeof setInterval> | null = null;
      await new Promise<void>((done) => {
        stream.onAbort(done);
        stop = trace.follow(cfg, (e) => { void stream.writeSSE({ event: "step", data: JSON.stringify(e) }).catch(done); });
        void stream.writeSSE({ event: "ready", data: JSON.stringify({ enabled: trace.enabled(cfg) }) }).catch(done);
        // A line now and then, so that a proxy on the way does not close a stream that is only quiet.
        beat = setInterval(() => { void stream.writeSSE({ event: "beat", data: "" }).catch(done); }, 25_000);
      });
      stop();
      if (beat) clearInterval(beat);
    });
  }) as never);
}
