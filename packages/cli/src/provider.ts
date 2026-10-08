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
//   system_ca = true                      # and the ones this machine's own store holds
//   client_cert = "…pem"                  # mutual TLS
//   client_key = "…pem"
//   client_key_passphrase_env = "…"       # where the key is kept under a passphrase
//   client_pfx = "…p12"                   # or both in one PKCS#12 file, in the pair's place
//   pfx_password_env = "…"                # its password (or pfx_password_file)
//   proxy = "http://proxy.acme.example:8080"   # or "env": HTTPS_PROXY, less what NO_PROXY names
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
// are always verified: there is no setting that turns that off, and
// NODE_TLS_REJECT_UNAUTHORIZED=0 in the environment does not either.
// See knowledge/procedures/enterprise-models.md.

import { execSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
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
  caFile?: string; systemCa: boolean; clientCert?: string; clientKey?: string; keyPassphraseEnv?: string;
  clientPfx?: string; pfxPasswordEnv?: string; pfxPasswordFile?: string; proxy?: string;
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
      headers: { "HTTP-Referer": "https://github.com/lachlanjs/rdstudio", "X-Title": "rdstudio" }, keyTtl: 0, systemCa: false,
      stream: true, tools: true, cacheMarks: true, streamUsage: false, maxTokensField: "max_tokens", timeout: 300, prices: {} };
  }
  const auth = str(set.auth)?.toLowerCase();
  const prices: Record<string, [number, number]> = {};
  for (const [model, p] of Object.entries(table(set.prices))) if (Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number") prices[model] = [p[0], p[1]];
  return {
    custom: true, name: (str(set.name) ?? new URL(url).hostname).replace(/[^\w.-]+/g, "-"), url: url.replace(/\/+$/, ""), path: str(set.path) ?? "/chat/completions", query: strings(set.query),
    auth: auth === "header" || auth === "none" ? auth : "bearer", authHeader: str(set.auth_header) ?? "Authorization", headers: strings(set.headers),
    keyEnv: str(set.key_env), keyFile: home(str(set.key_file)), keyCommand: str(set.key_command), keyTtl: typeof set.key_ttl === "number" && set.key_ttl >= 0 ? set.key_ttl : 600,
    caFile: home(str(set.ca_file)), systemCa: flag(set.system_ca, false), clientCert: home(str(set.client_cert)), clientKey: home(str(set.client_key)), keyPassphraseEnv: str(set.client_key_passphrase_env),
    clientPfx: home(str(set.client_pfx)), pfxPasswordEnv: str(set.pfx_password_env), pfxPasswordFile: home(str(set.pfx_password_file)), proxy: str(set.proxy),
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

/** What was seen of a connection as it was made: for `rdstudio provider check`. */
export interface Seen {
  /** The proxy the connection was tunnelled through, without its name and password. */
  tunnel?: string;
  protocol?: string;
  /** The gateway's certificate, verified against the authorities. */
  server?: { subject: string; issuer: string; until: string };
  /** The client certificate that was presented. */
  client?: { subject: string; until: string };
}
let watch: ((s: Seen) => void) | null = null;
/** Be told what each connection is made with (the check); null stops it. While set, a gateway's requests are all made here. */
export function setWatch(f: ((s: Seen) => void) | null): void { watch = f; }

/** Whether the environment asks Node not to verify certificates. A gateway's are verified all the same. */
export const unverifiedAsked = (): boolean => process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";

/** Whether requests need more than fetch gives: an authority, a client certificate or a proxy of its own; or fetch would not verify. */
export const ownTransport = (p: Provider): boolean => !!(p.caFile || p.systemCa || p.clientCert || p.clientKey || p.clientPfx || p.proxy) || (p.custom && (unverifiedAsked() || watch !== null));

/** The authorities in this machine's own store (the organisation's, on a managed machine). */
function systemAuthorities(): string[] {
  const get = (tls as { getCACertificates?: (kind: string) => string[] }).getCACertificates;
  if (!get) throw new Error("system_ca needs Node 22.15 or later: point ca_file at the authorities instead");
  return get("system");
}

type TlsOptions = { rejectUnauthorized: true; ca?: string[]; cert?: string; key?: string; pfx?: Buffer; passphrase?: string };
function tlsOptions(p: Provider): TlsOptions {
  const read = (path: string, what: string) => { try { return readFileSync(path); } catch { throw new Error(`${what} could not be read: ${path}`); } };
  if (p.clientPfx && (p.clientCert || p.clientKey)) throw new Error("both client_pfx and client_cert/client_key are set under [teacher.provider]: keep one of the two");
  let passphrase: string | undefined;
  if (p.clientPfx) {
    passphrase = process.env[p.pfxPasswordEnv ?? "RDSTUDIO_PFX_PASSWORD"] ?? (p.pfxPasswordFile ? read(p.pfxPasswordFile, "the PKCS#12 password file (pfx_password_file)").toString("utf8").replace(/\r?\n$/, "") : undefined);
  } else if (p.clientKey && p.keyPassphraseEnv) {
    passphrase = process.env[p.keyPassphraseEnv];
    if (passphrase === undefined) throw new Error(`the client key's passphrase is not set: ${p.keyPassphraseEnv} (client_key_passphrase_env)`);
  }
  const more = [...(p.systemCa ? systemAuthorities() : []), ...(p.caFile ? [read(p.caFile, "the authorities file (ca_file)").toString("utf8")] : [])];
  return {
    // Said outright, so that NODE_TLS_REJECT_UNAUTHORIZED=0 in the environment does not turn it off.
    rejectUnauthorized: true,
    // Besides the authorities Node already trusts, not in their place.
    ...(more.length ? { ca: [...tls.rootCertificates, ...more] } : {}),
    ...(p.clientCert ? { cert: read(p.clientCert, "the client certificate (client_cert)").toString("utf8") } : {}),
    ...(p.clientKey ? { key: read(p.clientKey, "the client key (client_key)").toString("utf8") } : {}),
    ...(p.clientPfx ? { pfx: read(p.clientPfx, "the PKCS#12 file (client_pfx)") } : {}),
    ...(passphrase !== undefined ? { passphrase } : {}),
  };
}

/** When the client certificate runs out, where it can be read without a connection (a PEM file); null otherwise. */
export function clientCertUntil(p: Provider): Date | null {
  if (!p.clientCert) return null;
  try { return new Date(new X509Certificate(readFileSync(p.clientCert)).validTo); } catch { return null; }
}

/** The proxy a request to `u` goes through, if any. With proxy = "env" it is the environment's, less the hosts NO_PROXY names. */
export function proxyFor(p: Provider, u: URL): string | undefined {
  if (p.proxy !== "env") return p.proxy;
  const via = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  if (!via) return undefined;
  const host = u.hostname.toLowerCase(), port = u.port || (u.protocol === "https:" ? "443" : "80");
  for (const raw of (process.env.NO_PROXY ?? process.env.no_proxy ?? "").split(",")) {
    let no = raw.trim().toLowerCase();
    if (!no) continue;
    if (no === "*") return undefined;
    const at = no.lastIndexOf(":");
    if (at > 0 && /^\d+$/.test(no.slice(at + 1))) { if (no.slice(at + 1) !== port) continue; no = no.slice(0, at); }
    no = no.replace(/^\*?\./, "");
    if (host === no || host.endsWith("." + no)) return undefined;
  }
  return via;
}

/** Connections made through an HTTP proxy: a CONNECT tunnel to the gateway, and TLS inside it, so the gateway's
 *  certificate is verified end to end and the proxy sees only where the connection goes. */
class Tunnel extends https.Agent {
  private readonly proxy: URL;
  private readonly trust: Pick<TlsOptions, "rejectUnauthorized" | "ca">;
  constructor(proxy: URL, trust: Pick<TlsOptions, "rejectUnauthorized" | "ca">) { super({ keepAlive: false }); this.proxy = proxy; this.trust = trust; }
  override createConnection(options: https.RequestOptions & { servername?: string }, done?: (err: Error | null, stream: import("node:stream").Duplex) => void): undefined {
    const proxy = this.proxy, to = `${options.host}:${options.port}`;
    const headers: Record<string, string> = { Host: to };
    if (proxy.username) headers["Proxy-Authorization"] = "Basic " + Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString("base64");
    const req = proxy.protocol === "https:" ? https.request({ host: proxy.hostname, port: proxy.port || 443, method: "CONNECT", path: to, headers, agent: false, ...this.trust })
      : http.request({ host: proxy.hostname, port: proxy.port || 80, method: "CONNECT", path: to, headers, agent: false });
    req.on("connect", (res, socket) => {
      if (res.statusCode === 407) {
        // What the proxy wants is named: rdstudio gives a name and password (Basic) and nothing else.
        const wants = [res.headers["proxy-authenticate"] ?? []].flat().flatMap((h) => h.split(",")).map((h) => h.trim().split(/\s/)[0]!).filter((w) => w && !w.includes("="));
        const other = wants.filter((w) => !/^basic$/i.test(w));
        socket.destroy();
        done?.(Object.assign(new Error(other.length && !wants.some((w) => /^basic$/i.test(w))
          ? `the proxy asks for a sign-in rdstudio does not do (407: ${other.join(", ")}). Only a name and password in the proxy's address are sent; NTLM and Kerberos need a local proxy that signs in for you (one that listens on this machine), named as proxy`
          : `the proxy asks for a name and password (407${wants.length ? `: ${wants.join(", ")}` : ""}). Put them in its address: proxy = "http://name:password@host:port"`), { code: "PROXY_SIGN_IN" }), undefined as never);
        return;
      }
      if (res.statusCode !== 200) { socket.destroy(); done?.(Object.assign(new Error(`the proxy refused the connection (${res.statusCode})`), { code: "PROXY_REFUSED" }), undefined as never); return; }
      done?.(null, tls.connect({ ...(options as tls.ConnectionOptions), socket, servername: options.servername || String(options.host) }));
    });
    req.on("error", (err) => done?.(err, undefined as never));
    req.end();
    return undefined; // the socket is handed over through `done`
  }
}

const named = (subject: string | undefined): string => subject?.split("\n").find((l) => l.startsWith("CN="))?.slice(3) ?? subject?.replace(/\n/g, ", ") ?? "";

/** One request with the provider's own authorities, client certificate and proxy: what fetch cannot be given. Returns a Response, as fetch does. */
export async function request(p: Provider, url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }): Promise<Response> {
  const u = new URL(url), secure = u.protocol === "https:", port = Number(u.port) || (secure ? 443 : 80);
  const opts = tlsOptions(p);
  const via = proxyFor(p, u);
  if (via && !secure) throw new Error("a proxy is used only for an https address");
  return new Promise<Response>((resolve, reject) => {
    const options: https.RequestOptions = { method: init.method, host: u.hostname, port, path: u.pathname + u.search, headers: { ...init.headers, ...(init.body !== undefined ? { "Content-Length": Buffer.byteLength(init.body) } : {}) }, signal: init.signal, timeout: p.timeout * 1000,
      ...(secure ? opts : {}), ...(via ? { agent: new Tunnel(new URL(via), { rejectUnauthorized: true, ...(opts.ca ? { ca: opts.ca } : {}) }) } : {}) };
    const req = (secure ? https : http).request(options, (res) => {
      const headers = new Headers();
      for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
      const status = res.statusCode ?? 502;
      resolve(new Response(status === 204 || status === 304 ? null : (Readable.toWeb(res) as ReadableStream<Uint8Array>), { status, headers }));
    });
    const tell = watch;
    if (tell && secure) req.on("socket", (socket) => {
      const s = socket as tls.TLSSocket;
      const say = () => {
        const server = s.getPeerX509Certificate?.(), client = s.getX509Certificate?.();
        const proxy = via ? new URL(via) : null;
        tell({ ...(proxy ? { tunnel: `${proxy.protocol}//${proxy.host}` } : {}), protocol: s.getProtocol?.() ?? undefined,
          ...(server ? { server: { subject: named(server.subject), issuer: named(server.issuer), until: server.validTo } } : {}),
          ...(client ? { client: { subject: named(client.subject), until: client.validTo } } : {}) });
      };
      if (s.getPeerX509Certificate?.()) say(); else s.once("secureConnect", say);
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
  const said = `${code} ${detail}`;
  // The client's own certificate and key, read before anything is sent.
  if (p.clientPfx && /mac verify failure/i.test(said)) return `The PKCS#12 file's password is wrong or missing (client_pfx). It is read from ${p.pfxPasswordFile && !process.env[p.pfxPasswordEnv ?? "RDSTUDIO_PFX_PASSWORD"] ? `the file ${p.pfxPasswordFile}` : `the environment variable ${p.pfxPasswordEnv ?? "RDSTUDIO_PFX_PASSWORD"}`}.`;
  if (p.clientPfx && /unsupported|ERR_OSSL_EVP_UNSUPPORTED|RC2|not enough data|wrong tag|asn1/i.test(said)) return /unsupported|RC2/i.test(said)
    ? `The PKCS#12 file is protected with an old cipher this Node no longer reads (${detail}). Export it again with modern protection (AES), or convert it once: openssl pkcs12 -legacy -in old.pfx -nodes -out all.pem, then openssl pkcs12 -export -in all.pem -out new.pfx.`
    : `The file named by client_pfx could not be read as PKCS#12 (${detail}).`;
  if (p.clientKey && /bad decrypt|interrupted or cancelled|bad password|ERR_MISSING_PASSPHRASE/i.test(said)) return p.keyPassphraseEnv
    ? `The client key could not be opened with the passphrase in ${p.keyPassphraseEnv} (client_key_passphrase_env).`
    : "The client key is kept under a passphrase: name the environment variable that holds it as client_key_passphrase_env under [teacher.provider].";
  if (code === "PROXY_SIGN_IN") return `${detail}.`;
  if (["SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(code))
    return `${host}'s certificate is not signed by an authority this machine trusts (${code}). ${p.custom && !p.systemCa ? "Set system_ca = true under [teacher.provider] to trust what this machine's own store holds, or point" : "Point"} ${where} at your organisation's authorities (a PEM file). A proxy that inspects traffic has the same effect.`;
  if (code === "ERR_TLS_CERT_ALTNAME_INVALID") return `${host}'s certificate is for another name (${detail}). Use the name the certificate is for in the address.`;
  if (code === "CERT_HAS_EXPIRED") return `${host}'s certificate has expired.`;
  if (/CERTIFICATE_EXPIRED|certificate expired/i.test(said)) return `${host} says the certificate it was shown has expired: the client certificate (${p.clientPfx ? "client_pfx" : "client_cert"}) needs renewing.`;
  if (/ALERT_(UNKNOWN_CA|BAD_CERTIFICATE|CERTIFICATE_UNKNOWN|CERTIFICATE_REVOKED)|alert (unknown ca|bad certificate|certificate unknown|certificate revoked)/i.test(said) && (p.clientCert || p.clientPfx)) return `${host} did not accept the client certificate (${code || detail}): it is not one the gateway knows, or it has been withdrawn.`;
  if (/ERR_SSL_.*(HANDSHAKE|ALERT)|ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED|ECONNRESET/.test(code) && !p.clientCert && !p.clientPfx) return `${host} closed the connection while it was being set up (${code}). If it asks for a client certificate, set client_cert and client_key (or client_pfx) under [teacher.provider].`;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return `${host} could not be found (${code}). Check the address; behind a proxy, set proxy under [teacher.provider].`;
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "EHOSTUNREACH" || code === "ENETUNREACH") return `${host} could not be reached (${code}). Check the address and the network; behind a proxy, set proxy under [teacher.provider].`;
  if (code === "PROXY_REFUSED") return `${detail}. Check the proxy's address and whether it needs a name and password.`;
  return `${p.name} could not be reached: ${detail}${code ? ` (${code})` : ""}`;
}

/** A proxy's address without the name and password in it. */
const hidden = (via: string): string => { try { const u = new URL(via); return `${u.protocol}//${u.username ? "…@" : ""}${u.host}`; } catch { return "an address that cannot be read"; } };
const proxyEnv = (): string | undefined => { const v = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy; return v ? hidden(v) : undefined; };

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
    authorities: ["Node's own", ...(p.systemCa ? ["this machine's store (system_ca)"] : []), ...(p.caFile ? [p.caFile] : []), ...(!p.caFile && !p.systemCa && process.env.NODE_EXTRA_CA_CERTS ? [`NODE_EXTRA_CA_CERTS (${process.env.NODE_EXTRA_CA_CERTS})`] : [])].join(", "),
    verification: unverifiedAsked() ? (p.custom ? "in force (NODE_TLS_REJECT_UNAUTHORIZED=0 is set, and is not heeded for the gateway)" : "OFF: NODE_TLS_REJECT_UNAUTHORIZED=0 is set in the environment") : "in force",
    "client certificate": p.clientPfx ? `${p.clientPfx} (PKCS#12)${p.clientCert || p.clientKey ? ", and client_cert/client_key as well: keep one of the two" : ""}`
      : p.clientCert ? `${p.clientCert}${p.clientKey ? `, key ${p.clientKey}${p.keyPassphraseEnv ? ` (passphrase from ${p.keyPassphraseEnv})` : ""}` : " (no client_key set)"}` : "none",
    proxy: p.proxy === "env" ? `from the environment (${proxyEnv() ?? "none set"})` : p.proxy ? hidden(p.proxy) : "none",
    replies: p.stream ? "streamed" : "whole", tools: p.tools ? "offered" : "not offered", "cache marks": p.cacheMarks ? "sent" : "not sent",
    prices: Object.keys(p.prices).length ? Object.entries(p.prices).map(([m, [a, b]]) => `${m} $${a}/$${b}`).join(", ") : p.custom ? "none set: spending shows as $0 unless the gateway reports a cost" : "reported by OpenRouter",
  };
}
