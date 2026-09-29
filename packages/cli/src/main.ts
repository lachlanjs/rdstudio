#!/usr/bin/env node
// The rdstudio command line in Node, replacing src/rdstudio/cli.py command by
// command (see knowledge/tasks/T37-node-cli-mcp-serve.md). Output matches the
// Python command line's, so either can be used while both exist.

import { parseArgs, type ParseArgsConfig } from "node:util";
import { Bundle, SearchIndex, round3 } from "@rdstudio/core";
import { loadBundle, writeIndexes } from "@rdstudio/core/node";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "./build.ts";
import { serve } from "./serve.ts";
import { StoreError, verify } from "./store.ts";
import { loadConfig, userConfigPath, type Config } from "./config.ts";
import * as learner from "./learner.ts";
import { PyFloat, pyDumps } from "./pyjson.ts";

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
const PENDING = ["init", "procedure", "refs", "global", "promote", "skills", "brief", "mcp"];

const COMMANDS: Record<string, Command> = {
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
