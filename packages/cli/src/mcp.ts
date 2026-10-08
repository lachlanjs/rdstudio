// The local stdio MCP server over the project knowledge bundle, on the official
// TypeScript SDK. Tool output is compact text, in the form the first, Python,
// server wrote (removed in T102). read(frontmatter=true) returns the
// frontmatter as it is in the file.

import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  LearnerError, ProcedureError, answerSpec, assignments, attempts, goalProgress, isStudyNote, needsMarking, refIds, RESULTS, SearchIndex, cmp, contentHash, coverage, describe, discoveryStates, dueReviews, reviewSchedule, floatRepr, frontmatterText, graphOf, headings, isProcedure, pyRepr, round3, section,
  text, type Bundle,
} from "@rdstudio/core";
import { loadBundle, writeIndexes } from "@rdstudio/core/node";
import { brief } from "./brief.ts";
import { fromConfig } from "./classifier.ts";
import type { Config } from "./config.ts";
import * as embed from "./embed.ts";
import { propose } from "./procedures.ts";
import * as refs from "./references.ts";
import { PyFloat, pyDumps } from "./pyjson.ts";
import { ScopeError, globalConfig, promote, scoped } from "./scopes.ts";
import { StoreError, conceptPath, record } from "./store.ts";
import * as learner from "./learner.ts";
import * as teacher from "./teacher.ts";
import { Tracer } from "./trace.ts";
import * as inbox from "./inbox.ts";

export const INSTRUCTIONS = `Project knowledge base (OKF markdown bundle). Retrieve progressively:
search -> outline -> read(section). Prefer reading one section over a whole
concept. Before recording, search for an existing concept to update rather
than creating a duplicate. Record decisions, answered questions, findings and
procedures as they happen. Mark an edit significant=false only for trivial or
dictated changes; significant edits flag human-reviewed concepts for re-review.
Never claim human verification; only humans verify (rdstudio verify).`;

/** The tools whose trace names a note by its title, and so needs the base. */
const TRACED_NOTES = new Set(["outline", "read", "backlinks", "study_path", "record", "procedure_next", "procedure_propose"]);

/** Tool output: JSON as the Python server writes it (indent 1, not ASCII-escaped). */
const fmt = (value: unknown): string => pyDumps(value, { indent: 1, ensureAscii: false });
const reply = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const opt = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export function createServer(cfg: Config, version: string): McpServer {
  const server = new McpServer({ name: "rdstudio", version }, { instructions: INSTRUCTIONS });
  const classifier = fromConfig(cfg.raw);
  // What each call touched is kept for the Atlas to draw (T107): the base as the call saw it is remembered for that.
  let seen: Bundle | null = null;
  const bundle = (): Bundle => (seen = loadBundle(cfg.knowledgeDir));
  const tracer = new Tracer(cfg, () => { const c = server.server.getClientVersion(); return c ? `${c.name}${c.version ? ` ${c.version}` : ""}` : "an agent"; });

  /** Resolve "id" (project) or "global:id" (global knowledge base). */
  const locate = (ref: string): { bundle: Bundle; cid: string | null } => {
    if (ref.startsWith("global:")) {
      const g = globalConfig(cfg);
      if (!g) throw new ScopeError("no global knowledge base");
      const b = loadBundle(g.knowledgeDir);
      return { bundle: b, cid: b.resolveId(ref.slice(7)) };
    }
    const b = bundle();
    return { bundle: b, cid: b.resolveId(ref) };
  };
  const tool = <S extends z.ZodRawShape>(name: string, description: string, shape: S, run: (args: z.infer<z.ZodObject<S>>) => string) =>
    server.registerTool(name, { description, inputSchema: shape }, ((args: z.infer<z.ZodObject<S>>) => {
      seen = null;
      const out = run(args);
      // The base is loaded for the trace where the call did not load it, and only for the tools that name a note.
      tracer.call(name, args as Record<string, unknown>, out, seen ?? (TRACED_NOTES.has(name) ? loadBundle(cfg.knowledgeDir) : null));
      return reply(out);
    }) as never);

  tool("brief", `A short orientation to the project knowledge base: what exists, active
tasks, what awaits the developer and recent commits. Call it at the start
of a session unless one was already provided.`, {}, () => brief(cfg));

  tool("from_developer", `What the developer has sent you from the app: a message, with the note or
folder they were on and any passage they marked. Each is given once. Call it
when the brief says something waits, and again when the developer says they
have sent something. They send on purpose; nothing else of what they do in
the app is seen here.`, {}, () => {
    const who = server.server.getClientVersion();
    return inbox.told(inbox.take(cfg, who ? `${who.name}${who.version ? ` ${who.version}` : ""}` : cfg.agent), bundle());
  });

  // Search by meaning (T89), where the model for it is installed: second to the keyword search.
  if (embed.available()) server.registerTool("find_similar", { description: `Find concepts by meaning: ones that say something like the text given, even
in quite other words. Runs a small model on this machine; nothing is sent
anywhere. Use it after search and the links of the concepts in hand have not
found what is needed. Give a question or a sentence, not keywords. Returns
each concept's nearest section and how alike it is (0 to 1); read before
relying on one. Project knowledge base only.`, inputSchema: { text: z.string(), under: opt(z.string()), limit: z.number().int().default(6) } },
    (async ({ text, under, limit }: { text: string; under?: string | null; limit: number }) => {
      const b = bundle();
      const found = await embed.similar(cfg, b, text, { limit, under: under ?? undefined });
      if (!found.ready) return reply("Search by meaning is still being prepared for this knowledge base (the first time takes a minute or two). Use search for now.");
      const out = JSON.stringify({ results: found.hits.map((h) => { const c = b.concepts.get(h.note)!; return { id: h.note, title: c.title, type: c.type, description: c.description, section: h.heading, alike: Number(h.score.toFixed(3)), snippet: h.body.replace(/\s+/g, " ").slice(0, 200) }; }),
        ...(found.pending ? { pending: `${found.pending} sections changed lately are not searched by meaning yet` } : {}) }, null, 1);
      tracer.call("find_similar", { text, under }, out, null);
      return reply(out);
    }) as never);

  tool("search", `Keyword (BM25) search over the knowledge base. Returns concept ids, titles,
descriptions and a one-line snippet. Filter by concept type (e.g. "Decision"),
tags (all must match) or a directory prefix (e.g. "design"). scope: "project"
(default), "global" (the developer's cross-project knowledge base) or "all";
global ids are prefixed "global:".`, {
    query: z.string(), type: opt(z.string()), tags: opt(z.array(z.string())), under: opt(z.string()),
    limit: z.number().int().default(8), scope: z.string().default("project"),
  }, ({ query, type, tags, under, limit, scope }) => {
    let targets: [string, Config][];
    try { targets = scoped(cfg, scope); } catch (err) { if (err instanceof ScopeError) return err.message; throw err; }
    const n = Math.max(1, Math.min(limit, 25));
    const results: { score: number; [k: string]: unknown }[] = [];
    for (const [name, c] of targets) {
      for (const h of new SearchIndex(loadBundle(c.knowledgeDir)).search(query, { limit: n, type: type ?? undefined, tags: tags ?? undefined, under: under ?? undefined })) {
        results.push({
          id: (name === "global" ? "global:" : "") + h.concept.id, title: h.concept.title, type: h.concept.type,
          description: h.concept.description, trust: h.concept.trust, score: round3(h.score), snippet: h.snippet,
        });
      }
    }
    results.sort((a, b) => b.score - a.score);
    if (!results.length) return "No matches. Try other words, drop filters, or list a directory.";
    return fmt(results.slice(0, n).map((r) => ({ ...r, score: new PyFloat(r.score) })));
  });

  tool("outline", `Metadata and heading outline of one concept, without its body. Use it to
decide which section to read. Prefix the id with "global:" for the global base.`, { id: z.string() }, ({ id }) => {
    let found;
    try { found = locate(id); } catch (err) { if (err instanceof ScopeError) return err.message; throw err; }
    const { bundle: b, cid } = found;
    if (cid === null) return `No concept ${pyRepr(id)}.`;
    const c = b.concepts.get(cid)!;
    return fmt({
      id: c.id, title: c.title, type: c.type, description: c.description, tags: c.tags, status: c.status, trust: c.trust,
      verification_stale: c.verificationStale,
      generated: c.meta.generated ?? null,
      chars: [...c.body].length,
      headings: headings(c.body).map((h) => "#".repeat(h.level) + " " + h.text),
      links_to: [...new Set(c.links.filter((l) => !l.broken).map((l) => l.target))].sort(cmp),
      linked_from: b.backlinks(cid),
    });
  });

  tool("read", `Read a concept's body, or only the section under one heading (matched by
text, case-insensitive). Set frontmatter=true to include the YAML metadata.
Prefix the id with "global:" for the global base.`, {
    id: z.string(), section_heading: opt(z.string()), frontmatter: z.boolean().default(false),
  }, ({ id, section_heading, frontmatter }) => {
    let found;
    try { found = locate(id); } catch (err) { if (err instanceof ScopeError) return err.message; throw err; }
    const { bundle: b, cid } = found;
    if (cid === null) return `No concept ${pyRepr(id)}.`;
    const c = b.concepts.get(cid)!;
    let body = c.body;
    if (section_heading) {
      const s = section(c.body, section_heading);
      if (s === null) return `No section ${pyRepr(section_heading)} in ${cid}. Headings: ${headings(c.body).map((h) => h.text).join(", ") || "none"}.`;
      body = s;
    }
    if (frontmatter) {
      const root = id.startsWith("global:") ? globalConfig(cfg)!.knowledgeDir : cfg.knowledgeDir;
      const [raw] = frontmatterText(readFileSync(conceptPath(root, cid), "utf8").replace(/\r\n?/g, "\n"));
      return `---\n${raw ?? ""}---\n\n${body}`;
    }
    return section_heading ? body : `# ${c.title} (${cid})\n\n${body}`;
  });

  tool("list_concepts", `List a directory of the knowledge base: its concepts (id, type, title,
description) and subdirectories. Use "" for the root. scope: "project" or
"global".`, { directory: z.string().default(""), scope: z.string().default("project") }, ({ directory, scope }) => {
    let b: Bundle;
    try { b = scope === "global" ? loadBundle(scoped(cfg, scope).at(-1)![1].knowledgeDir) : bundle(); } catch (err) {
      if (err instanceof ScopeError) return err.message;
      throw err;
    }
    const d = b.directories.get(directory.replace(/^\/+|\/+$/g, ""));
    if (!d) return `No directory ${pyRepr(directory)}. Top level: ${pyRepr([...b.directories.get("")!.children].sort(cmp))}`;
    return fmt({
      directory: d.id,
      subdirectories: [...d.children].sort(cmp),
      concepts: [...d.concepts].sort(cmp).map((cid) => {
        const c = b.concepts.get(cid)!;
        return { id: cid, type: c.type, title: c.title, description: c.description };
      }),
    });
  });

  tool("record", `Create or update a concept at \`id\` (path without .md, e.g.
"decisions/activation-function"). New concepts need \`type\`, and should have a
title and one-sentence description. \`body\` replaces the whole body, or only the
section under \`section_heading\`; \`append\` adds to the end. Existing frontmatter
is preserved; \`meta\` sets extra keys (null deletes). Links between concepts use
bundle-absolute paths like [text](/design/model.md). \`significant\`: true for a
meaningful change, false for trivial or dictated edits (keeps provenance and
review state), or omit it to let rdstudio judge from the change. scope="global"
writes to the developer's global knowledge base: only for knowledge that is
not specific to this project, and only when the developer asked for it.`, {
    id: z.string(), type: opt(z.string()), title: opt(z.string()), description: opt(z.string()), tags: opt(z.array(z.string())),
    body: opt(z.string()), section_heading: opt(z.string()), append: opt(z.string()), significant: opt(z.boolean()),
    meta: opt(z.record(z.string(), z.unknown())), actor: opt(z.string()), scope: z.string().default("project"),
  }, (a) => {
    const updates: Record<string, unknown> = { ...(a.meta ?? {}) };
    for (const key of ["type", "title", "description", "tags"] as const) if (a[key] !== null && a[key] !== undefined) updates[key] = a[key];
    let target: Config, result;
    try {
      target = a.scope === "project" ? cfg : scoped(cfg, "global")[0]![1];
      result = record(target.knowledgeDir, a.id.replace(/^global:/, ""), {
        actor: a.actor || cfg.agent, body: a.body ?? null, meta: updates, section: a.section_heading ?? null, append: a.append ?? null,
        significant: a.significant ?? null, classifier,
      });
    } catch (err) {
      if (err instanceof StoreError || err instanceof ScopeError) return `Not recorded: ${err.message}`;
      throw err;
    }
    const b = loadBundle(target.knowledgeDir);
    if (target === cfg) seen = b; // for the trace, which names the note by its title
    writeIndexes(b, target.knowledgeDir);
    const issues = b.lint().filter((i) => i.path === result.path).map((i) => `${i.level}: ${i.message}`);
    // An Exercise note's answer settings, which the dashboard needs to check answers.
    const written = [...b.concepts.values()].find((c) => c.path === result.path);
    if (written?.type === "Exercise") {
      const spec = answerSpec(written.meta);
      if ("error" in spec) issues.push(`warning: answer: ${spec.error}`);
      if (!/^#{1,6}\s+(?:worked\s+)?solutions?\s*$/im.test(written.body)) issues.push("warning: an Exercise note should end with a Solution section (a heading named Solution)");
    }
    return fmt(issues.length ? { ...result, issues } : result);
  });

  tool("backlinks", "Concepts that link to the given concept.", { id: z.string() }, ({ id }) => {
    const b = bundle();
    const cid = b.resolveId(id);
    if (cid === null) return `No concept ${pyRepr(id)}.`;
    return fmt(b.backlinks(cid).map((x) => ({ id: x, title: b.concepts.get(x)!.title })));
  });

  tool("study_path", `What to read before a concept: everything it requires (links titled
"requires"), directly or through a chain, in reading order. \`\`depth\`\` is the
longest chain of prerequisites below each concept.`, { id: z.string() }, ({ id }) => {
    const b = bundle();
    const cid = b.resolveId(id);
    if (cid === null) return `No concept ${pyRepr(id)}.`;
    const order = b.prerequisiteOrder();
    return fmt([...b.prerequisites(cid), cid].map((x) => ({ id: x, title: b.concepts.get(x)!.title, depth: order.get(x)!.depth })));
  });

  tool("review_queue", `What needs human attention: concepts changed since human review, open
questions, unverified concepts, and format errors.`, { limit: z.number().int().default(10) }, ({ limit }) => {
    const b = bundle();
    const cs = [...b.concepts.values()];
    const short = (c: (typeof cs)[number]) => ({ id: c.id, title: c.title, type: c.type });
    const cut = <T>(xs: T[]) => xs.slice(0, limit); // as Python's [:limit]
    return fmt({
      changed_since_review: cut(cs.filter((c) => c.verificationStale).map(short)),
      open_questions: cut(cs.filter((c) => c.type.toLowerCase() === "question" && !c.tags.includes("answered")).map(short)),
      unverified_count: cs.filter((c) => c.trust === "unverified").length,
      errors: cut(b.lint().filter((i) => i.level === "error").map((i) => `${i.path}: ${i.message}`)),
    });
  });

  tool("procedure_next", `Guidance for a recorded procedure (type: Procedure). Give the step you just
completed (node id or label); returns the steps reachable within \`hops\`
transitions, with each transition's condition, guidance and pitfalls. With no
step, starts at the beginning. Use it to follow a procedure step by step
without loading the whole graph.`, { procedure: z.string(), step: opt(z.string()), hops: z.number().int().default(2) }, ({ procedure, step, hops }) => {
    const b = bundle();
    const cid = b.resolveId(procedure) ?? b.resolveId("procedures/" + procedure);
    if (cid === null || !isProcedure(b.concepts.get(cid)!)) {
      const names = [...b.concepts.values()].filter(isProcedure).map((c) => c.id);
      return `No procedure ${pyRepr(procedure)}. Procedures: ${names.length ? pyRepr(names) : "none recorded"}.`;
    }
    const c = b.concepts.get(cid)!;
    const graph = graphOf(c);
    let node = graph.match(step);
    let matchedBy = "exact";
    if (node === null && step) {
      const steps = Object.fromEntries([...graph.nodes].map(([nid, attrs]) => [nid, text(attrs.label ?? nid)]));
      const d = classifier.choose("procedure_step", Object.keys(steps), { description: step, steps });
      node = d.choice;
      matchedBy = `${d.backend} (confidence ${floatRepr(d.confidence)})`; // a float in Python, so 1.0, not 1
    }
    if (node === null) {
      return fmt({ ...describe(c, graph, null), note: `Step ${pyRepr(step)} is not in this procedure; showing the whole graph.` });
    }
    const out = describe(c, graph.neighbourhood(node, Math.max(1, Math.min(hops, 4))), node);
    return fmt(matchedBy === "exact" ? out : { ...out, matched_by: matchedBy });
  });

  tool("procedure_propose", `Propose changes to a procedure's graph for the developer to accept or reject.
Each edit: {"op": add_node|update_node|delete_node|add_edge|update_edge|delete_edge,
...}. Nodes take id and label; edges take from, to, relation (LEADS_TO, TRIGGERS,
PROVIDES_INPUT_FOR, CONVERGES_TO) and condition, guidance, pitfalls. Explain
in \`rationale\` what went wrong or right that motivates the change. Check the
procedure's rejected proposals first (read it with frontmatter=true) and do not
repeat them.`, { procedure: z.string(), edits: z.array(z.record(z.string(), z.unknown())), rationale: z.string(), actor: opt(z.string()) },
  ({ procedure, edits, rationale, actor }) => {
    const b = bundle();
    const cid = b.resolveId(procedure) ?? b.resolveId("procedures/" + procedure);
    if (cid === null) return `No procedure ${pyRepr(procedure)}.`;
    try {
      return fmt(propose(cfg.knowledgeDir, cid, { edits, rationale, actor: actor || cfg.agent }));
    } catch (err) {
      if (err instanceof ProcedureError || err instanceof StoreError) return `Not proposed: ${err.message}`;
      throw err;
    }
  });

  // ---------------------------------------------------------------- learner
  // The developer's private learner record (understanding-layer.md): read to
  // tailor help, written only to set explain-back questions and to mark
  // answers. Off unless [learner] enabled = true in the user config.
  const LEARNER_OFF = "The learner record is off. The developer turns it on with [learner] enabled = true in ~/.config/rdstudio/config.toml.";
  const notesOf = (b: Bundle) => [...b.concepts.values()].filter(isStudyNote).map((c) => ({ id: c.id, hash: contentHash(c.body) }));
  const unmarked = (events: Record<string, unknown>[]) => {
    const marked = new Set(events.filter((e) => e.event === "explain_marked").map((e) => e.ref));
    return events.filter((e) => e.event === "explain" && !marked.has(e.id));
  };

  const requiresOf = (b: Bundle, id: string): string[] => b.requiresGraph().get(id) ?? [];
  /** Exercise notes, with the notes they test and the goals they serve. */
  const exercisesOf = (b: Bundle) => [...b.concepts.values()].filter((c) => c.type === "Exercise").map((c) => {
    const dir = c.id.includes("/") ? c.id.slice(0, c.id.lastIndexOf("/")) : "";
    return { id: c.id, title: c.title, tests: refIds(c.meta.tests, dir).filter((t) => b.concepts.has(t)), goals: refIds(c.meta.goals, dir) };
  });

  tool("learner_state", `Where the developer stands with the project's knowledge, from their private
learner record: with an id, that note's state (undiscovered, discovered,
processed, understood; changed if the note changed meaningfully since),
review and recent activity; without, counts by state per top-level folder,
reviews due and explain-back answers waiting. Use it to aim explanations and
questions. Never quote it to anyone else.`, { id: opt(z.string()) }, ({ id }) => {
    if (!learner.enabled(cfg)) return LEARNER_OFF;
    const b = bundle(), events = learner.events(cfg), notes = notesOf(b);
    const states = discoveryStates(events, notes);
    const schedule = reviewSchedule(events, notes);
    if (id) {
      const cid = b.resolveId(id);
      if (cid === null) return `No concept ${pyRepr(id)}.`;
      const s = states.get(cid)!, r = schedule.get(cid);
      const recent = events.filter((e) => e.concept === cid).slice(-6)
        .map((e) => ({ id: e.id, event: e.event, at: e.at, ...(e.result ? { result: e.result } : {}), ...(e.state ? { state: e.state } : {}) }));
      return fmt({ id: cid, title: b.concepts.get(cid)!.title, state: s.state, changed: s.changed, by: s.kind,
        review: r ? { box: r.box, due: new Date(r.due).toISOString() } : null, recent });
    }
    const groups = new Map<string, string[]>();
    for (const n of notes) {
      const top = n.id.includes("/") ? n.id.slice(0, n.id.indexOf("/")) : "(top level)";
      groups.set(top, [...(groups.get(top) ?? []), n.id]);
    }
    const byFolder = Object.fromEntries([...groups].sort(([a], [z]) => cmp(a, z)).map(([f, ids]) => [f, coverage(states, ids)]));
    const { due, more } = dueReviews(schedule, Date.now());
    const tried = attempts(events);
    const goals = [...b.concepts.values()].filter((c) => c.type === "Goal").sort((x, y) => cmp(x.id, y.id)).map((g) => {
      const p = goalProgress(requiresOf(b, g.id), (id) => requiresOf(b, id), exercisesOf(b).filter((e) => e.goals.includes(g.id)).map((e) => e.id), states, tried);
      return { id: g.id, title: g.title, met: p.met, exercises: Object.fromEntries(p.exercises.map((e) => [e.id, e.status])), notes: p.coverage };
    });
    const exerciseWaiting = [...tried.values()].flat().filter(needsMarking).length;
    const open = assignments(events, tried).filter((a) => !a.closed)
      .map((a) => ({ ref: a.id, note: a.note, at: a.at, to_do: a.exercises.filter((x) => !a.done.includes(x)), done: a.done }));
    return fmt({ by_folder: byFolder, due: due.map((r) => r.id), more_due: more, explain_waiting: unmarked(events).length,
      ...(goals.length ? { goals } : {}), exercises_waiting: exerciseWaiting, ...(open.length ? { set_for_developer: open } : {}) });
  });

  tool("explain_question", `Set an explain-back question on a note for the developer to answer in their own
words, in the dashboard or here. Ask about meaning, reasons and connections
(why, what would break without it, how it relates to a neighbour), not for
recall of wording. One question per call.`, { id: z.string(), question: z.string(), actor: opt(z.string()) }, ({ id, question, actor }) => {
    if (!learner.enabled(cfg)) return LEARNER_OFF;
    const b = bundle(), cid = b.resolveId(id);
    if (cid === null) return `No concept ${pyRepr(id)}.`;
    if (!question.trim()) return "A question is needed.";
    const e = learner.append(cfg, { event: "question", concept: cid, hash: contentHash(b.concepts.get(cid)!.body), question: question.trim(), kind: "ai", by: actor || cfg.agent });
    return fmt({ question: e.id, concept: cid });
  });

  tool("explain_pending", `Explain-back answers the developer wrote that wait for marking: each with its
ref, the note, the question and the answer. Read the note (and its sources)
before marking with explain_mark.`, { limit: z.number().int().default(10) }, ({ limit }) => {
    if (!learner.enabled(cfg)) return LEARNER_OFF;
    const b = bundle();
    const waiting = unmarked(learner.events(cfg)).slice(0, Math.max(1, Math.min(limit, 50)));
    if (!waiting.length) return "No explain-back answers are waiting.";
    return fmt(waiting.map((e) => {
      const c = typeof e.concept === "string" ? b.concepts.get(e.concept) : undefined;
      return { ref: e.id, concept: e.concept, title: c?.title ?? null, question: e.question ?? null, answer: e.answer, at: e.at,
        note_changed_since: c ? contentHash(c.body) !== e.hash : null };
    }));
  });

  tool("explain_record", `Record an explain-back answer the developer gave in this conversation (their
words, unedited), so it can be marked with explain_mark like one written in
the dashboard. Returns its ref.`, { id: z.string(), answer: z.string(), question: opt(z.string()) }, ({ id, answer, question }) => {
    if (!learner.enabled(cfg)) return LEARNER_OFF;
    const b = bundle(), cid = b.resolveId(id);
    if (cid === null) return `No concept ${pyRepr(id)}.`;
    if (!answer.trim()) return "An answer is needed.";
    const e = learner.append(cfg, { event: "explain", concept: cid, hash: contentHash(b.concepts.get(cid)!.body), ...(question ? { question } : {}),
      answer: answer.trim(), kind: "ai", via: "harness" });
    return fmt({ ref: e.id, concept: cid });
  });

  tool("explain_mark", `Mark an explain-back answer (ref from explain_pending) against the note and its
sources: result "got" (right in substance, own words), "partly" (right but
missing or blurring something that matters) or "missed". feedback: two to
four sentences to the developer, naming what was right and what was missing
or wrong, without rewriting their answer for them. gaps: the missing or
mistaken points, briefly. A "got" counts as evidence the note is understood.`, {
    ref: z.string(), result: z.enum(RESULTS), feedback: z.string(), gaps: opt(z.array(z.string())), actor: opt(z.string()),
  }, ({ ref, result, feedback, gaps, actor }) => {
    if (!learner.enabled(cfg)) return LEARNER_OFF;
    const events = learner.events(cfg);
    const answer = events.find((e) => e.id === ref && e.event === "explain");
    if (!answer) return `No explain-back answer ${pyRepr(ref)}.`;
    if (!unmarked(events).includes(answer)) return `${ref} is already marked.`;
    if (!feedback.trim()) return "Feedback is needed: what was right, and what was missing.";
    const e = learner.append(cfg, { event: "explain_marked", ref, concept: answer.concept, hash: answer.hash, result, feedback: feedback.trim(),
      ...(gaps?.length ? { gaps } : {}), kind: "ai", by: actor || cfg.agent });
    return fmt({ marked: ref, result, event: e.id });
  });

  /** The help an answer had while it was written (work together), for its marker. */
  const helpWith = (attempt: string) => {
    const turns = (teacher.submittedDraft(cfg, attempt)?.turns ?? []) as { mode: string; rung?: number | null; prompt?: string | null; reply?: string }[];
    if (!turns.length) return {};
    const count = (m: string) => turns.filter((t) => t.mode === m).length;
    return { help: { hint: count("hint"), feedback: count("feedback"), discuss: count("discuss") },
      session: turns.map((t) => ({ mode: t.mode, ...(t.rung ? { rung: t.rung } : {}), ...(t.prompt ? { asked: t.prompt } : {}), reply: t.reply })) };
  };

  tool("exercise_pending", `Answers to Exercise notes that wait for marking: written answers the developer
left for an agent, and answers checked in the dashboard whose working they
sent for review (\`checked\` says what the check found; \`working\` is theirs).
Each has its ref, the exercise and the notes it tests; an answer written with
the teacher alongside has \`help\` (hints, feedback and discussions asked for)
and the \`session\` itself. Read the exercise (its
Solution section) and the notes before marking with exercise_mark.`, { limit: z.number().int().default(10) }, ({ limit }) => {
    if (!learner.enabled(cfg)) return LEARNER_OFF;
    const b = bundle();
    const waiting = [...attempts(learner.events(cfg)).values()].flat().filter(needsMarking)
      .sort((x, y) => cmp(x.at, y.at)).slice(0, Math.max(1, Math.min(limit, 50)));
    if (!waiting.length) return "No exercise answers are waiting.";
    const raw = new Map(learner.events(cfg).filter((e) => e.event === "attempt").map((e) => [e.id, e]));
    return fmt(waiting.map((a) => {
      const e = raw.get(a.id)!;
      const tests = Array.isArray(e.tests) ? (e.tests as string[]) : [];
      const hashes = (e.hashes ?? {}) as Record<string, string>;
      return { ref: a.id, exercise: a.exercise, title: b.concepts.get(a.exercise)?.title ?? null, tests, answer: a.answer,
        ...(a.working ? { working: a.working } : {}), ...(a.result !== null ? { review: "working", checked: a.checked ?? a.result } : {}), at: a.at,
        ...helpWith(a.id),
        notes_changed_since: tests.filter((t) => b.concepts.has(t) && hashes[t] !== contentHash(b.concepts.get(t)!.body)) };
    }));
  });

  tool("exercise_record", `Record the developer's answer to an Exercise note given in this conversation
(their words or working, unedited), so it can be marked with exercise_mark.
Returns its ref. For a choice or value exercise, mark it straight after.
\`working\`: the steps they showed, if any.`, { id: z.string(), answer: z.string(), working: opt(z.string()) }, ({ id, answer, working }) => {
    if (!learner.enabled(cfg)) return LEARNER_OFF;
    const b = bundle(), cid = b.resolveId(id);
    if (cid === null) return `No concept ${pyRepr(id)}.`;
    if (b.concepts.get(cid)!.type !== "Exercise") return `${cid} is not an Exercise note (type: Exercise).`;
    if (!answer.trim()) return "An answer is needed.";
    const ex = exercisesOf(b).find((e) => e.id === cid)!;
    const e = learner.append(cfg, { event: "attempt", exercise: cid, tests: ex.tests,
      hashes: Object.fromEntries(ex.tests.map((t) => [t, contentHash(b.concepts.get(t)!.body)])), answer: answer.trim(), ...(working?.trim() ? { working: working.trim() } : {}), kind: "ai", via: "harness" });
    return fmt({ ref: e.id, exercise: cid, tests: ex.tests });
  });

  tool("exercise_assign", `Set Exercise notes for the developer to answer in the dashboard, where they
appear at the top of the Learn tab under "Set for you", with \`note\` saying
what the set is for (such as "Diagnostic: prerequisites for the cavity
method"). Prefer this to quizzing in the conversation. Choice and value
answers are checked there; text answers come back through exercise_pending.
learner_state shows each open set's progress.`, { ids: z.array(z.string()), note: z.string(), actor: opt(z.string()) }, ({ ids, note, actor }) => {
    if (!learner.enabled(cfg)) return LEARNER_OFF;
    const b = bundle();
    const out: string[] = [];
    for (const id of ids) {
      const cid = b.resolveId(id);
      if (cid === null) return `No concept ${pyRepr(id)}.`;
      if (b.concepts.get(cid)!.type !== "Exercise") return `${cid} is not an Exercise note (type: Exercise).`;
      if (!out.includes(cid)) out.push(cid);
    }
    if (!out.length) return "Name at least one exercise.";
    if (!note.trim()) return "A note is needed: what the set is for.";
    const e = learner.append(cfg, { event: "assigned", exercises: out, note: note.trim(), kind: "ai", by: actor || cfg.agent });
    return fmt({ ref: e.id, exercises: out });
  });

  tool("exercise_mark", `Mark an answer to an Exercise note (ref from exercise_pending or
exercise_record) against its Solution section and the notes it tests: result
"got" (right in substance), "partly" (right but missing or wrong in something
that matters) or "missed". feedback: two to four sentences to the developer,
naming what was right and what was missing or wrong, and why it matters,
without writing the solution out for them again. gaps: the missing or
mistaken points, briefly. A "got" counts as evidence for every note it tests.
For working sent for review, mark the whole: a slip in a sound method is
"partly" even though the checked answer was wrong; a right answer without a
sound argument is "partly" even though the check passed. Your marking
replaces the check.`, {
    ref: z.string(), result: z.enum(RESULTS), feedback: z.string(), gaps: opt(z.array(z.string())), actor: opt(z.string()),
  }, ({ ref, result, feedback, gaps, actor }) => {
    if (!learner.enabled(cfg)) return LEARNER_OFF;
    const events = learner.events(cfg);
    const answer = events.find((e) => e.id === ref && e.event === "attempt");
    if (!answer) return `No exercise answer ${pyRepr(ref)}.`;
    const settled = [...attempts(events).values()].flat().find((a) => a.id === ref);
    if (settled && !needsMarking(settled)) return `${ref} is already marked (${settled.result}, ${settled.by}).`;
    if (!feedback.trim()) return "Feedback is needed: what was right, and what was missing.";
    const e = learner.append(cfg, { event: "attempt_marked", ref, exercise: answer.exercise, result, feedback: feedback.trim(),
      ...(gaps?.length ? { gaps } : {}), kind: "ai", by: actor || cfg.agent });
    return fmt({ marked: ref, result, event: e.id });
  });

  tool("teacher_skills", `The teaching skills: how to assess, map, source, set exercises, plan and
review for the developer's learning. Lists each with its description,
whether the developer customised it, and the teacher's profile (topic,
codebase or project). Read "teach" with teacher_skill first.`, {}, () => {
    const p = teacher.profile(cfg);
    return fmt({ profile: p.profile, profile_set: p.set, record: learner.enabled(cfg) ? "on" : "off",
      skills: teacher.skills(cfg).map((s) => ({ name: s.name, description: s.description, status: s.status })) });
  });

  tool("teacher_skill", `Read one teaching skill, as the developer has it (customised or rdstudio's
default), with the profile. Follow it.`, { name: z.string() }, ({ name }) => {
    try {
      return teacher.skillForAgent(cfg, name);
    } catch (err) {
      if (err instanceof LearnerError) return err.message;
      throw err;
    }
  });

  tool("teacher_read", `Read one of the teacher's private files about the developer: "profile.md"
(what they find easy and hard, how they learn, what to retest; each claim
citing evidence as [e:<event id>]), "sources.md" (the research log: what was
searched, found, chosen or rejected and why) or "next.md" (the next step,
shown on the developer's Today). Gives its recent history; with
developer_edit=true, the developer's own latest edit as a diff, to answer
(they may dispute a claim). Never quote these to anyone else.`, { name: z.string(), developer_edit: z.boolean().default(false) }, ({ name, developer_edit }) => {
    if (!learner.enabled(cfg)) return LEARNER_OFF;
    try {
      const f = teacher.readFile(cfg, name);
      const edited = f.history.find((h) => h.message === `${f.name}: ${teacher.BY_DEVELOPER}`);
      const head = `${f.name}: ${f.text === null ? "not written yet" : `${f.text.length} characters`}. ` +
        `History: ${f.history.length ? f.history.slice(0, 5).map((h) => `${h.at.slice(0, 16)} ${h.message}`).join("; ") : "none"}.` +
        (edited && !developer_edit ? ` The developer edited it on ${edited.at.slice(0, 10)}: read that with developer_edit=true.` : "");
      if (developer_edit) {
        const d = teacher.developerEdit(cfg, f.name);
        return `${head}\n\n${d ? `The developer's edit of ${d.at}:\n${d.diff}` : "The developer has not edited it."}`;
      }
      return f.text === null ? head : `${head}\n\n${f.text}`;
    } catch (err) {
      if (err instanceof LearnerError) return err.message;
      throw err;
    }
  });

  tool("teacher_write", `Write one of the teacher's private files ("profile.md", "sources.md" or
"next.md"), replacing it whole: read it first, and keep what still holds.
next.md is the one next step, shown on the developer's Today: a sentence or
two, with links, and optional frontmatter \`about\` (the exercise or note id it
concerns, so it is pinned beside that row) and \`pen\` (red, green or blue). In the profile,
every claim cites the events behind it as [e:<event id>] (from learner_events);
a claim without evidence is not written. Each write is kept in the teacher's
history, with \`message\` saying what changed.`, { name: z.string(), text: z.string(), message: opt(z.string()), actor: opt(z.string()) }, ({ name, text, message, actor }) => {
    if (!learner.enabled(cfg)) return LEARNER_OFF;
    if (!text.trim()) return "Text is needed.";
    try {
      const f = teacher.writeFile(cfg, name, text, (message?.trim() || "updated") + ` (${actor || cfg.agent})`);
      return fmt({ written: f.name, characters: f.text?.length ?? 0 });
    } catch (err) {
      if (err instanceof LearnerError) return err.message;
      throw err;
    }
  });

  tool("learner_events", `The developer's learner record as evidence, newest first, each with its id
(cite one as [e:<id>] in the profile): what they opened, marked, practised,
explained and answered, with results and feedback. Filter by note or
exercise id (\`about\`), event names (\`events\`, such as attempt, attempt_marked,
exercise, explain_marked, mark) and \`since\` (an ISO date).`, {
    about: opt(z.string()), events: opt(z.array(z.string())), since: opt(z.string()), limit: z.number().int().default(40),
  }, ({ about, events: names, since, limit }) => {
    if (!learner.enabled(cfg)) return LEARNER_OFF;
    const b = bundle();
    const id = about ? b.resolveId(about) ?? about : null;
    const all = learner.events(cfg);
    const attemptsById = new Map(all.filter((e) => e.event === "attempt").map((e) => [e.id, e]));
    const touches = (e: Record<string, unknown>): boolean => {
      if (id === null) return true;
      if (e.concept === id || e.exercise === id) return true;
      const a = e.event === "attempt" ? e : e.event === "attempt_marked" ? attemptsById.get(e.ref as string) : undefined;
      return Array.isArray(a?.tests) && (a!.tests as string[]).includes(id);
    };
    const out = all.filter((e) => touches(e) && (!names?.length || names.includes(String(e.event))) && (!since || String(e.at) >= since))
      .slice(-Math.max(1, Math.min(limit, 200))).reverse()
      .map(({ device: _d, hash: _h, hashes: _hs, ...rest }) => {
        const c = typeof rest.concept === "string" ? b.concepts.get(rest.concept) : typeof rest.exercise === "string" ? b.concepts.get(rest.exercise) : undefined;
        return c ? { ...rest, title: c.title } : rest;
      });
    return out.length ? fmt(out) : "No events match.";
  });

  tool("promote", `Move a project concept into the developer's global knowledge base (for
knowledge that applies beyond this project). Only do this when the developer
has agreed. keep=true copies instead of moving. Refuses to move a concept other
project concepts link to unless keep=true.`, { id: z.string(), as_id: opt(z.string()), keep: z.boolean().default(false) }, ({ id, as_id, keep }) => {
    try {
      return fmt(promote(cfg, id, { asId: as_id ?? undefined, keep }));
    } catch (err) {
      if (err instanceof ScopeError || err instanceof StoreError) return `Not promoted: ${err.message}`;
      throw err;
    }
  });

  if (refs.enabled(cfg)) {
    tool("ref_search", `Search the bibliography (papis library) by title, authors, tags and
abstract. Returns citekeys (\`ref\`), metadata, whether a PDF is attached, and
the id of the Reference concept for notes.`, { query: z.string(), limit: z.number().int().default(8) }, ({ query, limit }) => {
      try {
        const hits = refs.search(cfg, query, Math.max(1, Math.min(limit, 25)));
        return hits.length ? fmt(hits) : "No matching references.";
      } catch (err) {
        if (err instanceof refs.ReferenceError) return err.message;
        throw err;
      }
    });

    tool("ref_text", `Read part of a reference's PDF as plain text: \`pages\` like "1" or "3-4,7",
or \`query\` to get the two pages that best match. Read the pages you need
rather than the whole paper.`, { ref: z.string(), pages: opt(z.string()), query: opt(z.string()) }, ({ ref, pages, query }) => {
      try {
        return refs.text(cfg, ref, { pages, query });
      } catch (err) {
        if (err instanceof refs.ReferenceError) return err.message;
        throw err;
      }
    });
  }

  return server;
}

export async function runServer(cfg: Config, version: string): Promise<void> {
  await createServer(cfg, version).connect(new StdioServerTransport());
}
