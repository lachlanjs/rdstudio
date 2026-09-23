---
type: Task
title: T08 — MCP server
description: Local stdio MCP for search, outline, read, record, verify and log.
tags: [task, m3, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:21:52Z
---

# Prompt

Python MCP server (`rdstudio mcp`): `search`, `outline`, `read` (whole or by section), `list` (directory listing), `record` (create/update a concept, stamping `generated` on significant edits, preserving unknown keys, regenerating indexes), `backlinks`, `review_queue`. Keep responses compact to preserve the agent's context.

# Acceptance

- Tested in-process.
- Registered via `.mcp.json` and usable from Claude Code.

# Outcome

`rdstudio mcp` (`rdstudio.mcp_server`, mcp 2.x `MCPServer`): `search`, `outline`, `read` (optionally one section, optionally with frontmatter), `list_concepts`, `record` (create/update, section replace, append, significant flag, preserves unknown keys, regenerates indexes, returns lint issues for the file), `backlinks`, `review_queue`. Responses are compact JSON or text. Human verification is deliberately not exposed. Verified in-process (`tests/test_mcp.py`) and over stdio with the MCP client.
