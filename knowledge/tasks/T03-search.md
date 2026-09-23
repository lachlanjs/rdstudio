---
type: Task
title: T03 — Deterministic search and sectioned reading
description: BM25 search with frontmatter filters; outline and section extraction.
tags: [task, m1, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:01:36Z
---

# Prompt

Implement `rdstudio.search`: BM25 over title, description, tags, headings and body with field weights; filters on type, tags, trust, status. Outline (heading tree) and section extraction by heading. Results return path, title, description, score and a short snippet — never whole bodies.

# Acceptance

- Tests show ranking sanity and filter behaviour.
- `rdstudio search <query>` prints compact results.

# Outcome

`rdstudio.search`: BM25 with field weights (title 4, tags 3, description and headings 2, type and body 1), light plural stemming, filters (type, tags, trust, status, directory), snippets from the first matching body line. Outline and section reading live in `rdstudio.okf` (`headings`, `section`). Tests: `tests/test_search.py`.
