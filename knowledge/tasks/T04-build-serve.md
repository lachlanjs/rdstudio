---
type: Task
title: "T04 — Build pipeline and server"
description: "Emit site JSON and assets; categorised git history; serve with rebuild-on-change."
tags: [task, m2, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Prompt

`rdstudio build` writes `.rdstudio/site/` with web assets and `data/` JSON: concepts, tree, links, git history (commit → files, categorised as knowledge / code / reports / other by configurable globs), skills, agents, reports. `rdstudio serve --host --port` serves it, polls for changes, rebuilds, bumps a version stamp. See [static build](/decisions/static-build.md).

# Acceptance

- Build works with and without git.
- Editing a concept updates the running dashboard within a few seconds.

# Outcome

Not started.
