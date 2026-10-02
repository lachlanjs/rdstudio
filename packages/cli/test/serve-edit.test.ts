// Editing notes through rdstudio serve: the same protection as the learner
// record's writes, conflicts, read-only servers, and a rebuild after a save.

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve as nodeServe } from "@hono/node-server";
import { afterAll, beforeAll, expect, test } from "vitest";
import { loadConfig } from "../src/config.ts";
import { createApp } from "../src/serve.ts";

const tmp = mkdtempSync(join(tmpdir(), "rdstudio-serve-edit-"));
const servers: ReturnType<typeof nodeServe>[] = [];
let writes = 0;

async function start(readOnly: boolean): Promise<(method: string, path: string, headers?: Record<string, string>, body?: unknown) => Promise<{ status: number; json: any }>> {
  const app = createApp({ cfg, site: join(tmp, "site"), token: "tok", loopback: true, readOnly, onWrite: () => { writes++; } });
  const server = await new Promise<ReturnType<typeof nodeServe>>((ok) => { const s = nodeServe({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 }, () => ok(s)); });
  servers.push(server);
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  return (method, path, headers = {}, body) => new Promise((ok, fail) => {
    const req = request(`http://${host}${path}`, { method, headers: { Host: host, ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        let json: unknown = null;
        try { json = JSON.parse(text || "null"); } catch { json = text; }
        ok({ status: res.statusCode!, json });
      });
    });
    req.on("error", fail);
    if (body !== undefined) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

let cfg: ReturnType<typeof loadConfig>;
let call: Awaited<ReturnType<typeof start>>;

beforeAll(async () => {
  mkdirSync(join(tmp, "project", "knowledge", "a"), { recursive: true });
  mkdirSync(join(tmp, "site"));
  writeFileSync(join(tmp, "project", "rdstudio.toml"), "[project]\ntitle = 'T'\n[actors]\nhuman = 'human:tester'\n");
  writeFileSync(join(tmp, "project", "knowledge", "a", "n.md"), "---\ntype: Note\ntitle: N\n---\n\nThe metric is smooth.\n");
  cfg = loadConfig(join(tmp, "project"));
  call = await start(false);
});
afterAll(() => { for (const s of servers) s.close(); });

const file = () => readFileSync(join(tmp, "project", "knowledge", "a", "n.md"), "utf8");
const id = encodeURIComponent("a/n");

test("the editing state names the token and who edits are attributed to", async () => {
  const { json } = await call("GET", "/api/edit");
  expect(json).toEqual({ enabled: true, token: "tok", actor: "human:tester" });
});

test("a note's source, and errors for missing or invalid ids", async () => {
  const { status, json } = await call("GET", `/api/notes/${id}`);
  expect(status).toBe(200);
  expect(json).toMatchObject({ id: "a/n", path: "a/n.md", meta: { type: "Note", title: "N" }, body: "The metric is smooth.\n" });
  expect((await call("GET", `/api/notes/${encodeURIComponent("a/none")}`)).status).toBe(404);
  expect((await call("GET", `/api/notes/${encodeURIComponent("../x")}`)).status).toBe(400);
});

test("saves are refused from other sites, without the token, or not as JSON", async () => {
  const before = file();
  const { json: src } = await call("GET", `/api/notes/${id}`);
  const host = (servers[0]!.address() as { port: number }).port;
  const good = { Origin: `http://127.0.0.1:${host}`, "Content-Type": "application/json", "X-Rdstudio-Token": "tok" };
  const put = async (h: Record<string, string>, body: unknown = { base: src.version, body: "Changed entirely by someone else.\n" }) =>
    (await call("PUT", `/api/notes/${id}`, h, body)).status;
  expect(await put({ ...good, Origin: "http://evil.example" })).toBe(403);
  const { Origin: _o, ...noOrigin } = good;
  expect(await put(noOrigin)).toBe(403);
  expect(await put({ ...good, "X-Rdstudio-Token": "wrong" })).toBe(403);
  expect(await put({ ...good, "Content-Type": "text/plain" })).toBe(415);
  expect(await put(good, "not json")).toBe(400);
  expect(await put(good, { body: "no base" })).toBe(400);
  expect(file()).toBe(before);
  expect(writes).toBe(0);
});

test("a save writes the note, attributes it, and rebuilds; a stale one is a conflict", async () => {
  const port = (servers[0]!.address() as { port: number }).port;
  const good = { Origin: `http://127.0.0.1:${port}`, "Content-Type": "application/json", "X-Rdstudio-Token": "tok" };
  const { json: src } = await call("GET", `/api/notes/${id}`);
  const saved = await call("PUT", `/api/notes/${id}`, good, { base: src.version, body: "A completely different account of curvature.\n" });
  expect(saved.status).toBe(200);
  expect(saved.json).toMatchObject({ changed: true, significant: true, note: { meta: { generated: { by: "human:tester" } } } });
  expect(file()).toContain("A completely different account of curvature.");
  expect(writes).toBe(1);

  // Saving again from the old version: refused, with the note as it is now.
  const stale = await call("PUT", `/api/notes/${id}`, good, { base: src.version, body: "Mine.\n" });
  expect(stale.status).toBe(409);
  expect(stale.json.current.body).toContain("A completely different account");
  expect(file()).not.toContain("Mine.");

  // Unchanged: no write, no rebuild.
  const now = saved.json.note;
  expect((await call("PUT", `/api/notes/${id}`, good, { base: now.version, body: now.body })).json.changed).toBe(false);
  expect(writes).toBe(1);

  // Creating a note, then refusing to create it twice.
  const made = await call("PUT", `/api/notes/${encodeURIComponent("philosophy/motivation")}`, good, { base: null, meta: { type: "Idea", title: "Motivation" }, body: "Why.\n" });
  expect(made.status).toBe(200);
  expect(made.json.created).toBe(true);
  expect((await call("PUT", `/api/notes/${encodeURIComponent("philosophy/motivation")}`, good, { base: null, meta: { type: "Idea" } })).status).toBe(409);
  expect((await call("PUT", `/api/notes/${encodeURIComponent("x")}`, good, { base: null, meta: { title: "no type" } })).status).toBe(400);
});

test("a read-only server hands out no token and refuses saves", async () => {
  const ro = await start(true);
  const { json } = await ro("GET", "/api/edit");
  expect(json).toMatchObject({ enabled: false, token: null });
  const port = (servers[1]!.address() as { port: number }).port;
  const { json: src } = await ro("GET", `/api/notes/${id}`);
  const r = await ro("PUT", `/api/notes/${id}`, { Origin: `http://127.0.0.1:${port}`, "Content-Type": "application/json", "X-Rdstudio-Token": "tok" }, { base: src.version, body: "x\n" });
  expect(r.status).toBe(403);
});

test("moving and deleting through the API: protected, checked, rebuilt", async () => {
  const port = (servers[0]!.address() as { port: number }).port;
  const good = { Origin: `http://127.0.0.1:${port}`, "Content-Type": "application/json", "X-Rdstudio-Token": "tok" };
  const k = (rel: string) => join(tmp, "project", "knowledge", rel);
  writeFileSync(k("a/m.md"), "---\ntype: Note\ntitle: M\n---\n\nSee [n](/a/n.md).\n");
  const before = writes;

  // Refused without the token or from another site.
  expect((await call("POST", `/api/notes/${id}/move`, { ...good, "X-Rdstudio-Token": "no" }, { to: "b/n" })).status).toBe(403);
  expect((await call("DELETE", `/api/notes/${id}`, { ...good, Origin: "http://evil.example" })).status).toBe(403);
  expect(writes).toBe(before);

  // Move with the version it started from: the link in m follows.
  const { json: src } = await call("GET", `/api/notes/${id}`);
  const moved = await call("POST", `/api/notes/${id}/move`, good, { to: "b/n", base: src.version });
  expect(moved.status).toBe(200);
  expect(moved.json).toEqual({ moved: [{ from: "a/n", to: "b/n" }], rewritten: ["a/m.md"] });
  expect(readFileSync(k("a/m.md"), "utf8")).toContain("[n](/b/n.md)");
  expect(writes).toBe(before + 1);
  expect((await call("POST", `/api/notes/${id}/move`, good, { to: "c/n" })).status).toBe(409); // gone from a/n

  // Folder move, then delete: stale versions refused; backlinks reported.
  expect((await call("POST", "/api/folders/move", good, { from: "b", to: "c/b" })).status).toBe(200);
  expect(readFileSync(k("a/m.md"), "utf8")).toContain("[n](/c/b/n.md)");
  const nid = encodeURIComponent("c/b/n");
  expect((await call("DELETE", `/api/notes/${nid}?base=0123456789abcdef`, good)).status).toBe(409);
  const del = await call("DELETE", `/api/notes/${nid}`, good);
  expect(del.json).toEqual({ deleted: "c/b/n", backlinks: ["a/m"] });
  expect((await call("DELETE", `/api/folders/${encodeURIComponent("a")}`, good)).status).toBe(400); // not empty
});
