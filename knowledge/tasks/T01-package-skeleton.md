---
type: Task
title: T01 — Package skeleton and configuration
description: pyproject, CLI entry point, project and global config loading.
tags: [task, m1, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:01:36Z
---

# Prompt

Create the `rdstudio` Python package (src layout, uv). CLI with subcommands `init`, `build`, `serve`, `check`, `index`, `search`, `verify`, `mcp`. Load `rdstudio.toml` (project) and `~/.config/rdstudio/config.toml` (user: actor id, global bundle path). See [architecture](/design/architecture.md).

# Acceptance

- `uv run rdstudio --help` lists subcommands.
- Config loads with sensible defaults when files are absent.

# Outcome

Package `rdstudio` (src layout, hatchling, uv) with dependencies `pyyaml` and `mcp` (2.x, `MCPServer` API). CLI subcommands: init, check, index, search, verify, build, serve, mcp. `rdstudio.config` loads `rdstudio.toml` (walking up from cwd) and `~/.config/rdstudio/config.toml` (actors, global bundle path) with defaults.
