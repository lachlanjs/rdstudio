---
type: Task
title: T16 — Instantiate in himode and test drive
description: Run rdstudio init in ~/Repositories/himode and exercise the full workflow.
tags: [task, m5, active]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:35:41Z
---

# Prompt

Install rdstudio into `~/Repositories/himode`, run `init`, bootstrap the bundle for the Hierarchical Modularity Evolution project, and exercise record, search, report, review and procedures with the developer.

# Acceptance

- Developer confirms the workflow is usable.

# Outcome

Set up, awaiting the test drive with the developer. rdstudio is installed as an editable uv tool (`~/.local/bin/rdstudio`). `~/knowledge` is the global knowledge base (private git repo, no remote); `~/.config/rdstudio/config.toml` holds its path and `human:lachlan`. `~/Repositories/himode` has been initialised (merged on main) with the papis `thesis` library as its reference backend; its MCP server was exercised over stdio (12 tools, papis search, global scope). Next: open Claude Code in himode, run the bootstrap task together, then try record, search, report, review and a first procedure.
