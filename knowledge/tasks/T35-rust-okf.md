---
type: Task
title: "T35 — Rust core: OKF parsing and lint"
description: "Frontmatter, links and ratings through a CommonMark parser, headings, trust and staleness, lint and index generation, matching the fixtures."
tags: [task, m9, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-29T01:14:28Z }
---

# Prompt

Platform D2.

Decide first, from [T34](/tasks/T34-conformance-fixtures.md)'s findings:
parse links and headings with a CommonMark parser (pulldown-cmark), read
frontmatter as YAML 1.2, then change the Python core to match and record the
fixtures again, so both cores agree before the Rust one replaces anything.
