---
type: Task
title: T05 — Dashboard shell and Knowledge list
description: Single-page app, responsive layout, rendered markdown with KaTeX, tables, code highlighting
  and frontmatter panel.
tags: [task, m2, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:16:10Z
---

# Prompt

Vanilla JS SPA with hash routing and vendored libraries (markdown-it, KaTeX, highlight.js). Knowledge tab: directory tree, directory headings open the generated index plus any overview concept; concept view with rendered body and a frontmatter table on the right (below on mobile). Links between concepts navigate in-app. Trust badges. Light and dark themes.

# Acceptance

- Renders maths, tables, code blocks, footnotes.
- Usable at 390 px width (screenshot-checked).

# Outcome

Vanilla JS modules in `web/js/`. Knowledge tab: filterable tree (Overview concepts shown on their directory page), concept page with rendered body (KaTeX via texmath, footnotes, task lists, tables, highlight.js), frontmatter panel on the right with trust badge, outline and links in/out. Directory pages show the overview then the generated index. Screenshot-checked at 1440 and 390 px, light and dark; phone header uses two rows and the tree becomes a drawer. See [dashboard design](/design/dashboard-design.md).
