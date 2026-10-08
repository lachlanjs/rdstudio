---
type: Task
title: T111 — An opencode plugin that reports file reads and edits of the base
description: A plugin that rdstudio init installs for opencode, calling rdstudio trace after each
  file read, search or edit, so an opencode session's path on the Atlas is whole.
tags: [task, m18, agents, harness, opencode, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T23:44:24Z}
---

# Prompt

The developer, 2026-10-09: "I would like the opencode plugin".

Left undone by [T108](/tasks/T108-agent-path-file-hooks.md), which did
this for Claude Code only.

# What exists

- `rdstudio trace` reads one report on standard input and adds a step to
  the log. Besides Claude Code's own form it takes a plain one:
  `{tool, path, query, session, client}`, where `tool` is read, edit,
  write, grep, glob and the like (`hookEvent` in
  `packages/cli/src/trace.ts`).
- A report joins the latest MCP session of the same agent active in the
  last five minutes, matched by the start of the client's name. opencode's
  MCP session names itself as opencode does.
- `rdstudio init` already writes opencode's MCP registration and agents
  (`packages/cli/src/scaffold.ts`), and the Claude Code hook.

# To settle before a plan

- **opencode's plugin interface, from its documentation, not from memory:**
  where a plugin file goes (`.opencode/plugin/` is the agent's
  recollection), the hook that fires after a tool has run, and the names
  of its file tools and their arguments.
- How the plugin runs the command without holding up the tool call.
- What `client` it sends, so that its reports join its MCP session.
- Whether a search's results are to hand in opencode's hook. In Claude
  Code's they are not, so a search marks no notes.

# Plan

(Filled in by the agent before implementation.)

# Acceptance

- `rdstudio init` writes the plugin, once, and a project without opencode
  is unaffected.
- In a real opencode session, reading or editing a file under the
  knowledge folder with opencode's own tools shows as a step on the Atlas,
  in the same session as its MCP calls.
- A file outside the base makes no step, and a failure of the command
  never fails or slows the tool call.
- Tried in a real opencode session on the developer's machine: opencode is
  not on the machine this was written on.

# Outcome

Not started.
