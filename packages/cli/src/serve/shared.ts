// rdstudio serve: what every handler shares. Who may ask (the Host, against DNS
// rebinding), who may write (the Origin, the token, JSON), and the two shapes
// a write takes: a change to the bundle, which is followed by a rebuild, and
// a write to the private record.

import type { Context } from "hono";
import type { Config } from "../config.ts";
import { ConflictError } from "../edit.ts";
import * as learner from "../learner.ts";
import { pyDumps } from "../pyjson.ts";
import { StoreError } from "../store.ts";

export const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);
/** The largest note, or text sent with a request about one, that is taken. */
export const MAX_NOTE_BYTES = 2_000_000;

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

export type Ctx = ReturnType<typeof context>;

export function context({ cfg, token, loopback, allowHosts = [], readOnly = false, onWrite }: ServerOptions) {
  const allowed = new Set([...allowHosts].map((h) => h.toLowerCase()));
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
  /** A write to your private tours or the teacher folder: the same checks as the record's. */
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
  /** Who edits made in the app are attributed to. */
  const actor = cfg.human || "human:unknown";
  return { cfg, token, readOnly, onWrite, actor, hostOk, json, refuse, writeRefused, change, tourChange, str };
}
