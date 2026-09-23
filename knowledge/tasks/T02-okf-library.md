---
type: Task
title: "T02 — OKF library"
description: "Parse bundles, frontmatter, links, trust tiers and staleness; lint; generate index.md."
tags: [task, m1, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Prompt

Implement `rdstudio.okf` conforming to the [OKF spec](/references/okf-spec.md): concept IDs, frontmatter preserving unknown keys, link extraction (absolute and relative, broken links tolerated), trust tier, verification staleness per [conventions](/design/conventions.md), lifecycle. `rdstudio check` reports conformance; `rdstudio index` generates every `index.md`.

# Acceptance

- Unit tests cover parsing, links, trust tiers, staleness, index generation.
- `rdstudio check` passes on rdstudio's own bundle.

# Outcome

Not started.
