// An organisation's own gateway in OpenRouter's place (provider.ts): what is sent to it, where its key comes
// from, how spending is known, and the connection itself: a private authority, a client certificate and a
// proxy, each against a real local server.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import * as net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeAll, expect, test } from "vitest";
import * as assist from "../src/assist.ts";
import { loadConfig } from "../src/config.ts";
import { withModels } from "../src/edit.ts";
import * as models from "../src/models.ts";
import { describe as describeProvider, explain, forgetToken, provider } from "../src/provider.ts";

const put = (root: string, rel: string, text: string) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };

/** A project, and a user config whose [teacher.provider] is `settings`. */
function project(settings: string) {
  const tmp = mkdtempSync(join(tmpdir(), "rdstudio-provider-"));
  put(tmp, "config/rdstudio/config.toml", settings);
  process.env.XDG_CONFIG_HOME = join(tmp, "config");
  process.env.XDG_DATA_HOME = join(tmp, "data");
  delete process.env.OPENROUTER_API_KEY; delete process.env.RDSTUDIO_PROVIDER_KEY; delete process.env.ACME_KEY;
  const root = join(tmp, "project");
  put(root, "rdstudio.toml", "[project]\ntitle = 'T'\n");
  put(root, "knowledge/index.md", "---\nokf_version: \"0.2\"\n---\n");
  put(root, "knowledge/design/forces.md", "---\ntype: Design\ntitle: The forces\ndescription: About the forces.\n---\n\nGravity is softened.\n");
  forgetToken();
  return { tmp, root, cfg: loadConfig(root) };
}
afterEach(() => models.setFetch(null));

interface Seen { url: string; headers: Record<string, string>; body: Record<string, any> }
/** A fetch that records what it is sent and answers as a gateway would. */
function gateway(reply: (n: number, seen: Seen) => Response, seen: Seen[] = []) {
  models.setFetch((async (url: unknown, init?: RequestInit) => {
    const s = { url: String(url), headers: Object.fromEntries(Object.entries(init?.headers as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v])), body: JSON.parse(String(init?.body)) };
    seen.push(s);
    return reply(seen.length, s);
  }) as typeof fetch);
  return seen;
}
const sse = (text: string, usage: Record<string, unknown>) => new Response([`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`, `data: ${JSON.stringify({ choices: [], usage })}\n\n`, "data: [DONE]\n\n"].join(""), { status: 200, headers: { "Content-Type": "text/event-stream" } });
const ask = (cfg: ReturnType<typeof loadConfig>, model?: string) => models.complete({ cfg, job: "discuss", model, maxTokens: 50, messages: [{ role: "system", content: [{ text: "Be brief.", cache: true }, { text: "In English." }] }, { role: "user", content: "Hello" }] });

test("with no provider set, OpenRouter is called as before", async () => {
  const { cfg } = project("");
  process.env.OPENROUTER_API_KEY = "sk-or-test-0123456789";
  const seen = gateway(() => sse("Hi", { prompt_tokens: 10, completion_tokens: 2, cost: 0.001 }));
  const r = await ask(cfg);
  expect(provider()).toMatchObject({ custom: false, name: "openrouter" });
  expect(seen[0]!.url).toMatch(/\/chat\/completions$/);
  expect(seen[0]!.headers).toMatchObject({ authorization: "Bearer sk-or-test-0123456789", "x-title": "rdstudio" });
  expect(seen[0]!.body.messages[0].content[0]).toEqual({ type: "text", text: "Be brief.", cache_control: { type: "ephemeral" } });
  expect(seen[0]!.body.stream_options).toBeUndefined();
  expect(r.usage.cost).toBe(0.001);
  expect(withModels("human:x", ["anthropic/claude-sonnet-5.5"])).toBe("human:x with openrouter/anthropic/claude-sonnet-5.5");
});

test("a gateway set in the user config is called in OpenRouter's place: its address, its header for the key, its names for models, and nothing of OpenRouter's", async () => {
  const { cfg } = project(`[teacher.provider]
name = "Acme AI"
url = "https://ai.acme.example/openai/deployments/"
path = "/chat/completions"
key_env = "ACME_KEY"
auth = "header"
auth_header = "api-key"
max_tokens_field = "max_completion_tokens"
[teacher.provider.headers]
x-team = "research"
[teacher.provider.query]
api-version = "2024-10-21"
[teacher.provider.prices]
"gpt-4o-prod" = [2.5, 10]
[teacher.models]
discuss = "gpt-4o-prod"
`);
  expect(models.apiKey()).toBeNull(); // no key yet
  await expect(ask(cfg)).rejects.toThrow(/No key for Acme-AI: set ACME_KEY/);
  process.env.ACME_KEY = "secret-key-123";
  process.env.OPENROUTER_API_KEY = "sk-or-must-not-be-sent";
  const seen = gateway(() => sse("Hi", { prompt_tokens: 1000, completion_tokens: 200 }));
  const r = await ask(cfg);
  expect(seen[0]!.url).toBe("https://ai.acme.example/openai/deployments/chat/completions?api-version=2024-10-21");
  expect(seen[0]!.headers).toEqual({ "content-type": "application/json", "x-team": "research", "api-key": "secret-key-123" }); // no Authorization, no attribution headers
  expect(JSON.stringify(seen[0])).not.toContain("sk-or-must-not-be-sent");
  // Plain text, no cache marks; token counts asked for; the model's name as the gateway has it; its own name for the reply's room.
  expect(seen[0]!.body).toMatchObject({ model: "gpt-4o-prod", stream: true, stream_options: { include_usage: true }, max_completion_tokens: 50,
    messages: [{ role: "system", content: "Be brief.\n\nIn English." }, { role: "user", content: "Hello" }] });
  expect(seen[0]!.body.max_tokens).toBeUndefined();
  // The gateway reports no cost: it is worked out from the prices set, and counts against the budget.
  expect(r.usage.cost).toBeCloseTo((1000 * 2.5 + 200 * 10) / 1e6);
  expect(models.spending(cfg).spent).toBeCloseTo(0.0045);
  // A model with no price costs nothing that is known.
  expect((await ask(cfg, "o-unpriced")).usage.cost).toBe(0);
  // Tier ids need not look like OpenRouter's; a note's stamp names the gateway.
  expect(models.setTiers({ low: "gpt-4o-mini-prod", mid: "gpt-4o-prod" })).toMatchObject({ low: "gpt-4o-mini-prod" });
  expect(() => models.setTiers({ max: "two words" })).toThrow(/as Acme-AI names the model/);
  expect(withModels("human:x", ["gpt-4o-prod"])).toBe("human:x with Acme-AI/gpt-4o-prod");
  const said = describeProvider(provider());
  expect(said.key).toBe("from the environment (ACME_KEY)");
  expect(JSON.stringify(said)).not.toContain("secret-key-123");
});

test("a key may come from a file or from a command that prints a short-lived token, asked again when the gateway refuses it", async () => {
  const first = project("");
  put(first.tmp, "key.txt", "file-key-abcdef\n");
  put(first.tmp, "config/rdstudio/config.toml", `[teacher.provider]\nurl = "https://gw.example/v1"\nkey_file = "${join(first.tmp, "key.txt")}"\n`);
  expect(models.apiKey()).toEqual({ key: "file-key-abcdef", from: "file" });
  expect(provider().name).toBe("gw.example");

  const { tmp, cfg } = project("");
  put(tmp, "n", "0");
  put(tmp, "config/rdstudio/config.toml", `[teacher.provider]\nurl = "https://gw.example/v1"\nkey_command = "node -e \\"const fs=require('fs');const f='${join(tmp, "n")}';const n=+fs.readFileSync(f,'utf8')+1;fs.writeFileSync(f,String(n));console.log('token-'+n)\\""\n`);
  const seen = gateway((n) => (n === 2 ? new Response(JSON.stringify({ error: "token expired" }), { status: 401 }) : sse("Hi", { prompt_tokens: 1, completion_tokens: 1 })));
  await ask(cfg);
  await ask(cfg); // the second is refused: the command is asked again, and the request made again
  expect(seen.map((s) => s.headers.authorization)).toEqual(["Bearer token-1", "Bearer token-1", "Bearer token-2"]);
  expect(readFileSync(join(tmp, "n"), "utf8")).toBe("2"); // kept between requests, not asked each time
  put(tmp, "config/rdstudio/config.toml", `[teacher.provider]\nurl = "https://gw.example/v1"\nkey_command = "node -e \\"process.stderr.write('not signed in');process.exit(3)\\""\n`);
  forgetToken();
  await expect(ask(cfg)).rejects.toThrow(/the key command for gw\.example failed: not signed in/);
  // No key at all (the connection itself says who is calling).
  put(tmp, "config/rdstudio/config.toml", `[teacher.provider]\nurl = "https://gw.example/v1"\nauth = "none"\n`);
  expect(models.apiKey()).toEqual({ key: "", from: "none" });
});

test("a gateway that does not stream, or does not take tools, is still used: a whole reply is read, and context is gathered in place of tool calls", async () => {
  const { cfg } = project(`[teacher.provider]\nurl = "https://gw.example/v1"\nauth = "none"\nstream = false\ntools = false\n`);
  const seen = gateway(() => new Response(JSON.stringify({ choices: [{ message: { content: "It is softened." } }], usage: { prompt_tokens: 30, completion_tokens: 4 } }), { status: 200, headers: { "Content-Type": "application/json" } }));
  let streamed = "";
  const { reply } = await assist.ask(cfg, { note: "design/forces", mode: "ask", body: "Gravity is softened.", from: 0, to: 7, prompt: "Why?" }, { onText: (t) => { streamed += t; } });
  expect(seen).toHaveLength(1);
  expect(seen[0]!.body.stream).toBe(false);
  expect(seen[0]!.body.tools).toBeUndefined();
  expect(seen[0]!.body.stream_options).toBeUndefined();
  expect(reply.answer).toBe("It is softened.");
  expect(streamed).toBe("It is softened.");
  expect(reply.steps).toEqual([]);
  // What a gateway says when it refuses is passed on, whatever shape it is in.
  gateway(() => new Response("<html><body><h1>403 Forbidden</h1>Your team has no access to this model.</body></html>", { status: 403 }));
  await expect(ask(cfg)).rejects.toThrow(/gw\.example said 403: 403 Forbidden Your team has no access to this model\./);
});

// ------------------------------------------------------------------ the connection, against real local servers

let pki: { dir: string; ca: string; cert: string; key: string; clientCert: string; clientKey: string } | null = null;
beforeAll(() => {
  // A private authority, a server certificate for localhost signed by it, and a client certificate.
  try {
    const dir = mkdtempSync(join(tmpdir(), "rdstudio-pki-")), ssl = (...a: string[]) => execFileSync("openssl", a, { cwd: dir, stdio: "ignore" });
    ssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem", "-days", "2", "-subj", "/CN=Acme Test Authority");
    writeFileSync(join(dir, "san.cnf"), "subjectAltName=DNS:localhost,IP:127.0.0.1\n");
    for (const [name, cn, ext] of [["server", "localhost", ["-extfile", "san.cnf"]], ["client", "a-developer", []]] as [string, string, string[]][]) {
      ssl("req", "-newkey", "rsa:2048", "-nodes", "-keyout", `${name}.key`, "-out", `${name}.csr`, "-subj", `/CN=${cn}`);
      ssl("x509", "-req", "-in", `${name}.csr`, "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-out", `${name}.pem`, "-days", "2", ...ext);
    }
    pki = { dir, ca: join(dir, "ca.pem"), cert: join(dir, "server.pem"), key: join(dir, "server.key"), clientCert: join(dir, "client.pem"), clientKey: join(dir, "client.key") };
  } catch { pki = null; } // no openssl here: the tests below are skipped
});

/** An HTTPS gateway on localhost; with `mutual`, it takes only callers holding a certificate of the authority's. */
async function secure(mutual: boolean) {
  const seen: { auth?: string; client?: string }[] = [];
  const server = https.createServer({ key: readFileSync(pki!.key), cert: readFileSync(pki!.cert), ...(mutual ? { requestCert: true, rejectUnauthorized: true, ca: readFileSync(pki!.ca) } : {}) }, (req, res) => {
    seen.push({ auth: req.headers.authorization as string | undefined, client: (req.socket as import("node:tls").TLSSocket).getPeerCertificate()?.subject?.CN as string | undefined });
    req.resume();
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "ready" } }] })}\n\n`);
    res.end(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 5, completion_tokens: 1 } })}\n\ndata: [DONE]\n\n`);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { seen, port: (server.address() as net.AddressInfo).port, close: () => { server.closeAllConnections(); return new Promise((r) => server.close(r)); } };
}
/** Without the test's own fetch in the way: the real connection is made. */
const real = () => models.setFetch(null);

test("a gateway whose certificate is signed by a private authority: refused until the authority is named, and the refusal says what to set", async (t) => {
  if (!pki) return t.skip();
  const gw = await secure(false);
  try {
    const { tmp, cfg } = project(`[teacher.provider]\nname = "acme"\nurl = "https://localhost:${gw.port}/v1"\nkey_env = "ACME_KEY"\n`);
    process.env.ACME_KEY = "k-123456789";
    real();
    await expect(ask(cfg)).rejects.toThrow(/localhost:\d+'s certificate is not signed by an authority this machine trusts.*ca_file under \[teacher\.provider\]/);
    expect(gw.seen).toHaveLength(0); // nothing was sent: the key did not leave
    put(tmp, "config/rdstudio/config.toml", `[teacher.provider]\nname = "acme"\nurl = "https://localhost:${gw.port}/v1"\nkey_env = "ACME_KEY"\nca_file = "${pki.ca}"\n`);
    const r = await ask(cfg);
    expect(r.text).toBe("ready");
    expect(r.usage).toMatchObject({ prompt_tokens: 5, completion_tokens: 1 });
    expect(gw.seen).toEqual([{ auth: "Bearer k-123456789", client: undefined }]);
    // The name in the certificate is checked too.
    put(tmp, "config/rdstudio/config.toml", `[teacher.provider]\nurl = "https://127.0.0.2:${gw.port}/v1"\nauth = "none"\nca_file = "${pki.ca}"\n`);
    await expect(ask(cfg)).rejects.toThrow(/certificate is for another name|could not be reached/);
  } finally { await gw.close(); }
});

test("a gateway that asks for a client certificate (mutual TLS)", async (t) => {
  if (!pki) return t.skip();
  const gw = await secure(true);
  try {
    const { tmp, cfg } = project(`[teacher.provider]\nurl = "https://localhost:${gw.port}/v1"\nauth = "none"\nca_file = "${pki.ca}"\n`);
    real();
    await expect(ask(cfg)).rejects.toThrow(/client_cert and client_key|could not be reached/);
    put(tmp, "config/rdstudio/config.toml", `[teacher.provider]\nurl = "https://localhost:${gw.port}/v1"\nauth = "none"\nca_file = "${pki.ca}"\nclient_cert = "${pki.clientCert}"\nclient_key = "${pki.clientKey}"\n`);
    expect((await ask(cfg)).text).toBe("ready");
    expect(gw.seen.at(-1)).toEqual({ auth: undefined, client: "a-developer" });
  } finally { await gw.close(); }
});

test("through a proxy: the connection is tunnelled, and the gateway's certificate is still verified end to end", async (t) => {
  if (!pki) return t.skip();
  const gw = await secure(false);
  const through: string[] = [];
  const proxy = http.createServer(), open = new Set<import("node:stream").Duplex>();
  proxy.on("connect", (req, client, head) => {
    through.push(`${req.url} ${req.headers["proxy-authorization"] ?? ""}`);
    open.add(client);
    const [host, port] = req.url!.split(":");
    const up = net.connect(Number(port), "127.0.0.1", () => { client.write("HTTP/1.1 200 Connection Established\r\n\r\n"); up.write(head); up.pipe(client); client.pipe(up); open.add(up); });
    up.on("error", () => client.destroy()); client.on("error", () => up.destroy());
  });
  await new Promise<void>((r) => proxy.listen(0, "127.0.0.1", r));
  const pport = (proxy.address() as net.AddressInfo).port;
  try {
    const { cfg } = project(`[teacher.provider]\nurl = "https://localhost:${gw.port}/v1"\nauth = "none"\nca_file = "${pki.ca}"\nproxy = "http://dev:pw@127.0.0.1:${pport}"\n`);
    real();
    expect((await ask(cfg)).text).toBe("ready");
    expect(through).toEqual([`localhost:${gw.port} Basic ${Buffer.from("dev:pw").toString("base64")}`]);
    expect(explain(Object.assign(new Error("x"), { code: "ENOTFOUND" }), provider())).toMatch(/could not be found.*set proxy/);
  } finally { for (const s of open) s.destroy(); await gw.close(); proxy.closeAllConnections(); await new Promise((r) => proxy.close(r)); }
});
