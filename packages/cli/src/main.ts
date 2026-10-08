#!/usr/bin/env node
// The rdstudio command line in Node, replacing src/rdstudio/cli.py command by
// command (see knowledge/tasks/T37-node-cli-mcp-serve.md). Output matches the
// Python command line's, so either can be used while both exist.

import { parseArgs, type ParseArgsConfig } from "node:util";
import { Bundle, ProcedureError, SearchIndex, graphOf, isProcedure, round3 } from "@rdstudio/core";
import { loadBundle, writeIndexes } from "@rdstudio/core/node";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { indexCode } from "./code.ts";
import * as embed from "./embed.ts";
import * as models from "./models.ts";
import { clientCertUntil, describe as describeProvider, endpoint, setWatch, type Provider, type Seen } from "./provider.ts";
import * as artifacts from "./artifacts.ts";
import { build } from "./build.ts";
import { serve } from "./serve.ts";
import { brief } from "./brief.ts";
import * as refs from "./references.ts";
import { runServer } from "./mcp.ts";
import { init } from "./scaffold.ts";
import * as teacher from "./teacher.ts";
import { ScopeError, globalConfig, initGlobal, moveSkill, promote, skillDirs } from "./scopes.ts";
import { StoreError, verify } from "./store.ts";
import { loadConfig, userConfigPath, type Config } from "./config.ts";
import * as learner from "./learner.ts";
import { resolve as resolveProposal } from "./procedures.ts";
import { PyFloat, pyDumps, pyRepr, pyStr } from "./pyjson.ts";

export const VERSION = "0.4.0";

type Options = NonNullable<ParseArgsConfig["options"]>;
type Values = Record<string, string | boolean | string[] | undefined>;

interface Command {
  help: string;
  usage?: string;
  options?: Options;
  run(cfg: Config, values: Values, positionals: string[]): number;
}

const bundle = (cfg: Config): Bundle => loadBundle(cfg.knowledgeDir);

// Ported in later slices of T37; until then the Python command line has them.
const PENDING: string[] = [];

/** `rdstudio provider check`: one small request, and what it shows of the connection, the models and the spending. */
async function providerCheck(cfg: Config, p: Provider, model: string | undefined, verbose: boolean): Promise<boolean> {
  const day = 86_400_000, soon = (until: Date) => until.getTime() - Date.now() < 30 * day;
  const ends = (until: Date) => (until.getTime() < Date.now() ? `ran out on ${until.toISOString().slice(0, 10)}` : `runs out on ${until.toISOString().slice(0, 10)} (${Math.max(0, Math.floor((until.getTime() - Date.now()) / day))} days)`);
  // A client certificate that has run out, or is about to, is said before the gateway's refusal is.
  const pem = clientCertUntil(p);
  if (pem && soon(pem)) console.log(`\nThe client certificate ${ends(pem)}.`);
  const use = model ?? models.models().check;
  let seen: Seen | null = null;
  if (p.custom) setWatch((s) => { seen = s; });
  const connection = () => {
    const s = seen as Seen | null;
    if (!s) return;
    if (verbose) {
      if (s.tunnel) console.log(`  tunnelled through   ${s.tunnel}`);
      console.log(`  secured with        ${s.protocol ?? "TLS"}; the certificate is ${s.server ? `${s.server.subject}'s, signed by ${s.server.issuer}, good until ${s.server.until}` : "not known"}; verified`);
      console.log(`  client certificate  ${s.client ? `${s.client.subject}'s, good until ${s.client.until}` : "none was shown"}`);
    }
    const until = s.client ? new Date(s.client.until) : null;
    if (until && !pem && soon(until)) console.log(`The client certificate ${ends(until)}.`);
  };
  console.log(`\nAsking ${use} for one word…`);
  if (verbose) console.log(`  POST ${endpoint(p)}`);
  const t0 = Date.now();
  let ok = true;
  try {
    // Room enough for a model that reasons before it answers.
    const r = await models.complete({ cfg, job: "check", model: use, maxTokens: 512, messages: [{ role: "user", content: "Reply with the one word: ready" }] });
    connection();
    const counts = `${r.usage.prompt_tokens} tokens in, ${r.usage.completion_tokens} out, $${r.usage.cost.toFixed(5)}`;
    if (r.text.trim()) console.log(`It answered ${JSON.stringify(r.text.trim())} in ${Date.now() - t0} ms (${counts}).`);
    else console.log(`It answered in ${Date.now() - t0} ms, with no text (${counts}). The connection and the key are good; a model that reasons can spend its whole allowance before it writes. Try another model: rdstudio provider check <model>.`);
    if (!r.usage.prompt_tokens) console.log("No token counts came back: spending cannot be worked out. If replies are streamed, try stream_usage = true, or stream = false.");
    else if (p.custom && !p.prices[use] && !r.usage.cost) console.log(`No price is set for ${use}: add it under [teacher.provider.prices] for the weekly budget to count it.`);
  } catch (err) {
    connection();
    console.log(`It failed: ${(err as Error).message}`);
    if (verbose && (err as models.ModelError).raw) console.log(`  what came back:\n${(err as models.ModelError).raw!.split("\n").map((l) => "    " + l).join("\n")}`);
    else if (!verbose) console.log("rdstudio provider check --verbose shows what the connection was made with, and what came back.");
    ok = false;
  }
  // The names in use, against the gateway's own list, where it has one.
  if (p.custom) {
    const list = await models.offered();
    setWatch(null);
    if (list) {
      const inUse = new Map<string, string[]>();
      for (const [t, m] of Object.entries(models.tiers())) inUse.set(m, [...(inUse.get(m) ?? []), `tier ${t}`]);
      for (const [j, m] of Object.entries(models.models())) if (j !== "write") inUse.set(m, [...(inUse.get(m) ?? []), `job ${j}`]);
      const missing = [...inUse].filter(([m]) => !list.includes(m));
      for (const [m, where] of missing) console.log(`${p.name} does not list ${m} (${where.join(", ")}).`);
      if (missing.length || verbose) console.log(`It offers: ${list.slice(0, 40).join(", ")}${list.length > 40 ? `, and ${list.length - 40} more` : ""}`);
      else console.log(`The models in use are all among the ${list.length} it offers.`);
    } else if (verbose) console.log(`${p.name} gave no list of models (${p.url}/models): their names are not checked.`);
  }
  return ok;
}

const COMMANDS: Record<string, Command> = {
  init: {
    help: "scaffold rdstudio into a repository",
    usage: "[path] [--title TITLE] [--human HUMAN] [--profile {topic,codebase,project}] [--force]",
    options: { title: { type: "string" }, human: { type: "string" }, profile: { type: "string" }, force: { type: "boolean" } },
    run(_cfg, v, [path = "."]) {
      const p = v.profile as string | undefined;
      if (p !== undefined && !(teacher.PROFILES as readonly string[]).includes(p)) {
        return usageError("init", `argument --profile: invalid choice: ${pyRepr(p)} (choose from ${teacher.PROFILES.map((x) => `'${x}'`).join(", ")})`);
      }
      for (const line of init(path, { title: v.title as string | undefined, human: v.human as string | undefined, force: Boolean(v.force) })) console.log(line);
      if (p) console.log(`teacher profile: ${teacher.setProfile(loadConfig(path), p)}`);
      return 0;
    },
  },

  check: {
    help: "check OKF conformance of the knowledge bundle",
    options: { warnings: { type: "boolean", short: "w" } },
    run(cfg, v) {
      const b = bundle(cfg);
      const issues = b.lint();
      const errors = issues.filter((i) => i.level === "error");
      for (const i of issues) {
        if (i.level === "error" || v.warnings) console.log(`${i.level.padEnd(7)} ${i.path}: ${i.message}`);
      }
      // Artifacts (T76): their weight, addresses elsewhere, a missing title; warnings only.
      const found = artifacts.scan(cfg.knowledgeDir, b), about = artifacts.lint(found, cfg.reportsDir, cfg.reports);
      if (v.warnings) for (const i of about) console.log(`${i.severity.padEnd(7)} ${i.path}: ${i.message}`);
      const count = found.length ? `, ${found.length} artifact${found.length === 1 ? "" : "s"}` : "";
      console.log(`${b.concepts.size} concepts${count}, ${errors.length} errors, ${issues.length - errors.length + about.length} warnings`);
      return errors.length ? 1 : 0;
    },
  },

  index: {
    help: "regenerate index.md files",
    run(cfg) {
      const changed = writeIndexes(bundle(cfg), cfg.knowledgeDir);
      for (const path of changed) console.log(`wrote ${path}`);
      if (!changed.length) console.log("indexes up to date");
      return 0;
    },
  },

  search: {
    help: "search the knowledge bundle",
    usage: "query...",
    options: {
      limit: { type: "string", short: "n", default: "8" },
      type: { type: "string" },
      tag: { type: "string", multiple: true },
      under: { type: "string" },
      json: { type: "boolean" },
    },
    run(cfg, v, query) {
      if (!query.length) return usageError("search", "the following arguments are required: query");
      const hits = new SearchIndex(bundle(cfg)).search(query.join(" "), {
        limit: Number(v.limit), type: v.type as string | undefined, tags: v.tag as string[] | undefined, under: v.under as string | undefined,
      });
      if (v.json) {
        console.log(pyDumps(hits.map((h) => ({
          id: h.concept.id, title: h.concept.title, type: h.concept.type, description: h.concept.description,
          trust: h.concept.trust, score: new PyFloat(round3(h.score)), snippet: h.snippet,
        })), { indent: 2 }));
        return 0;
      }
      for (const h of hits) {
        console.log(`${h.score.toFixed(2).padStart(6)}  ${h.concept.id}  [${h.concept.type}]  ${h.concept.title}`);
        if (h.snippet) console.log(`        ${h.snippet}`);
      }
      return 0;
    },
  },

  brief: {
    help: "print a short orientation for an agent session",
    run(cfg) {
      console.log(brief(cfg));
      return 0;
    },
  },

  mcp: {
    help: "run the MCP server on stdio",
    usage: "[--agent ACTOR]",
    options: { agent: { type: "string" } },
    run(cfg, v) {
      if (v.agent) cfg.agent = v.agent as string;
      runServer(cfg, VERSION).catch((err: unknown) => { console.error(err); process.exit(1); });
      return 0;
    },
  },

  learner: {
    help: "where your private learner record is, or its recent events",
    usage: "[where|log]",
    options: { limit: { type: "string", short: "n", default: "30" } },
    run(cfg, v, [action = "where"]) {
      if (action === "where") {
        const state = learner.enabled(cfg) ? "on" : `off (set [learner] enabled = true in ${userConfigPath()})`;
        console.log(`learner record: ${state}`);
        console.log(`project id:     ${learner.projectId(cfg.root)}`);
        console.log(`folder:         ${learner.recordDir(cfg)}`);
        return 0;
      }
      if (action !== "log") return usageError("learner", `argument action: invalid choice: '${action}' (choose from 'where', 'log')`);
      const limit = Number(v.limit);
      const all = learner.events(cfg);
      for (const e of limit > 0 ? all.slice(-limit) : all) {
        const { at = "", event = "", concept, ...rest } = e as Record<string, unknown>;
        console.log(`${at}  ${String(event).padEnd(10)} ${concept || ""}  ${Object.keys(rest).length ? pyDumps(rest) : ""}`);
      }
      return 0;
    },
  },

  teacher: {
    help: "the teacher: its profile, its skills (and which you customised), where it keeps them",
    usage: "[where|profile [topic|codebase|project]|skills]",
    run(cfg, _v, [action = "where", arg]) {
      if (action === "where") {
        const p = teacher.profile(cfg);
        console.log(`profile: ${p.profile}${p.set ? "" : ` (guessed; set it with rdstudio teacher profile ${teacher.PROFILES.join("|")})`}`);
        console.log(`folder:  ${teacher.teacherDir(cfg)}`);
        console.log(`skills:  ${teacher.skills(cfg).map((s) => s.name + (s.status === "default" ? "" : ` (${s.status})`)).join(", ")}`);
        return 0;
      }
      if (action === "profile") {
        if (!arg) { console.log(teacher.profile(cfg).profile); return 0; }
        if (!(teacher.PROFILES as readonly string[]).includes(arg)) {
          return usageError("teacher", `invalid profile: ${pyRepr(arg)} (choose from ${teacher.PROFILES.map((x) => `'${x}'`).join(", ")})`);
        }
        if (!cfg.isProject) { console.log("not in an rdstudio project"); return 1; }
        console.log(`teacher profile: ${teacher.setProfile(cfg, arg)}`);
        return 0;
      }
      if (action === "skills") {
        for (const s of teacher.skills(cfg)) console.log(`${s.name.padEnd(16)} ${s.status.padEnd(8)} ${s.defaultChanged ? "(default changed since) " : ""}${s.description}`);
        return 0;
      }
      return usageError("teacher", `argument action: invalid choice: ${pyRepr(action)} (choose from 'where', 'profile', 'skills')`);
    },
  },

  verify: {
    help: "record a human verification of concepts",
    usage: "concept... [--by human:<id>]",
    options: { by: { type: "string" } },
    run(cfg, v, concepts) {
      if (!concepts.length) return usageError("verify", "the following arguments are required: concepts");
      const actor = (v.by as string | undefined) || cfg.human;
      if (!actor.startsWith("human:")) {
        console.error('set [actors] human = "human:<id>" in rdstudio.toml or ~/.config/rdstudio/config.toml, or pass --by human:<id>');
        return 2;
      }
      for (const ref of concepts) {
        try {
          console.log(`verified ${verify(cfg.knowledgeDir, ref, actor).path} by ${actor}`);
        } catch (err) {
          if (!(err instanceof StoreError)) throw err;
          console.error(err.message);
          return 1;
        }
      }
      return 0;
    },
  },

  procedure: {
    help: "list procedures; show, apply or reject proposed edits",
    usage: "{list,show,apply,reject} [procedure] [proposal]",
    run(cfg, _v, [action, name, proposal]) {
      if (!action || !["list", "show", "apply", "reject"].includes(action)) {
        return usageError("procedure", `argument action: invalid choice: ${pyRepr(action ?? "")} (choose from 'list', 'show', 'apply', 'reject')`);
      }
      const b = bundle(cfg);
      if (action === "list") {
        for (const c of b.concepts.values()) {
          if (!isProcedure(c)) continue;
          const pending = (Array.isArray(c.meta.proposals) ? c.meta.proposals : []).filter((p) => (p as { state?: unknown })?.state === "pending").length;
          const g = graphOf(c);
          console.log(`${c.id}  ${g.nodes.size} steps, ${g.edges.length} transitions` + (pending ? `, ${pending} pending proposal(s)` : ""));
        }
        return 0;
      }
      const cid = b.resolveId(name ?? "") ?? b.resolveId("procedures/" + (name ?? ""));
      if (cid === null) { console.error(`no procedure ${name === undefined ? "None" : pyRepr(name)}`); return 2; }
      if (action === "show") {
        for (const p of (Array.isArray(b.concepts.get(cid)!.meta.proposals) ? b.concepts.get(cid)!.meta.proposals as Record<string, unknown>[] : [])) {
          console.log(`#${pyStr(p.id)} [${pyStr(p.state)}] by ${pyStr(p.by)}: ${pyStr(p.rationale)}`);
          for (const e of (Array.isArray(p.edits) ? p.edits : []) as Record<string, unknown>[]) {
            console.log("    " + Object.entries(e).map(([k, x]) => `${k}=${pyStr(x)}`).join(", "));
          }
        }
        return 0;
      }
      const pid = Number(proposal);
      if (proposal === undefined || !Number.isInteger(pid)) return usageError("procedure", `argument proposal: invalid int value: ${pyRepr(proposal ?? "")}`);
      try {
        const result = resolveProposal(cfg.knowledgeDir, cid, pid, { accept: action === "apply", actor: cfg.human || "human:unknown" });
        console.log(`proposal ${result.proposal} on ${cid}: ${result.state}`);
      } catch (err) {
        if (!(err instanceof ProcedureError)) throw err;
        console.error(err.message);
        return 1;
      }
      return 0;
    },
  },

  refs: {
    help: "papis references: sync stubs, search, read PDF text",
    usage: "{sync,search,text} [terms...] [--pages PAGES]",
    options: { pages: { type: "string" } },
    run(cfg, v, [action, ...terms]) {
      if (!action || !["sync", "search", "text"].includes(action)) {
        return usageError("refs", `argument action: invalid choice: ${pyRepr(action ?? "")} (choose from 'sync', 'search', 'text')`);
      }
      if (!refs.enabled(cfg)) {
        console.error('references are off: add [references] backend = "papis" to rdstudio.toml');
        return 2;
      }
      try {
        if (action === "sync") {
          const created = refs.syncStubs(cfg);
          for (const cid of created) console.log(`created ${cid}`);
          console.log(`${created.length} new reference stubs`);
        } else if (action === "search") {
          for (const hit of refs.search(cfg, terms.join(" "))) console.log(`${String(hit.ref).padEnd(32)} ${String(hit.year).padEnd(5)} ${hit.title}`);
        } else {
          console.log(refs.text(cfg, terms[0] ?? "", { pages: v.pages as string | undefined }));
        }
      } catch (err) {
        if (!(err instanceof refs.ReferenceError)) throw err;
        console.error(err.message);
        return 1;
      }
      return 0;
    },
  },

  global: {
    help: "set up or show the global knowledge base",
    usage: "{init,status} [path] [--human HUMAN]",
    options: { human: { type: "string" } },
    run(cfg, v, [action, path = "~/knowledge"]) {
      if (action !== "init" && action !== "status") {
        return usageError("global", `argument action: invalid choice: ${pyRepr(action ?? "")} (choose from 'init', 'status')`);
      }
      if (action === "init") {
        for (const line of initGlobal(path, v.human as string | undefined)) console.log(line);
        return 0;
      }
      const g = globalConfig(cfg);
      if (!g) { console.log("no global knowledge base; run `rdstudio global init [~/knowledge]`"); return 1; }
      console.log(`global knowledge base: ${g.root} (${bundle(g).concepts.size} concepts)`);
      return 0;
    },
  },

  promote: {
    help: "move a project concept into the global knowledge base",
    usage: "concept [--as ID] [--keep] [--force]",
    options: { as: { type: "string" }, keep: { type: "boolean" }, force: { type: "boolean" } },
    run(cfg, v, [concept]) {
      if (!concept) return usageError("promote", "the following arguments are required: concept");
      let result;
      try {
        result = promote(cfg, concept, { asId: v.as as string | undefined, keep: Boolean(v.keep), force: Boolean(v.force) });
      } catch (err) {
        if (!(err instanceof ScopeError || err instanceof StoreError)) throw err;
        console.error(err.message);
        return 1;
      }
      console.log(`${result.moved ? "moved" : "copied"} ${result.from} to the global knowledge base as ${result.to}`);
      if (result.broken_links_in_global.length) console.log("links that do not resolve in the global base: " + result.broken_links_in_global.join(", "));
      return 0;
    },
  },

  skills: {
    help: "list skills by scope, or move one between project and user scope",
    usage: "{list,to-user,to-project} [name]",
    run(cfg, _v, [action, name]) {
      if (!action || !["list", "to-user", "to-project"].includes(action)) {
        return usageError("skills", `argument action: invalid choice: ${pyRepr(action ?? "")} (choose from 'list', 'to-user', 'to-project')`);
      }
      if (action === "list") {
        for (const [scope, skills] of Object.entries(skillDirs(cfg))) console.log(`${scope}: ${[...skills.keys()].join(", ") || "(none)"}`);
        return 0;
      }
      try {
        console.log(moveSkill(cfg, name ?? "", action === "to-user" ? "user" : "project"));
      } catch (err) {
        if (!(err instanceof ScopeError)) throw err;
        console.error(err.message);
        return 1;
      }
      return 0;
    },
  },

  provider: {
    help: "where the models come from (OpenRouter, or a gateway set in the user config), and a check that it answers",
    usage: "[show|check [model]] [--verbose]",
    options: { verbose: { type: "boolean", short: "v" } },
    run(cfg, v, [action = "show", model]) {
      const p = models.provider();
      if (action === "show" || action === "check") {
        console.log(`user config: ${userConfigPath()}`);
        for (const [k, val] of Object.entries(describeProvider(p))) console.log(`${(k + ":").padEnd(20)} ${val}`);
        console.log(`${"models:".padEnd(20)} tiers ${Object.entries(models.tiers()).map(([t, m]) => `${t}=${m}`).join(", ")}`);
        const unnamed = models.unnamed();
        if (unnamed.length) console.log(`\nStill at rdstudio's own models, which are OpenRouter's names: ${unnamed.join(", ")}.\nSet them as ${p.name} names them, under [teacher.tiers] in the user config:  low = "…"  mid = "…"  max = "…"`);
        if (action === "show") { console.log("\nrdstudio provider check   sends one small request and says what came back (--verbose: what the connection was made with)"); return 0; }
        void providerCheck(cfg, p, model, Boolean(v.verbose)).then((ok) => { if (!ok) process.exitCode = 1; });
        return 0;
      }
      return usageError("provider", `argument action: invalid choice: ${pyRepr(action)} (choose from 'show', 'check')`);
    },
  },

  "__embed": {
    help: "(internal) make the vectors for search by meaning that are missing",
    run(cfg) {
      void embed.refreshAll(cfg).then((r) => { process.stdout.write(`${r.made} of ${r.pieces}\n`); });
      return 0;
    },
  },

  "__index-code": {
    help: "(internal) print the code map's index as JSON, for the build",
    run(cfg) {
      void indexCode(cfg).then((idx) => { process.stdout.write(idx ? JSON.stringify(idx) : ""); });
      return 0;
    },
  },

  build: {
    help: "build the dashboard site",
    run(cfg) {
      console.log(`built ${build(cfg)}`);
      return 0;
    },
  },

  export: {
    help: "write a static snapshot of the dashboard (e.g. for GitHub Pages)",
    usage: "target [--force]",
    options: { force: { type: "boolean" } },
    run(cfg, v, [target]) {
      if (!target) return usageError("export", "the following arguments are required: target");
      const dest = resolve(target);
      if (existsSync(dest) && readdirSync(dest).length && !v.force) {
        console.error(`${dest} is not empty; pass --force to replace it`);
        return 1;
      }
      const tmp = mkdtempSync(join(tmpdir(), "rdstudio-export-"));
      try {
        const site = build(cfg, { writeIndexes: false, export: true, site: join(tmp, "site") });
        writeFileSync(join(site, ".nojekyll"), "");
        rmSync(dest, { recursive: true, force: true });
        cpSync(site, dest, { recursive: true, preserveTimestamps: true });
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
      console.log(`exported a static snapshot to ${dest} (project knowledge only)`);
      return 0;
    },
  },

  serve: {
    help: "serve the dashboard, rebuilding on change",
    usage: "[--host HOST] [--port PORT] [--no-watch] [--allow-host NAME] [--read-only]",
    options: {
      host: { type: "string", default: "127.0.0.1" },
      port: { type: "string", default: "8000" },
      "no-watch": { type: "boolean" },
      "allow-host": { type: "string", multiple: true, default: [] },
      "read-only": { type: "boolean" },
    },
    run(cfg, v) {
      serve(cfg, { host: v.host as string, port: Number(v.port), watch: !v["no-watch"], allowHosts: v["allow-host"] as string[], readOnly: Boolean(v["read-only"]) });
      return 0;
    },
  },

  path: {
    help: "a concept's prerequisites in reading order, or the whole bundle's reading order",
    usage: "[concept]",
    run(cfg, _v, [concept]) {
      const b = bundle(cfg);
      const order = b.prerequisiteOrder();
      let ids: string[];
      if (concept) {
        const cid = b.resolveId(concept);
        if (!cid) { console.error(`no such concept: ${concept}`); return 1; }
        ids = [...b.prerequisites(cid), cid];
      } else {
        ids = [...b.concepts.keys()].sort((a, c) => order.get(a)!.order - order.get(c)!.order);
      }
      ids.forEach((cid, i) => console.log(`${String(i + 1).padStart(3)}. [${order.get(cid)!.depth}] ${cid}  ${b.concepts.get(cid)!.title}`));
      return 0;
    },
  },
};

function usageError(command: string, message: string): number {
  console.error(`usage: rdstudio ${command} ${COMMANDS[command]?.usage ?? ""}`.trimEnd());
  console.error(`rdstudio ${command}: error: ${message}`);
  return 2;
}

function help(): string {
  const names = [...Object.keys(COMMANDS).filter((n) => !n.startsWith("__")), ...PENDING].sort();
  return [
    "usage: rdstudio [-h] [--version] [-C DIRECTORY] <command> ...",
    "",
    "commands:",
    ...Object.entries(COMMANDS).filter(([n]) => !n.startsWith("__")).map(([n, c]) => `  ${n.padEnd(10)} ${c.help}`),
    `  (still in the Python command line: ${PENDING.join(", ")})`,
    "",
    `all: ${names.join(", ")}`,
  ].join("\n");
}

export function main(argv: string[]): number {
  let directory: string | undefined;
  let i = 0;
  for (; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--version") { console.log(`rdstudio ${VERSION}`); return 0; }
    if (a === "-h" || a === "--help") { console.log(help()); return 0; }
    if (a === "-C" || a === "--directory") { directory = argv[++i]; continue; }
    if (a.startsWith("--directory=")) { directory = a.slice(12); continue; }
    break;
  }
  const name = argv[i];
  if (!name) { console.error(help()); return 2; }
  const command = COMMANDS[name];
  if (!command) {
    if (PENDING.includes(name)) {
      console.error(`rdstudio ${name} is not in the Node command line yet; run the Python one (uv run rdstudio ${name}).`);
      return 2;
    }
    console.error(`rdstudio: error: unknown command '${name}'\n\n${help()}`);
    return 2;
  }
  let parsed;
  try {
    parsed = parseArgs({ args: argv.slice(i + 1), options: { help: { type: "boolean", short: "h" }, ...command.options }, allowPositionals: true });
  } catch (err) {
    return usageError(name, (err as Error).message);
  }
  if (parsed.values.help) { console.log(`usage: rdstudio ${name} ${command.usage ?? ""}\n\n${command.help}`); return 0; }
  return command.run(loadConfig(directory), parsed.values as Values, parsed.positionals);
}

if (import.meta.main) {
  const code = main(process.argv.slice(2));
  if (code) process.exitCode = code; // serve keeps running after main returns
}
