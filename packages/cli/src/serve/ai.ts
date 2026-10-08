// rdstudio serve: the model account, the tiers' models and limits, and spending.

import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import * as api from "./api.ts";
import type { Ctx } from "./shared.ts";
import { createHash, randomBytes } from "node:crypto";
import * as models from "../models.ts";
import { StoreError } from "../store.ts";

export function aiRoutes(app: OpenAPIHono, ctx: Ctx): void {
  const { cfg, token, readOnly, onWrite, actor, hostOk, json, refuse, writeRefused, change, tourChange, str } = ctx;
  // ---------------------------------------------------------------- models (OpenRouter)
  const aiState = () => {
    const k = models.apiKey();
    const p = models.provider();
    let host = p.url;
    try { host = new URL(p.url).host; } catch { /* as written */ }
    return { connected: !!k, from: k?.from ?? null, provider: { name: p.custom ? p.name : "OpenRouter", host, custom: p.custom, priced: !p.custom || Object.keys(p.prices).length > 0 },
      models: models.models(), tiers: models.tiers(), limits: models.limits(), spending: models.spending(cfg) };
  };
  app.openapi(api.getAi, ((c: Context) => (hostOk(c) ? json(c, 200, aiState()) : json(c, 403, { error: "host not allowed" }))) as never);
  // Connecting: OAuth with PKCE. The verifier waits here, by state, for ten minutes.
  const pending = new Map<string, { verifier: string; until: number }>();
  const b64url = (b: Buffer) => b.toString("base64url");
  app.openapi(api.connectAi, ((c: Context) => tourChange(c, () => {
    if (models.provider().custom) throw new StoreError(`models come from ${models.provider().name}, set in the user config ([teacher.provider]): there is no account to connect here`);
    for (const [k, v] of pending) if (v.until < Date.now()) pending.delete(k);
    const verifier = b64url(randomBytes(32)), state = b64url(randomBytes(16));
    pending.set(state, { verifier, until: Date.now() + 10 * 60_000 });
    const callback = `${new URL(c.req.url).protocol}//${c.req.header("host")}/api/teacher/ai/callback?state=${state}`;
    const q = new URLSearchParams({ callback_url: callback, code_challenge: b64url(createHash("sha256").update(verifier).digest()), code_challenge_method: "S256", key_label: "rdstudio" });
    return { url: `https://openrouter.ai/auth?${q}` };
  }, false)) as never);
  app.get("/api/teacher/ai/callback", async (c) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    const state = c.req.query("state") ?? "", code = c.req.query("code") ?? "";
    const wait = pending.get(state);
    pending.delete(state);
    const back = (result: string) => c.redirect(`/?ai=${result}#/teacher`);
    if (!wait || wait.until < Date.now() || !code) return back("expired");
    try {
      const res = await fetch(`${models.OPENROUTER}/auth/keys`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, code_verifier: wait.verifier, code_challenge_method: "S256" }) });
      const key = res.ok ? ((await res.json()) as { key?: string }).key : undefined;
      if (!key) return back("refused");
      models.saveKey(key);
      return back("connected");
    } catch {
      return back("failed");
    }
  });
  app.openapi(api.disconnectAi, ((c: Context) => tourChange(c, () => { if (!models.provider().custom) models.forgetKey(); return aiState(); }, false)) as never);
  app.openapi(api.putTiers, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (readOnly) return refuse(c, 403, "this server is read-only (rdstudio serve --read-only)");
    let body: Record<string, unknown>;
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    const next: Partial<Record<models.Tier, string>> = {};
    for (const t of models.TIERS) if (typeof body[t] === "string") next[t] = body[t] as string;
    try { models.setTiers(next); } catch (err) { return refuse(c, err instanceof models.ModelError ? err.status : 400, (err as Error).message); }
    return json(c, 200, aiState(), true);
  }) as never);
  app.openapi(api.putLimits, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (readOnly) return refuse(c, 403, "this server is read-only (rdstudio serve --read-only)");
    let body: Record<string, unknown>;
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    const next: Parameters<typeof models.setLimits>[0] = {};
    for (const t of models.TIERS) {
      const one = body[t];
      if (typeof one !== "object" || one === null) continue;
      const { input, output } = one as { input?: unknown; output?: unknown };
      // Anything that is not a number or null is refused by setLimits, with the reason.
      next[t] = { ...(input !== undefined ? { input: input as number | null } : {}), ...(output !== undefined ? { output: output as number | null } : {}) };
    }
    try { models.setLimits(next); } catch (err) { return refuse(c, err instanceof models.ModelError ? err.status : 400, (err as Error).message); }
    return json(c, 200, aiState(), true);
  }) as never);
  app.openapi(api.checkAi, (async (c: Context) => {
    const refused = writeRefused(c, false);
    if (refused) return refused;
    try {
      const r = await models.complete({ cfg, job: "check", maxTokens: 10, messages: [{ role: "user", content: "Reply with the one word: ready" }] });
      return json(c, 200, { text: r.text.trim(), model: r.usage.model, cost: r.usage.cost }, true);
    } catch (err) {
      if (err instanceof models.ModelError) return refuse(c, err.status, err.message);
      throw err;
    }
  }) as never);
}
