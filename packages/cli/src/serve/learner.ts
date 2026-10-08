// rdstudio serve: the private learner record and your tours.

import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import * as api from "./api.ts";
import type { Ctx } from "./shared.ts";
import { MAX_EVENT_BYTES } from "@rdstudio/core";
import * as learner from "../learner.ts";

export function learnerRoutes(app: OpenAPIHono, ctx: Ctx): void {
  const { cfg, token, readOnly, onWrite, actor, hostOk, json, refuse, writeRefused, change, tourChange, str } = ctx;
  app.openapi(api.getLearner, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    const on = learner.enabled(cfg);
    return json(c, 200, { enabled: on, token: on ? token : null, dir: on ? learner.recordDir(cfg) : null, events: on ? learner.events(cfg) : [], weekDays: learner.weekDays() });
  }) as never);

  app.openapi(api.postLearner, (async (c: Context) => {
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

  app.openapi(api.getTours, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    return json(c, 200, learner.enabled(cfg) ? learner.tours(cfg) : []);
  }) as never);
  app.openapi(api.putTour, ((c: Context) => tourChange(c, (b) => learner.saveTour(cfg, c.req.param("name") ?? "", b))) as never);
  app.openapi(api.deleteTourRoute, ((c: Context) => tourChange(c, () => learner.deleteTour(cfg, c.req.param("name") ?? ""), false)) as never);
}
