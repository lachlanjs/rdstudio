---
type: Task
title: T13 — Global bundle and promote
description: Support ~/knowledge as a second bundle; scoped search; /promote.
tags: [task, m4, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:32:21Z
---

# Prompt

Multiple bundles in core, MCP `scope` parameter, dashboard scope toggle and `rdstudio serve` outside a project for the global bundle. `rdstudio promote <path>` moves a concept to the global bundle. Export excludes global content. See [decision](/decisions/multiple-bundles.md).

# Acceptance

- Project search never returns global results unless asked.

# Outcome

`rdstudio global init [~/knowledge]` scaffolds a private git root and sets `[global] path` in `~/.config/rdstudio/config.toml`. MCP tools take `scope` (project, global, all; global ids are prefixed `global:`); `record` can write to the global base; `promote` moves or copies (refuses to move a concept that project concepts link to). `rdstudio skills list|to-user|to-project` moves skills between scopes; the dashboard lists project and user-level skills. Deviation: rather than a scope toggle in the project dashboard, the global base has its own dashboard (`rdstudio serve -C ~/knowledge --port 8001`), which keeps project exports free of global content by construction.
