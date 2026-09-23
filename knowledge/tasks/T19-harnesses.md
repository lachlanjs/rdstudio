---
type: Task
title: T19 — AGENTS.md and OpenCode support
description: Make rdstudio init set up OpenCode (and other AGENTS.md harnesses) alongside Claude Code.
tags: [task, m6, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T23:44:30Z
---

# Prompt

The developer needs an AGENTS.md and the configuration for OpenCode.

# Outcome

`rdstudio init` now writes, for every project:

- **AGENTS.md** holds the managed rdstudio section, read by OpenCode, Codex and
  other harnesses. CLAUDE.md's managed section is just `@AGENTS.md`, so Claude
  Code reads the same text (an existing full section in CLAUDE.md is replaced
  by the import on the next `init`). A CLAUDE.md symlinked to AGENTS.md is
  left alone.
- **opencode.json** registers the MCP server as a local server (merged into an
  existing `opencode.json`, or `opencode.jsonc` if that is the only one and
  it is plain JSON).
- **.opencode/agents/** holds the librarian, critic and searcher as OpenCode
  subagents, translated from the Claude Code files: same prompt, `mode:
  subagent`, and `permission` rules in place of Claude's `tools` lists
  (none of them may edit; librarian and critic may not run shell or fetch).
- Skills stay in `.claude/skills/`, which OpenCode also reads.

Harness-neutral wording: skills and the section name tools as "the rdstudio
`record` tool" and skills as "the `record-okf` skill", because MCP tool names
differ by harness (`mcp__rdstudio__record` in Claude Code, `rdstudio_record`
in OpenCode).

Session start: OpenCode has no hook that injects text into context, so the MCP
server gained a `brief` tool and AGENTS.md tells agents to call it when a
session did not open with a brief. Claude Code keeps its SessionStart hook.

Provenance: `rdstudio mcp --agent <actor>` overrides `[actors] agent`; the
OpenCode config passes `opencode/unknown` (edit it to name the model).

# Verification

In a scratch project with OpenCode 1.18.32: `opencode mcp list` shows rdstudio
connected, `opencode agent list` shows the three subagents, and all ten skills
are discovered. Tests cover the generated files and the `brief` tool.
