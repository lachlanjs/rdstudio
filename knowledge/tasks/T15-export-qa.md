---
type: Task
title: T15 — Static export and visual QA
description: Export for static hosting; screenshot review at desktop and mobile widths.
tags: [task, m5, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:35:41Z
---

# Prompt

`rdstudio export <dir>` produces a self-contained static site (project bundle only). Screenshot every tab at 1440 and 390 px with headless Chromium and fix layout issues.

# Acceptance

- Export opens correctly from a plain file server.

# Outcome

`rdstudio export DIR` writes a snapshot (`static: true`: no polling, no user-level skills, no uncommitted changes; `.nojekyll`). Checked served by `python -m http.server` with no console errors. Visual QA at 1440 and 390 px, light and dark, across all tabs; fixes made along the way: two-row phone header, graph label layer and priority decluttering, legible minimum zoom on phones, procedure flows that switch orientation and route long edges around steps.
