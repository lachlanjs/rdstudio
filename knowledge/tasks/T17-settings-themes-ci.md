---
type: Task
title: T17 — Graph dragging, graph options, themes and CI publishing
description: Fix node dragging, add persistent force options, a Settings tab with five themes, and CI export guidance.
tags: [task, m6, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T10:40:00Z
---

# Prompt

From the developer, after running rdstudio's own dashboard: nodes in the graph
cannot be moved, though the graph should respond to dragging with its forces;
keep the current layout but add persistent options. Add a Settings tab by
"Live" with five themes (light and dark each), from retro monospace through
academic serif and modern to the current style, each only loading different
CSS. Explain static export for CI (GitHub Pages or similar), with light README
guidance and an entry in this knowledge base.

# Outcome

- **Dragging:** the drag handler only woke the simulation when
  `event.active` was 0, which never holds mid-drag; a layout restored at rest
  therefore never moved. Fixed; a browser test drags a node 171 px on a
  restored layout and 38 other nodes respond.
- **Graph options:** repulsion, link length and pull-to-centre multipliers
  (1× is the original layout), unpin all, default forces, re-run layout.
  Options and positions now persist in localStorage.
- **Themes:** Notebook, Journal, Modern, Blueprint, Terminal in
  `web/themes/`, over shared tokens; mode is system, light or dark. Chosen per
  browser in Settings, applied before first paint, followed by reports.
  See [dashboard design](/design/dashboard-design.md).
- **CI:** README section and the
  [publishing procedure](/procedures/publish-static-site.md). Simulated
  locally; not yet run on GitHub.
