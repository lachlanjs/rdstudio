// rdstudio provider init (T106): the answers checked, the table written, and
// nothing secret ever in it.

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import * as models from "../src/models.ts";
import { checked, guesses, has, interview, nameFor, rows, tiers, write, type Ask } from "../src/providerinit.ts";

function home() {
  const tmp = mkdtempSync(join(tmpdir(), "rdstudio-init-"));
  mkdirSync(join(tmp, "config", "rdstudio"), { recursive: true });
  process.env.XDG_CONFIG_HOME = join(tmp, "config");
  const conf = join(tmp, "config", "rdstudio", "config.toml");
  for (const f of ["id.p12", "corp-ca.pem", "me.pem", "me.key"]) writeFileSync(join(tmp, f), "x");
  return { tmp, conf };
}
/** Answers given in order to whatever is asked; the questions are kept. */
const script = (answers: string[], asked: string[] = []): Ask => async (question, fallback = "") => { asked.push(question); return (answers.shift() ?? "") || fallback; };

test("the answers are checked before anything is written, and each mistake says what to do", () => {
  const { tmp } = home();
  expect(checked({ url: " https://ai.acme.example/v1/chat/completions/ " }).url).toBe("https://ai.acme.example/v1");
  expect(checked({ url: "http://127.0.0.1:4000/v1" }).auth).toBe("bearer");
  for (const [a, why] of [
    [{ url: "ai.acme.example/v1" }, /not an address: write it whole/],
    [{ url: "http://ai.acme.example/v1" }, /must begin https/],
    [{ url: "https://me:secret@ai.acme.example/v1" }, /leave the name and password out/],
    [{ url: "https://x.example", auth: "oauth" }, /auth is "bearer", "header" or "none"/],
    [{ url: "https://x.example", clientPfx: join(tmp, "id.p12"), clientCert: join(tmp, "me.pem"), clientKey: join(tmp, "me.key") }, /not both/],
    [{ url: "https://x.example", clientCert: join(tmp, "me.pem") }, /needs both/],
    [{ url: "https://x.example", clientPfx: join(tmp, "nowhere.p12") }, /there is no file/],
    [{ url: "https://x.example", caFile: "/nowhere/ca.pem" }, /authority's certificate: there is no file/],
    [{ url: "https://x.example", keyEnv: "sk-live-0123456789abcdef" }, /name of an environment variable.*not the value itself/],
    [{ url: "https://x.example", pfxPasswordEnv: "hunter2!" }, /name of an environment variable/],
    [{ url: "https://x.example", proxy: "proxy.acme.example:8080" }, /not a proxy's address/],
    [{ url: "https://x.example", proxy: "http://me:pw@proxy.acme.example:8080" }, /leave the proxy's password out/],
  ] as const) expect(() => checked(a as never)).toThrow(why);
});

test("the table holds what was said and no more, and the tables under it are left alone", () => {
  const { tmp, conf } = home();
  expect(rows({ url: "https://ai.acme.example/v1" })).toEqual(['url = "https://ai.acme.example/v1"']);
  writeFileSync(conf, '[actors]\nhuman = "human:me"\n\n[teacher.provider]\nurl = "https://old.example/v1"\nstream = false\n\n[teacher.provider.prices]\n"gpt" = [1, 2]\n\n[teacher.tiers]\nlow = "gpt"\n');
  expect(has()).toBe(true);
  write({ url: "https://ai.acme.example/v1", name: "acme", auth: "none", keyEnv: "IGNORED_WITH_NO_KEY", caFile: join(tmp, "corp-ca.pem"), systemCa: true, clientPfx: join(tmp, "id.p12"), pfxPasswordEnv: "ACME_PFX", proxy: "env" });
  const text = readFileSync(conf, "utf8");
  expect(text).toBe(`[actors]\nhuman = "human:me"\n\n[teacher.provider]\nname = "acme"\nurl = "https://ai.acme.example/v1"\nauth = "none"\nca_file = ${JSON.stringify(join(tmp, "corp-ca.pem"))}\nsystem_ca = true\nclient_pfx = ${JSON.stringify(join(tmp, "id.p12"))}\npfx_password_env = "ACME_PFX"\nproxy = "env"\n\n[teacher.provider.prices]\n"gpt" = [1, 2]\n\n[teacher.tiers]\nlow = "gpt"\n`);
  // As the program reads it back.
  expect(models.provider()).toMatchObject({ custom: true, name: "acme", url: "https://ai.acme.example/v1", auth: "none", systemCa: true, clientPfx: join(tmp, "id.p12"), pfxPasswordEnv: "ACME_PFX", proxy: "env", stream: true, prices: { gpt: [1, 2] } });
  // A first gateway, in a config that has none: the table is added with its comment.
  writeFileSync(conf, "");
  expect(has()).toBe(false);
  write({ url: "https://ai.acme.example/v1", clientCert: join(tmp, "me.pem"), clientKey: join(tmp, "me.key"), keyEnv: "ACME_KEY" });
  expect(readFileSync(conf, "utf8")).toMatch(/^# Where the models come from.*\n\[teacher\.provider\]\nurl = "https:\/\/ai\.acme\.example\/v1"\nkey_env = "ACME_KEY"\nclient_cert = /);
});

test("what is to hand is offered: a proxy in the environment, and certificates where they are usually put", () => {
  const { tmp } = home();
  const found = guesses({ HTTPS_PROXY: "http://proxy:8080" }, [tmp, join(tmp, "nowhere")]);
  expect(found).toEqual({ proxy: "http://proxy:8080", pfx: [join(tmp, "id.p12")], pem: [join(tmp, "corp-ca.pem")] }); // me.pem is not an authority's
  expect(guesses({}, []).proxy).toBe("");
  expect([nameFor("https://ai.acme.example/v1"), nameFor("http://127.0.0.1:4000/v1"), nameFor("http://localhost:4000"), nameFor("https://gateway/v1")]).toEqual(["acme", "gateway", "gateway", "gateway"]);
});

test("the questions are few, each takes one line, and none asks for a secret", async () => {
  const { tmp } = home();
  const asked: string[] = [], said: string[] = [];
  // The case that was met: a PFX file with a password, the authority apart, a key wanted all the same, a proxy in the environment.
  const a = await interview(script(["not an address", "https://ai.acme.example/v1", "", "", "", "y", "", "", ""], asked), (l) => said.push(l), { proxy: "http://proxy:8080", pfx: [join(tmp, "id.p12")], pem: [join(tmp, "corp-ca.pem")] });
  expect(a).toEqual({ url: "https://ai.acme.example/v1", name: "acme", clientPfx: join(tmp, "id.p12"), pfxPasswordEnv: "RDSTUDIO_PFX_PASSWORD", auth: "bearer", keyEnv: "RDSTUDIO_PROVIDER_KEY", caFile: join(tmp, "corp-ca.pem"), proxy: "env" });
  expect(said.join("\n")).toMatch(/not an address: write it whole/); // the mistake is said, and the question asked again
  expect(asked.length).toBeLessThanOrEqual(10);
  expect(asked.join("\n")).not.toMatch(/your (key|password)\b|enter (the|your) (key|password)/i);
  expect(rows(a)).toContain('key_env = "RDSTUDIO_PROVIDER_KEY"');
  // The least: a public certificate, a key, no proxy.
  expect(await interview(script(["https://ai.acme.example/v1"]), () => {}, { proxy: "", pfx: [], pem: [] })).toEqual({ url: "https://ai.acme.example/v1", name: "acme", auth: "bearer", keyEnv: "RDSTUDIO_PROVIDER_KEY" });
  // "n" for none, a path with no file there asked again at once, and a proxy that is not an address too.
  const told: string[] = [];
  const c = await interview(script(["https://ai.acme.example/v1", "", "n", "/nowhere/me.pem", "No", "y", "", "/nowhere/ca.pem", "none", "proxy:8080", "n"]), (l) => told.push(l), { proxy: "", pfx: [join(tmp, "id.p12")], pem: [] });
  expect(c).toEqual({ url: "https://ai.acme.example/v1", name: "acme", auth: "bearer", keyEnv: "RDSTUDIO_PROVIDER_KEY" });
  expect(told.filter((l) => /There is no file/.test(l))).toHaveLength(2);
  expect(told.join("\n")).toMatch(/not a proxy's address/);
  await expect(interview(script(["https://ai.acme.example/v1", "", "", join(tmp, "me.pem"), ""]), () => {}, { proxy: "", pfx: [], pem: [] })).rejects.toThrow(/needs its key too/);
  await expect(interview(script(["https://ai.acme.example/v1", "", "/a", "/b", "/c", "/d"]), () => {}, { proxy: "", pfx: [], pem: [] })).rejects.toThrow(/no file was found/);
  // A certificate alone says who you are; the machine's own store is trusted.
  const b = await interview(script(["https://ai.acme.example/v1", "ai", "", join(tmp, "me.pem"), join(tmp, "me.key"), "", "system", "http://proxy.acme.example:8080"]), () => {}, { proxy: "", pfx: [], pem: [] });
  expect(b).toEqual({ url: "https://ai.acme.example/v1", name: "ai", clientCert: join(tmp, "me.pem"), clientKey: join(tmp, "me.key"), auth: "none", systemCa: true, proxy: "http://proxy.acme.example:8080" });
});

test("the tiers are named by number from the gateway's list, or by name where it gives none", async () => {
  const said: string[] = [];
  expect(await tiers(script(["2", "", "gpt-5-prod"]), (l) => said.push(l), ["gpt-4o-mini-prod", "gpt-4o-prod"])).toEqual({ low: "gpt-4o-prod", mid: "gpt-4o-prod", max: "gpt-5-prod" }); // Enter takes the one before
  expect(said.join("\n")).toContain("  2. gpt-4o-prod");
  expect(await tiers(script(["small", "big", "big"]), (l) => said.push(l), null)).toEqual({ low: "small", mid: "big", max: "big" });
  expect(said.join("\n")).toMatch(/did not give a list/);
  expect(await tiers(script([]), () => {}, null)).toEqual({});
});
