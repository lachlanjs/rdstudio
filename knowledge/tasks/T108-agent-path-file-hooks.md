---
type: Task
title: "T108 — The agent's path: reads and edits made outside MCP"
description: Report a terminal agent's direct reads and edits of knowledge files to the same log,
  through each harness's hooks, Claude Code first.
tags: [task, m17, agents, harness, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T12:44:41Z}
---

# Prompt

The developer, 2026-10-08: "if the terminal based agent is reading from the
knowledge base, or editing the OKF in some way, it would be cool to see it
in the browser live."

After [the live path](/tasks/T107-agent-path-live.md "requires"), whose
limit this removes.

# Scope, from the agent

- A terminal agent often reads `knowledge/*.md` with its own file tools or
  a search of the files, and edits them the same way. Those never reach the
  MCP server.
- **Writes** are still seen, since the server watches the files, but not
  which agent made them or why.
- **Reads** need the harness. Claude Code hooks can report each file read
  or edit; opencode has plugins for the same.
- `rdstudio init` already installs a session-start hook in
  `.claude/settings.json`, so it is the place to install these.

# To settle before a plan

- How a hook reports: a small `rdstudio` command that appends to the log,
  which must be quick since it runs on every tool call.
- How a hook's session is matched to the MCP session of the same agent.
- Which harnesses: Claude Code first, then opencode; others as asked for.
- Whether a session with neither MCP nor hooks is rebuilt from git, as the
  idea note asks.

# Plan

(Filled in by the agent before implementation.)

# Acceptance

- In Claude Code, reading or editing a file under `knowledge/` with the
  built-in tools shows on the path, in the same session as the MCP calls.
- The hook adds no delay the developer notices.
- `rdstudio init` installs it, and a project without it works as before.

# Outcome

Done on 2026-10-08 for Claude Code, on the branch `feat/m16-leaner`; not
committed. Approved with the rest ("Go ahead with things").

**What it does.** A file of the knowledge base that an agent reads,
searches or edits with its own tools is a step on its path, in the same
session as its MCP calls.

**How.**

- **`rdstudio trace`** reads a hook's JSON on standard input and adds a
  step to the log. It takes Claude Code's `PostToolUse` report as it is
  sent, and a plain form (`{tool, path, query, session, client}`) for any
  other harness. It prints nothing and never fails.
- **`rdstudio init`** adds a `PostToolUse` hook to `.claude/settings.json`
  for Read, Edit, Write, MultiEdit, NotebookEdit, Grep and Glob. It runs
  in the background (`"async": true`), so a tool call does not wait for
  it. Running `init` again does not add it twice.
- **Only notes of this project's base are steps.** Any other file, an
  `index.md`, and a search of a folder that does not hold the base are
  ignored.

**Choices made** (they answer "To settle before a plan"):

- **Matching sessions:** a report joins the latest MCP session of the same
  agent that was active in the last five minutes. With none, it is a
  session of its own, named for the harness's session. Two sessions of the
  same agent at once in one project would be mixed.
- **Speed:** the command takes about half a second to start, which is why
  it is run in the background and not made quicker.
- **Not rebuilt from git.** A session with neither MCP nor hooks leaves
  only what git sees.

**Checked.** A unit test of the reports (each tool, files outside the
base, the plain form, joining and not joining), and in the browser check
of [T107](/tasks/T107-agent-path-live.md): the command run as a hook runs
it, quiet and under a second, its step joining the live session; a file
outside the base making no step. `init` run twice in an empty folder
wrote the hook once.

**Not checked.**

- In a real Claude Code session. The report's field names
  (`tool_input.file_path`, `pattern`, `path`) are from general knowledge
  of its tools, and its hooks page confirmed `async` and the report's
  outer fields but not those. A wrong name would make no step and no
  error.
- What a search found: a hook's report of Grep or Glob is taken before
  results are known here, so a search marks no notes.

**Not done.**

- **opencode.** It needs a plugin that calls `rdstudio trace` with the
  plain form; none is written.
- **This repository's own settings.** The hook is not added to
  `.claude/settings.json` here: `rdstudio init` adds it when the developer
  wants it.
