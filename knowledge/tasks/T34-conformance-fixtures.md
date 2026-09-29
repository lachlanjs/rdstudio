---
type: Task
title: "T34 — Conformance fixtures"
description: "Test bundles with the Python core's output recorded as expected JSON, which every implementation must match."
tags: [task, m9, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-29T01:14:28Z }
---

# Prompt

Platform D1; also a test suite for OKF.

# Outcome

- `fixtures/`: five bundles (basics, order, edge, markdown, and 63 synthetic
  notes), search queries, and the expected output of the Python core for each,
  recorded by `fixtures/expected.py` (see `fixtures/README.md` for what is
  compared). `mise run fixtures` checks; `mise run fixtures:update` records
  again. `tests/test_conformance.py` runs the check with the other tests.
- Lint issues now carry a stable `code` (broken-link, requires-cycle,
  frontmatter-invalid, frontmatter-missing, type-missing, generated-without-by,
  verified-without-by, index-frontmatter, root-index-frontmatter,
  log-heading-date, procedure), included in the dashboard data. Fixtures
  compare codes, not wording, since a YAML error message is the parser's own.
- `.gitattributes` keeps fixture files byte for byte (one uses CRLF).

# What the fixtures found

Three places where today's core is arguably wrong, recorded as it behaves now
and left for [T35](/tasks/T35-core-okf.md) to decide:

1. Links are found by pattern: escaped brackets, double-backtick code and
   indented code blocks produce links; nested brackets and parentheses in a
   target are missed.
2. Headings are found by pattern: indented (up to three spaces) and setext
   headings are missed.
3. Frontmatter is read as YAML 1.1: `yes`, `no`, `on`, `off` become booleans,
   `010` is 8 and `1:30` is 90.
