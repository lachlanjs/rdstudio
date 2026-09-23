---
type: Task
title: T02 — OKF library
description: Parse bundles, frontmatter, links, trust tiers and staleness; lint; generate index.md.
tags: [task, m1, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:01:36Z
---

# Prompt

Implement `rdstudio.okf` conforming to the [OKF spec](/references/okf-spec.md): concept IDs, frontmatter preserving unknown keys, link extraction (absolute and relative, broken links tolerated), trust tier, verification staleness per [conventions](/design/conventions.md), lifecycle. `rdstudio check` reports conformance; `rdstudio index` generates every `index.md`.

# Acceptance

- Unit tests cover parsing, links, trust tiers, staleness, index generation.
- `rdstudio check` passes on rdstudio's own bundle.

# Outcome

`rdstudio.okf`: frontmatter split and round-trip (unknown keys kept, ISO UTC timestamps), concepts and directories, link resolution (absolute, relative, directory, broken, code ignored), trust tiers, verification staleness, `stale_after`, lint per OKF §11, generated §8 indexes (grouped by type, Overview first, root `okf_version`). `rdstudio.store`: record (whole body, one section, append; significant vs minor) and verify. Tests: `tests/test_okf.py`, `tests/test_store.py`. `rdstudio check` passes on this bundle.
