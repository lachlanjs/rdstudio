// The server against the Python server's tests (tests/test_learner.py).

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { request, type IncomingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { serve as nodeServe } from "@hono/node-server";
import { afterAll, beforeAll, expect, test } from "vitest";
import { loadConfig } from "../src/config.ts";
import * as learner from "../src/learner.ts";
import { createApp } from "../src/serve.ts";

const tmp = mkdtempSync(join(tmpdir(), "rdstudio-serve-"));
let base = "", hostHeader = "", server: ReturnType<typeof nodeServe>;
let cfg: ReturnType<typeof loadConfig>;

beforeAll(async () => {
  mkdirSync(join(tmp, "config", "rdstudio"), { recursive: true });
  writeFileSync(join(tmp, "config", "rdstudio", "config.toml"), "[learner]\nenabled = true\n");
  process.env.XDG_CONFIG_HOME = join(tmp, "config");
  process.env.XDG_DATA_HOME = join(tmp, "data");
  mkdirSync(join(tmp, "project"));
  writeFileSync(join(tmp, "project", "rdstudio.toml"), "[project]\ntitle = 'T'\n");
  cfg = loadConfig(join(tmp, "project"));
  const site = join(tmp, "site");
  mkdirSync(join(site, "vendor"), { recursive: true });
  writeFileSync(join(site, "index.html"), "<p>hello</p>".repeat(100));
  writeFileSync(join(site, "vendor", "lib.js"), "var x = 1;".repeat(100));
  writeFileSync(join(site, "icon.png"), Buffer.concat([Buffer.from("\x89PNG", "latin1"), Buffer.alloc(100, 48)]));
  const app = createApp({ cfg, site, token: "tok", loopback: true });
  await new Promise<void>((ok) => { server = nodeServe({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 }, () => ok()); });
  const { port } = server.address() as { port: number };
  hostHeader = `127.0.0.1:${port}`;
  base = `http://${hostHeader}`;
});
afterAll(() => { server.close(); });

function call(method: string, path: string, headers: Record<string, string> = {}, body?: string):
  Promise<{ status: number; headers: IncomingHttpHeaders; body: Buffer }> {
  return new Promise((ok, fail) => {
    const req = request(base + path, { method, headers: { Host: hostHeader, ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => ok({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", fail);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

test("writes are accepted only from the dashboard's own pages", async () => {
  const state = JSON.parse((await call("GET", "/api/learner")).body.toString());
  expect(state.enabled && state.token === "tok").toBe(true);
  const good = { Origin: base, "Content-Type": "application/json", "X-Rdstudio-Token": "tok" };
  const post = async (headers: Record<string, string>, body = '{"event": "seen", "concept": "a"}') =>
    (await call("POST", "/api/learner", headers, body)).status;
  expect(await post({ ...good, Origin: "http://evil.example" })).toBe(403);
  const { Origin: _o, ...noOrigin } = good;
  expect(await post(noOrigin)).toBe(403);
  expect(await post({ ...good, "X-Rdstudio-Token": "wrong" })).toBe(403);
  expect(await post({ ...good, "Content-Type": "text/plain" })).toBe(415);
  expect(await post({ ...good, Host: "evil.example", Origin: "http://evil.example" })).toBe(403); // DNS rebinding
  const ts = "me.tail1234.ts.net:8003";
  expect(await post({ ...good, Host: ts, Origin: `https://${ts}` })).toBe(200); // behind tailscale serve
  expect(await post(good, "not json")).toBe(400);
  expect(await post(good)).toBe(200);
  expect(learner.events(cfg).map((e) => e.event)).toEqual(["seen", "seen"]);
  const refused = await call("POST", "/api/learner", { ...good, "X-Rdstudio-Token": "wrong" }, "{}");
  expect(refused.headers.connection).toBe("close");
});

test("text is compressed and vendored files are cached", async () => {
  let r = await call("GET", "/", { "Accept-Encoding": "gzip" });
  expect([r.status, r.headers["content-encoding"], r.headers["cache-control"]]).toEqual([200, "gzip", "no-cache"]);
  expect(gunzipSync(r.body).toString()).toBe("<p>hello</p>".repeat(100));
  expect((await call("GET", "/", { "Accept-Encoding": "gzip", "If-Modified-Since": r.headers["last-modified"]! })).status).toBe(304);
  r = await call("GET", "/vendor/lib.js", { "Accept-Encoding": "gzip" });
  expect(r.headers["cache-control"]).toMatch(/^public, max-age=/);
  r = await call("GET", "/vendor/lib.js");
  expect(r.headers["content-encoding"]).toBeUndefined();
  expect(r.body.toString()).toBe("var x = 1;".repeat(100));
  r = await call("GET", "/icon.png", { "Accept-Encoding": "gzip" });
  expect([r.status, r.headers["content-encoding"], r.headers["content-type"]]).toEqual([200, undefined, "image/png"]);
  expect((await call("GET", "/missing.js")).status).toBe(404);
  expect((await call("GET", "/../../etc/passwd")).status).toBe(404);
  expect((await call("GET", "/vendor")).status).toBe(301);
});

test("the API is described as OpenAPI", async () => {
  const doc = JSON.parse((await call("GET", "/api/openapi.json")).body.toString());
  expect(Object.keys(doc.paths).sort()).toEqual(["/api/artifacts/preview", "/api/artifacts/{path}", "/api/edit", "/api/folders/move", "/api/folders/{path}", "/api/history/{id}", "/api/learner", "/api/learner/tours", "/api/learner/tours/{name}", "/api/notes/{id}", "/api/notes/{id}/assist", "/api/notes/{id}/move", "/api/teacher", "/api/teacher/ai", "/api/teacher/ai/check", "/api/teacher/ai/connect", "/api/teacher/drafts", "/api/teacher/drafts/{id}", "/api/teacher/drafts/{id}/restore", "/api/teacher/drafts/{id}/submitted", "/api/teacher/drafts/{id}/versions", "/api/teacher/files/{name}", "/api/teacher/profile", "/api/teacher/skills/{name}", "/api/teacher/tutor/{id}"]);
  expect(Object.keys(doc.paths["/api/learner"]).sort()).toEqual(["get", "post"]);
  expect(Object.keys(doc.paths["/api/notes/{id}"]).sort()).toEqual(["delete", "get", "put"]);
});

test("private tours are kept beside the record, written only from the dashboard", async () => {
  const good = { Origin: base, "Content-Type": "application/json", "X-Rdstudio-Token": "tok" };
  const body = JSON.stringify({ title: "First steps", description: "Where to begin.", body: "1. [A](/a.md): start here.\n" });
  expect((await call("PUT", "/api/learner/tours/first", { ...good, Origin: "http://evil.example" }, body)).status).toBe(403);
  expect((await call("PUT", "/api/learner/tours/Bad%20Name", good, body)).status).toBe(400);
  expect((await call("PUT", "/api/learner/tours/first", good, JSON.stringify({ body: "x" }))).status).toBe(400);
  expect((await call("PUT", "/api/learner/tours/first", good, body)).status).toBe(200);
  const file = readFileSync(join(learner.recordDir(cfg), "tours", "first.md"), "utf8");
  expect(file).toBe("---\ntype: Tour\ntitle: First steps\ndescription: Where to begin.\n---\n\n1. [A](/a.md): start here.\n");
  const list = JSON.parse((await call("GET", "/api/learner/tours")).body.toString());
  expect(list).toEqual([{ name: "first", title: "First steps", description: "Where to begin.", body: "1. [A](/a.md): start here.\n" }]);
  expect((await call("DELETE", "/api/learner/tours/first", { Origin: base, "X-Rdstudio-Token": "tok" })).status).toBe(200);
  expect(JSON.parse((await call("GET", "/api/learner/tours")).body.toString())).toEqual([]);
});

test("the teacher's skills are read by anyone here, customised only from the dashboard", async () => {
  const good = { Origin: base, "Content-Type": "application/json", "X-Rdstudio-Token": "tok" };
  const state = JSON.parse((await call("GET", "/api/teacher")).body.toString());
  expect(state).toMatchObject({ enabled: true, profile: "topic", profileSet: false, history: [] });
  expect(state.skills[0]).toMatchObject({ name: "teach", status: "default" });

  const teach = JSON.parse((await call("GET", "/api/teacher/skills/teach")).body.toString());
  expect(teach).toMatchObject({ name: "teach", status: "default", base: null });
  expect(teach.text).toBe(teach.default);
  expect((await call("GET", "/api/teacher/skills/nope")).status).toBe(404);
  expect((await call("GET", "/api/teacher/skills/..%2Fx")).status).toBe(404);

  const put = (headers: Record<string, string>, body = '{"text": "Mine."}', name = "teach") => call("PUT", `/api/teacher/skills/${name}`, headers, body);
  expect((await put({ ...good, "X-Rdstudio-Token": "bad" })).status).toBe(403);
  expect((await put({ ...good, Origin: "http://evil.example" })).status).toBe(403);
  expect((await put(good, '{"text": ""}')).status).toBe(400);
  expect((await put(good, '{"text": "x"}', "Bad")).status).toBe(400);
  const saved = JSON.parse((await put(good)).body.toString());
  expect(saved).toMatchObject({ status: "changed", text: "Mine.\n", base: teach.default });
  const after = JSON.parse((await call("GET", "/api/teacher")).body.toString());
  expect(after.history.map((h: { message: string }) => h.message)).toEqual(["Skill teach: customised"]);

  const reset = JSON.parse((await call("DELETE", "/api/teacher/skills/teach", { Origin: base, "X-Rdstudio-Token": "tok" })).body.toString());
  expect(reset.skill).toMatchObject({ status: "default", text: teach.default });
});

test("drafts are written only from the dashboard, with slashes in the id encoded", async () => {
  const good = { Origin: base, "Content-Type": "application/json", "X-Rdstudio-Token": "tok" };
  const id = encodeURIComponent("exercises/one");
  expect(JSON.parse((await call("GET", `/api/teacher/drafts/${id}`)).body.toString())).toMatchObject({ exercise: "exercises/one", text: "", versions: [] });
  expect((await call("PUT", `/api/teacher/drafts/${id}`, { ...good, "X-Rdstudio-Token": "bad" }, '{"text": "x"}')).status).toBe(403);
  expect(JSON.parse((await call("PUT", `/api/teacher/drafts/${id}`, good, '{"text": "So far.", "working": ""}')).body.toString()).text).toBe("So far.");
  const kept = JSON.parse((await call("POST", `/api/teacher/drafts/${id}/versions`, good, '{"reason": "feedback"}')).body.toString());
  expect(kept.versions).toMatchObject([{ id: "v1", reason: "feedback", text: "So far." }]);
  await call("PUT", `/api/teacher/drafts/${id}`, good, '{"text": "Changed."}');
  expect(JSON.parse((await call("POST", `/api/teacher/drafts/${id}/restore`, good, '{"version": "v1"}')).body.toString()).text).toBe("So far.");
  expect((await call("POST", `/api/teacher/drafts/${id}/restore`, good, '{"version": "v7"}')).status).toBe(400);
  expect((await call("GET", `/api/teacher/drafts/${encodeURIComponent("../etc")}`)).status).toBe(400);
});

test("connecting OpenRouter: a PKCE sign-in address, a callback that checks its state, and spending", async () => {
  const good = { Origin: base, "X-Rdstudio-Token": "tok" };
  const state = JSON.parse((await call("GET", "/api/teacher/ai")).body.toString());
  expect(state).toMatchObject({ connected: false, from: null, spending: { budget: 10, spent: 0, calls: 0 } });
  expect(state.models.hint).toBe("google/gemini-3.8-flash");
  expect((await call("POST", "/api/teacher/ai/connect", { ...good, "X-Rdstudio-Token": "bad" })).status).toBe(403);
  const { url } = JSON.parse((await call("POST", "/api/teacher/ai/connect", good)).body.toString());
  const u = new URL(url);
  expect(u.origin + u.pathname).toBe("https://openrouter.ai/auth");
  expect(u.searchParams.get("code_challenge_method")).toBe("S256");
  expect(u.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(u.searchParams.get("callback_url")).toMatch(new RegExp(`^http://${hostHeader.replace(/\./g, "\\.")}/api/teacher/ai/callback\\?state=[A-Za-z0-9_-]+$`));
  // A callback with an unknown state goes back to the Teacher page, saying so; no key is kept.
  const r = await call("GET", "/api/teacher/ai/callback?state=forged&code=abc");
  expect([r.status, r.headers.location]).toEqual([302, "/?ai=expired#/teacher"]);
  expect(JSON.parse((await call("GET", "/api/teacher/ai")).body.toString()).connected).toBe(false);
  const check = await call("POST", "/api/teacher/ai/check", good);
  expect(check.status).toBe(409);
  expect(JSON.parse(check.body.toString()).error).toMatch(/No OpenRouter key/);
});
