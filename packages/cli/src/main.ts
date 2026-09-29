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
import { build } from "./build.ts";
import { serve } from "./serve.ts";
import { brief } from "./brief.ts";
import { runServer } from "./mcp.ts";
import { init } from "./scaffold.ts";
import { ScopeError, globalConfig, initGlobal, moveSkill, promote, skillDirs } from "./scopes.ts";
import { StoreError, verify } from "./store.ts";
import { loadConfig, userConfigPath, type Config } from "./config.ts";
import * as learner from "./learner.ts";
import { resolve as resolveProposal } from "./procedures.ts";
import { PyFloat, pyDumps, pyRepr, pyStr } from "./pyjson.ts";

export const VERSION = "0.1.0";

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
const PENDING = ["refs"];

const COMMANDS: Record<string, Command> = {
  init: {
    help: "scaffold rdstudio into a repository",
    usage: "[path] [--title TITLE] [--human HUMAN] [--force]",
    options: { title: { type: "string" }, human: { type: "string" }, force: { type: "boolean" } },
    run(_cfg, v, [path = "."]) {
      for (const line of init(path, { title: v.title as string | undefined, human: v.human as string | undefined, force: Boolean(v.force) })) console.log(line);
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
      console.log(`${b.concepts.size} concepts, ${errors.length} errors, ${issues.length - errors.length} warnings`);
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
    usage: "[--host HOST] [--port PORT] [--no-watch] [--allow-host NAME]",
    options: {
      host: { type: "string", default: "127.0.0.1" },
      port: { type: "string", default: "8000" },
      "no-watch": { type: "boolean" },
      "allow-host": { type: "string", multiple: true, default: [] },
    },
    run(cfg, v) {
      serve(cfg, { host: v.host as string, port: Number(v.port), watch: !v["no-watch"], allowHosts: v["allow-host"] as string[] });
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
  const names = [...Object.keys(COMMANDS), ...PENDING].sort();
  return [
    "usage: rdstudio [-h] [--version] [-C DIRECTORY] <command> ...",
    "",
    "commands:",
    ...Object.entries(COMMANDS).map(([n, c]) => `  ${n.padEnd(10)} ${c.help}`),
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
