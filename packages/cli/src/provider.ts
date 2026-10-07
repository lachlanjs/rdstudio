// Where the models come from. As it comes, rdstudio calls OpenRouter. An
// organisation's own gateway is set in the USER config (never a project's: a
// repository must not be able to choose where your notes are sent):
//
//   [teacher.provider]
//   name = "acme"                         # what it is called here, and in a note's stamp
//   url = "https://ai.acme.example/v1"    # /chat/completions is added to it
//   key_env = "ACME_AI_KEY"               # the key: an environment variable,
//   key_file = "~/.config/acme/ai.key"    #   or a file,
//   key_command = "acme-token --print"    #   or a command that prints a short-lived token
//   key_ttl = 600                         #   (kept this many seconds; asked again after a 401)
//   auth = "bearer"                       # "bearer", "header" (the key alone) or "none"
//   auth_header = "Authorization"         # e.g. "api-key" with auth = "header"
//   ca_file = "/etc/ssl/acme-ca.pem"      # authorities to trust besides the system's (PEM)
//   client_cert = "…pem"                  # mutual TLS
//   client_key = "…pem"
//   proxy = "http://proxy.acme.example:8080"   # or "env": HTTPS_PROXY
//   path = "/chat/completions"
//   stream = true                         # false: one reply, not server-sent events
//   tools = true                          # false: no tool calls; context is gathered instead
//   cache_marks = false                   # Anthropic's cache_control parts in messages
//   stream_usage = true                   # ask for token counts with a streamed reply
//   max_tokens_field = "max_tokens"       # or "max_completion_tokens"
//   timeout = 120                         # seconds
//   [teacher.provider.headers]            # sent with every request
//   x-team = "research"
//   [teacher.provider.query]              # added to the address
//   api-version = "2024-10-21"
//   [teacher.provider.prices]             # US dollars a million tokens, in and out: for the budget
//   "gpt-4o" = [2.5, 10]
//
// The gateway must speak the OpenAI chat completions protocol. Certificates
// are always verified: there is no setting that turns that off.
// See knowledge/procedures/enterprise-models.md.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import { homedir } from "node:os";
import { Readable } from "node:stream";
import * as tls from "node:tls";
import { readToml, userConfigPath, type Table } from "./config.ts";

export interface Provider {
  /** False for OpenRouter as rdstudio comes; true for a gateway set in the user config. */
  custom: boolean;
  name: string;
  url: string;
  path: string;
  query: Record<string, string>;
  auth: "bearer" | "header" | "none";
  authHeader: string;
  headers: Record<string, string>;
  keyEnv?: string; keyFile?: string; keyCommand?: string; keyTtl: number;
  caFile?: string; clientCert?: string; clientKey?: string; proxy?: string;
  stream: boolean; tools: boolean; cacheMarks: boolean; streamUsage: boolean;
  maxTokensField: string;
  timeout: number;
  prices: Record<string, [number, number]>;
}

const table = (v: unknown): Table => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Table) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const flag = (v: unknown, otherwise: boolean): boolean => (typeof v === "boolean" ? v : otherwise);
const strings = (v: unknown): Record<string, string> => Object.fromEntries(Object.entries(table(v)).filter(([, x]) => typeof x === "string" || typeof x === "number").map(([k, x]) => [k, String(x)]));
const home = (p: string | undefined): string | undefined => (p?.startsWith("~/") ? homedir() + p.slice(1) : p);

export const OPENROUTER_URL = "https://openrouter.ai/api/v1";

/** The provider in force: the user config's [teacher.provider], or OpenRouter. */
export function provider(): Provider {
  const set = table(table(readToml(userConfigPath()).teacher).provider);
  const url = str(set.url);
  if (!url) {
    return { custom: false, name: "openrouter", url: process.env.RDSTUDIO_OPENROUTER_URL || OPENROUTER_URL, path: "/chat/completions", query: {}, auth: "bearer", authHeader: "Authorization",
      // OpenRouter asks an app to say what it is.
      headers: { "HTTP-Referer": "https://github.com/lachlanjs/rdstudio", "X-Title": "rdstudio" }, keyTtl: 0,
      stream: true, tools: true, cacheMarks: true, streamUsage: false, maxTokensField: "max_tokens", timeout: 300, prices: {} };
  }
  const auth = str(set.auth)?.toLowerCase();
  const prices: Record<string, [number, number]> = {};
  for (const [model, p] of Object.entries(table(set.prices))) if (Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number") prices[model] = [p[0], p[1]];
  return {
    custom: true, name: (str(set.name) ?? new URL(url).hostname).replace(/[^\w.-]+/g, "-"), url: url.replace(/\/+$/, ""), path: str(set.path) ?? "/chat/completions", query: strings(set.query),
    auth: auth === "header" || auth === "none" ? auth : "bearer", authHeader: str(set.auth_header) ?? "Authorization", headers: strings(set.headers),
    keyEnv: str(set.key_env), keyFile: home(str(set.key_file)), keyCommand: str(set.key_command), keyTtl: typeof set.key_ttl === "number" && set.key_ttl >= 0 ? set.key_ttl : 600,
    caFile: home(str(set.ca_file)), clientCert: home(str(set.client_cert)), clientKey: home(str(set.client_key)), proxy: str(set.proxy),
    stream: flag(set.stream, true), tools: flag(set.tools, true), cacheMarks: flag(set.cache_marks, false), streamUsage: flag(set.stream_usage, true),
    maxTokensField: str(set.max_tokens_field) ?? "max_tokens", timeout: typeof set.timeout === "number" && set.timeout > 0 ? set.timeout : 120, prices,
  };
}

export type KeyFrom = "environment" | "file" | "command" | "none";

let minted: { command: string; key: string; until: number } | null = null;
/** Forget a token a command gave (it was refused): the next request asks the command again. */
export function forgetToken(): void { minted = null; }

/** A custom provider's key and where it came from; null when it has none and needs one. Throws when a command fails. */
export function providerKey(p: Provider): { key: string; from: KeyFrom } | null {
  if (p.auth === "none") return { key: "", from: "none" };
  const env = p.keyEnv ?? "RDSTUDIO_PROVIDER_KEY";
  if (process.env[env]?.trim()) return { key: process.env[env]!.trim(), from: "environment" };
  if (p.keyFile) { try { const k = readFileSync(p.keyFile, "utf8").trim(); if (k) return { key: k, from: "file" }; } catch { /* no file */ } }
  if (p.keyCommand) {
    if (minted && minted.command === p.keyCommand && minted.until > Date.now()) return { key: minted.key, from: "command" };
    let out: string;
    try { out = execSync(p.keyCommand, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 }).trim(); }
    catch (err) { throw new Error(`the key command for ${p.name} failed: ${((err as { stderr?: string }).stderr || (err as Error).message).trim().split("\n")[0]}`); }
    if (!out) throw new Error(`the key command for ${p.name} printed nothing`);
    minted = { command: p.keyCommand, key: out.split("\n").at(-1)!.trim(), until: Date.now() + p.keyTtl * 1000 };
    return { key: minted.key, from: "command" };
  }
  return null;
}

/** The address a request goes to. */
export function endpoint(p: Provider): string {
  const u = new URL(p.url + (p.path.startsWith("/") ? p.path : "/" + p.path));
  for (const [k, v] of Object.entries(p.query)) u.searchParams.set(k, v);
  return u.href;
}

/** The headers of a request: the provider's own, and the key as it wants it. */
export function authHeaders(p: Provider, key: string): Record<string, string> {
  const out: Record<string, string> = { "Content-Type": "application/json", ...p.headers };
  if (p.auth === "bearer") out[p.authHeader] = `Bearer ${key}`;
  else if (p.auth === "header") out[p.authHeader] = key;
  return out;
}

/** What a model's tokens cost, where the provider does not say: from [teacher.provider.prices]; null when the model is not priced. */
export function priced(p: Provider, model: string, promptTokens: number, completionTokens: number): number | null {
  const price = p.prices[model];
  return price ? (promptTokens * price[0] + completionTokens * price[1]) / 1e6 : null;
}

// ------------------------------------------------------------------ the connection

/** Whether requests need more than fetch gives: an authority, a client certificate or a proxy of its own. */
export const ownTransport = (p: Provider): boolean => !!(p.caFile || p.clientCert || p.clientKey || p.proxy);

function tlsOptions(p: Provider): { ca?: string[]; cert?: string; key?: string } {
  const read = (path: string, what: string) => { try { return readFileSync(path, "utf8"); } catch { throw new Error(`${what} could not be read: ${path}`); } };
  return {
    // Besides the authorities Node already trusts, not in their place.
    ...(p.caFile ? { ca: [...tls.rootCertificates, read(p.caFile, "the authorities file (ca_file)")] } : {}),
    ...(p.clientCert ? { cert: read(p.clientCert, "the client certificate (client_cert)") } : {}),
    ...(p.clientKey ? { key: read(p.clientKey, "the client key (client_key)") } : {}),
  };
}

/** Connections made through an HTTP proxy: a CONNECT tunnel to the gateway, and TLS inside it, so the gateway's
 *  certificate is verified end to end and the proxy sees only where the connection goes. */
class Tunnel extends https.Agent {
  private readonly proxy: URL;
  constructor(proxy: URL) { super({ keepAlive: false }); this.proxy = proxy; }
  override createConnection(options: https.RequestOptions & { servername?: string }, done?: (err: Error | null, stream: import("node:stream").Duplex) => void): undefined {
    const proxy = this.proxy, to = `${options.host}:${options.port}`;
    const headers: Record<string, string> = { Host: to };
    if (proxy.username) headers["Proxy-Authorization"] = "Basic " + Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString("base64");
    const req = (proxy.protocol === "https:" ? https : http).request({ host: proxy.hostname, port: proxy.port || (proxy.protocol === "https:" ? 443 : 80), method: "CONNECT", path: to, headers, agent: false });
    req.on("connect", (res, socket) => {
      if (res.statusCode !== 200) { socket.destroy(); done?.(Object.assign(new Error(`the proxy refused the connection (${res.statusCode})`), { code: "PROXY_REFUSED" }), undefined as never); return; }
      done?.(null, tls.connect({ ...(options as tls.ConnectionOptions), socket, servername: options.servername || String(options.host) }));
    });
    req.on("error", (err) => done?.(err, undefined as never));
    req.end();
    return undefined; // the socket is handed over through `done`
  }
}

/** One request with the provider's own authorities, client certificate and proxy: what fetch cannot be given. Returns a Response, as fetch does. */
export async function request(p: Provider, url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }): Promise<Response> {
  const u = new URL(url), secure = u.protocol === "https:", port = Number(u.port) || (secure ? 443 : 80);
  const opts = tlsOptions(p);
  const via = p.proxy === "env" ? process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy : p.proxy;
  if (via && !secure) throw new Error("a proxy is used only for an https address");
  return new Promise<Response>((resolve, reject) => {
    const options: https.RequestOptions = { method: init.method, host: u.hostname, port, path: u.pathname + u.search, headers: { ...init.headers, "Content-Length": Buffer.byteLength(init.body) }, signal: init.signal, timeout: p.timeout * 1000,
      ...(secure ? opts : {}), ...(via ? { agent: new Tunnel(new URL(via)) } : {}) };
    const req = (secure ? https : http).request(options, (res) => {
      const headers = new Headers();
      for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
      const status = res.statusCode ?? 502;
      resolve(new Response(status === 204 || status === 304 ? null : (Readable.toWeb(res) as ReadableStream<Uint8Array>), { status, headers }));
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("timed out"), { code: "ETIMEDOUT" })));
    req.on("error", reject);
    req.end(init.body);
  });
}

/** Why a request did not get through, in words that say what to change. */
export function explain(err: unknown, p: Provider): string {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = e.cause?.code ?? e.code ?? "", detail = e.cause?.message ?? e.message ?? String(err);
  const host = (() => { try { return new URL(p.url).host; } catch { return p.url; } })();
  const where = p.custom ? "ca_file under [teacher.provider] in the user config" : "the NODE_EXTRA_CA_CERTS environment variable";
  if (["SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(code))
    return `${host}'s certificate is not signed by an authority this machine trusts (${code}). Point ${where} at your organisation's authorities (a PEM file). A proxy that inspects traffic has the same effect.`;
  if (code === "ERR_TLS_CERT_ALTNAME_INVALID") return `${host}'s certificate is for another name (${detail}). Use the name the certificate is for in the address.`;
  if (code === "CERT_HAS_EXPIRED") return `${host}'s certificate has expired.`;
  if (/ERR_SSL_.*(HANDSHAKE|ALERT)|ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED|ECONNRESET/.test(code) && !p.clientCert) return `${host} closed the connection while it was being set up (${code}). If it asks for a client certificate, set client_cert and client_key under [teacher.provider].`;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return `${host} could not be found (${code}). Check the address; behind a proxy, set proxy under [teacher.provider].`;
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "EHOSTUNREACH" || code === "ENETUNREACH") return `${host} could not be reached (${code}). Check the address and the network; behind a proxy, set proxy under [teacher.provider].`;
  if (code === "PROXY_REFUSED") return `${detail}. Check the proxy's address and whether it needs a name and password.`;
  return `${p.name} could not be reached: ${detail}${code ? ` (${code})` : ""}`;
}

/** The provider's settings as they are read, with nothing secret: for `rdstudio provider` and the Axis page. */
export function describe(p: Provider): Record<string, string> {
  let key = "none needed";
  if (p.custom && p.auth !== "none") key = process.env[p.keyEnv ?? "RDSTUDIO_PROVIDER_KEY"]?.trim() ? `from the environment (${p.keyEnv ?? "RDSTUDIO_PROVIDER_KEY"})` : p.keyFile ? `from the file ${p.keyFile}` : p.keyCommand ? "from a command" : `not set: ${p.keyEnv ?? "RDSTUDIO_PROVIDER_KEY"}, key_file or key_command`;
  if (!p.custom) key = "OPENROUTER_API_KEY, or the key kept by connecting on the Axis page";
  return {
    provider: p.custom ? p.name : "OpenRouter (the default: no [teacher.provider] url in the user config)",
    address: endpoint(p),
    key, sent: p.auth === "none" ? "no key" : p.auth === "bearer" ? `${p.authHeader}: Bearer …` : `${p.authHeader}: …`,
    "other headers": Object.keys(p.headers).join(", ") || "none",
    authorities: p.caFile ? `the system's and ${p.caFile}` : process.env.NODE_EXTRA_CA_CERTS ? `Node's and NODE_EXTRA_CA_CERTS (${process.env.NODE_EXTRA_CA_CERTS})` : "Node's own",
    "client certificate": p.clientCert ? `${p.clientCert}${p.clientKey ? `, key ${p.clientKey}` : " (no client_key set)"}` : "none",
    proxy: p.proxy ?? "none",
    replies: p.stream ? "streamed" : "whole", tools: p.tools ? "offered" : "not offered", "cache marks": p.cacheMarks ? "sent" : "not sent",
    prices: Object.keys(p.prices).length ? Object.entries(p.prices).map(([m, [a, b]]) => `${m} $${a}/$${b}`).join(", ") : p.custom ? "none set: spending shows as $0 unless the gateway reports a cost" : "reported by OpenRouter",
  };
}
