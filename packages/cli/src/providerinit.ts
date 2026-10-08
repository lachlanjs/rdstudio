// rdstudio provider init (T106): an organisation's gateway set up by a few
// short answers, or by flags, in place of a table written by hand. It writes
// [teacher.provider] in the user config, names the three tiers' models, and
// leaves the check to say what is still wrong. No key and no password is
// asked for or written: only where each is to be found.

import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readToml, userConfigPath } from "./config.ts";
import * as models from "./models.ts";

export interface Answers {
  url: string;
  name?: string;
  auth?: "bearer" | "header" | "none";
  authHeader?: string;
  keyEnv?: string;
  caFile?: string;
  systemCa?: boolean;
  clientPfx?: string;
  pfxPasswordEnv?: string;
  clientCert?: string;
  clientKey?: string;
  proxy?: string;
}

export class InitError extends Error {}

const home = (p: string) => (p === "~" || p.startsWith("~/") ? join(homedir(), p.slice(1)) : p);
const there = (p: string | undefined, what: string) => { if (p && !existsSync(home(p))) throw new InitError(`${what}: there is no file ${p}`); };
/** A name an environment variable can have: so that what is written can never be a secret typed by mistake. */
const envName = (v: string | undefined, what: string) => { if (v && !/^[A-Za-z_][A-Za-z0-9_]{0,80}$/.test(v)) throw new InitError(`${what} is the name of an environment variable (letters, digits and _), not the value itself`); };

/** The answers checked, and put in order: what is wrong is said before anything is written. */
export function checked(a: Answers): Answers {
  const url = a.url.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
  let u: URL;
  try { u = new URL(url); } catch { throw new InitError(`"${a.url}" is not an address: write it whole, like https://ai.example.com/v1`); }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) throw new InitError("the address must begin https:// (http:// only for this machine)");
  if (u.username || u.password) throw new InitError("leave the name and password out of the address");
  const auth = a.auth ?? "bearer";
  if (!["bearer", "header", "none"].includes(auth)) throw new InitError('auth is "bearer", "header" or "none"');
  if (a.clientPfx && (a.clientCert || a.clientKey)) throw new InitError("give the client certificate as one PKCS#12 file, or as a certificate and key in PEM, not both");
  if (Boolean(a.clientCert) !== Boolean(a.clientKey)) throw new InitError("a client certificate in PEM needs both --client-cert and --client-key");
  there(a.caFile, "the authority's certificate"); there(a.clientPfx, "the client certificate"); there(a.clientCert, "the client certificate"); there(a.clientKey, "the client key");
  envName(a.keyEnv, "--key-env"); envName(a.pfxPasswordEnv, "--pfx-password-env");
  if (a.proxy && a.proxy !== "env") {
    let p: URL;
    try { p = new URL(a.proxy); } catch { throw new InitError(`"${a.proxy}" is not a proxy's address: write it like http://proxy.example.com:8080, or env`); }
    if (p.protocol !== "http:" && p.protocol !== "https:") throw new InitError(`"${a.proxy}" is not a proxy's address: write it like http://proxy.example.com:8080, or env`);
    if (p.password) throw new InitError("leave the proxy's password out: set it in HTTPS_PROXY in the environment and answer env");
  }
  return { ...a, url, auth, name: a.name?.trim() || undefined };
}

const q = (s: string) => JSON.stringify(s);

/** The rows of [teacher.provider] for the answers: only what was said, in the order the procedure lists them. */
export function rows(raw: Answers): string[] {
  const a = checked(raw), out: string[] = [];
  if (a.name) out.push(`name = ${q(a.name)}`);
  out.push(`url = ${q(a.url)}`);
  if (a.auth !== "bearer") out.push(`auth = ${q(a.auth!)}`);
  if (a.authHeader) out.push(`auth_header = ${q(a.authHeader)}`);
  if (a.keyEnv && a.auth !== "none") out.push(`key_env = ${q(a.keyEnv)}`);
  if (a.caFile) out.push(`ca_file = ${q(a.caFile)}`);
  if (a.systemCa) out.push("system_ca = true");
  if (a.clientPfx) { out.push(`client_pfx = ${q(a.clientPfx)}`); if (a.pfxPasswordEnv) out.push(`pfx_password_env = ${q(a.pfxPasswordEnv)}`); }
  if (a.clientCert) out.push(`client_cert = ${q(a.clientCert)}`, `client_key = ${q(a.clientKey!)}`);
  if (a.proxy) out.push(`proxy = ${q(a.proxy)}`);
  return out;
}

/** Whether a gateway is set already. */
export const has = (): boolean => typeof (readToml(userConfigPath()).teacher as { provider?: { url?: unknown } } | undefined)?.provider?.url === "string";

/** Write the table. Its own tables under it (headers, query, prices) are left as they are. */
export function write(a: Answers): string[] {
  const r = rows(a);
  models.writeTable("teacher.provider", r, "Where the models come from: an organisation's gateway (rdstudio provider init). See rdstudio provider show.");
  return r;
}

/** What is to hand on this machine: a proxy in the environment, and certificates lying where they are usually put. */
export function guesses(env: NodeJS.ProcessEnv = process.env, dirs: string[] = [process.cwd(), homedir(), join(homedir(), ".config"), join(homedir(), "certs"), join(homedir(), ".certs"), join(homedir(), "Downloads")]): { proxy: string; pfx: string[]; pem: string[] } {
  const pfx: string[] = [], pem: string[] = [];
  for (const dir of dirs) {
    let names: string[];
    try { names = readdirSync(dir); } catch { continue; }
    for (const n of names.sort()) {
      if (/\.(pfx|p12)$/i.test(n) && pfx.length < 5) pfx.push(join(dir, n));
      else if (/(^|[-_.])(ca|root|chain|bundle)([-_.].*)?\.(pem|crt|cer)$/i.test(n) && pem.length < 5) pem.push(join(dir, n));
    }
  }
  return { proxy: env.HTTPS_PROXY || env.https_proxy || "", pfx, pem };
}

/** A name from the address: the organisation's part of the host (ai.acme.example gives acme); "gateway" for a bare address. */
export function nameFor(url: string): string {
  const host = new URL(url).hostname;
  if (/^[\d.]+$|^\[|^localhost$/.test(host)) return "gateway";
  return host.split(".").slice(-2, -1)[0] || host || "gateway";
}

/** One question and its answer; an empty answer takes what is in brackets. */
export type Ask = (question: string, fallback?: string) => Promise<string>;

/** The questions, in order. Each is one line, and most take Enter. */
export async function interview(ask: Ask, say: (line: string) => void, found = guesses()): Promise<Answers> {
  say("Setting up an organisation's model gateway. Each answer is one line; Enter takes what is in [brackets] or skips.");
  say("No key or password is asked for: only where rdstudio is to find each.\n");
  const a: Answers = { url: "" };
  // "n" to a question that wants a path means none; a path with no file there is asked again, at once.
  const none = (v: string) => (/^(n|no|none|-)$/i.test(v) ? "" : v);
  const file = async (question: string, fallback = "", also: string[] = []): Promise<string> => {
    for (let tries = 0; tries < 4; tries++) {
      const v = none(await ask(question, fallback));
      if (!v || also.includes(v.toLowerCase()) || existsSync(home(v))) return v;
      say(`  There is no file ${v}. Give its path, or n for none.`);
      fallback = "";
    }
    throw new InitError("no file was found at the paths given: find where it is, and run rdstudio provider init again");
  };
  for (;;) {
    a.url = await ask("The gateway's address (up to /v1, without /chat/completions)");
    try { checked({ url: a.url }); break; } catch (err) { say(`  ${(err as Error).message}`); }
  }
  a.name = await ask("A short name for it, used in messages and in a note's stamp", nameFor(checked({ url: a.url }).url));
  say("\nHow the gateway knows who you are:");
  const pfx = await file(`  A client certificate in one file (.pfx or .p12): its path, or ${found.pfx.length ? "n" : "Enter"} for none`, found.pfx[0] ?? "");
  if (pfx) {
    a.clientPfx = pfx;
    a.pfxPasswordEnv = await ask("  The environment variable that will hold its password", "RDSTUDIO_PFX_PASSWORD");
  } else {
    const cert = await file("  Or a certificate in PEM: its path, or Enter for none");
    if (cert) {
      const key = await file("  And its key: the path");
      if (!key) throw new InitError("a certificate in PEM needs its key too: run rdstudio provider init again with both to hand");
      a.clientCert = cert; a.clientKey = key;
    }
  }
  const key = (await ask("  Does it also want a key in a header? (y/n)", pfx || a.clientCert ? "n" : "y")).toLowerCase();
  if (key.startsWith("y")) { a.auth = "bearer"; a.keyEnv = await ask("  The environment variable that will hold the key", "RDSTUDIO_PROVIDER_KEY"); }
  else a.auth = "none";
  say("\nHow this machine trusts the gateway:");
  const ca = await file(`  Your organisation's authority as a PEM file: its path, "system" to use this machine's own store, or ${found.pem.length ? "n" : "Enter"} if the gateway's certificate is a public one`, found.pem[0] ?? "", ["system"]);
  if (ca.toLowerCase() === "system") a.systemCa = true; else if (ca) a.caFile = ca;
  if (found.proxy) {
    const use = (await ask("\nA proxy is set in HTTPS_PROXY. Reach the gateway through it? (y/n)", "y")).toLowerCase();
    if (use.startsWith("y")) a.proxy = "env";
  } else {
    for (;;) {
      const p = none(await ask("\nA proxy to reach it through: its address, or Enter for none"));
      try { if (p) checked({ url: a.url, proxy: p }); a.proxy = p || undefined; break; } catch (err) { say(`  ${(err as Error).message}`); }
    }
    if (!a.proxy) delete a.proxy;
  }
  return a;
}

/** The three tiers' models, asked for by name with the gateway's own list in view. */
export async function tiers(ask: Ask, say: (line: string) => void, offered: string[] | null): Promise<Partial<Record<models.Tier, string>>> {
  if (offered?.length) say(`\nThe gateway offers ${offered.length} model${offered.length === 1 ? "" : "s"}:\n${offered.slice(0, 40).map((m, k) => `  ${k + 1}. ${m}`).join("\n")}${offered.length > 40 ? `\n  …and ${offered.length - 40} more` : ""}`);
  else say("\nThe gateway did not give a list of its models: write each as the gateway names it.");
  say("rdstudio asks at three strengths. Give a model for each, by its number or its name.");
  const pick = (v: string) => (offered && /^\d+$/.test(v) && offered[Number(v) - 1] ? offered[Number(v) - 1]! : v);
  const out: Partial<Record<models.Tier, string>> = {};
  let last = "";
  for (const [t, what] of [["low", "quick and cheap, for small changes and hints"], ["mid", "for most questions and drafting"], ["max", "the strongest, for figures and what needs most care"]] as const) {
    const v = pick(await ask(`  ${t} (${what})`, last));
    if (v) { out[t] = v; last = v; }
  }
  return out;
}
