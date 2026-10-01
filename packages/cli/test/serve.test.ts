// The server against the Python server's tests (tests/test_learner.py).

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
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
  expect(Object.keys(doc.paths).sort()).toEqual(["/api/edit", "/api/learner", "/api/notes/{id}"]);
  expect(Object.keys(doc.paths["/api/learner"]).sort()).toEqual(["get", "post"]);
  expect(Object.keys(doc.paths["/api/notes/{id}"]).sort()).toEqual(["get", "put"]);
});
