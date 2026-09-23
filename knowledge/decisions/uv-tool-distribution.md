---
type: Decision
title: "Distribute as a uv tool, not a template repo"
description: "rdstudio ships as a Python package installed with uv; project content lives at the repo root."
tags: [decision]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Decision

rdstudio is a Python package. Install globally with `uv tool install` or pin per
project with `uv add --dev rdstudio`. `rdstudio init` scaffolds a project.
Knowledge, reports and config live at the repository root, committed; only
rebuildable output lives in git-ignored `.rdstudio/`.

# Assumption

Updating one tool is better than re-syncing N template copies; knowledge is
project content and must be versioned with it.

# Reopen if

Users need heavy per-project customisation of the dashboard code itself.
