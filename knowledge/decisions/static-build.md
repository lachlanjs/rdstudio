---
type: Decision
title: "Dashboard is a static site built from JSON"
description: "A Python build step emits JSON; the browser app is static and can be served by any file server."
tags: [decision]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Decision

`rdstudio build` writes JSON (tree, concepts, links, git history, reports,
skills, agents, procedures) and web assets to `.rdstudio/site/`. `rdstudio serve`
is a stdlib HTTP server that rebuilds on change. The same output can be exported
to GitHub Pages.

# Assumption

`python -m http.server` alone cannot list directories as JSON or read git; a
build step keeps the frontend dependency-free and makes static export free.

# Reopen if

Rebuild latency on large bundles becomes noticeable (then: incremental build).
