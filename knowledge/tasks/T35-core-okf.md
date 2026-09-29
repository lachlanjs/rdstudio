---
type: Task
title: "T35 — TypeScript core: OKF parsing and lint"
description: "packages/core: frontmatter as YAML 1.2, links and headings through markdown-it, trust and staleness, lint and index generation, matching the fixtures."
tags: [task, m9, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-29T01:14:28Z }
---

# Prompt

Platform D2. The core takes files as text (no file system access), so it
runs in the browser, Node and Tauri alike; a Node loader reads a folder.

Where [T34](/tasks/T34-conformance-fixtures.md) found the Python core arguably
wrong (links and headings by pattern, YAML 1.1), the TypeScript core does the
right thing and the Python core is changed to match, with the fixtures recorded
again, so both agree before anything is replaced.
