---
type: Task
title: T04 — Build pipeline and server
description: Emit site JSON and assets; categorised git history; serve with rebuild-on-change.
tags: [task, m2, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:16:10Z
---

# Prompt

`rdstudio build` writes `.rdstudio/site/` with web assets and `data/` JSON: concepts, tree, links, git history (commit → files, categorised as knowledge / code / reports / other by configurable globs), skills, agents, reports. `rdstudio serve --host --port` serves it, polls for changes, rebuilds, bumps a version stamp. See [static build](/decisions/static-build.md).

# Acceptance

- Build works with and without git.
- Editing a concept updates the running dashboard within a few seconds.

# Outcome

`rdstudio.build` writes `.rdstudio/site/` (web app copied from the package, `data/*.json`, concept bodies under `data/k/`, bundle assets, reports). Indexes regenerate automatically (`[index] auto`). `rdstudio.gitlog` categorises files with configurable globs and shows uncommitted changes; build output is excluded. `rdstudio serve` polls sources every second, rebuilds, and the page polls `version.json` every 2.5 s. Verified: an edit appears in an open page within ~5 s. Python changes need a server restart; web asset changes do not. Tests: `tests/test_build.py`.
