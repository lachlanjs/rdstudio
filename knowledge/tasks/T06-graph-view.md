---
type: Task
title: T06 — Knowledge graph view
description: Force-directed graph with directed link edges, undirected hierarchy edges and persistent
  positions.
tags: [task, m2, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:16:10Z
---

# Prompt

d3-force graph: concept nodes, directory nodes, directed edges for links, undirected edges for hierarchy, reports as rounded squares (toggle). Live simulation, draggable nodes, labels, zoom and pan. Positions persist across navigation (in memory and sessionStorage).

# Acceptance

- Opening a concept and returning restores the layout.
- Works with touch on mobile.

# Outcome

d3-force graph with directory, concept and report (rounded square) nodes; directed link edges with arrowheads, dashed hierarchy edges. Drag pins (clicks do not), double-click releases; zoom and pan; zoom-to-fit on first layout; labels in their own layer and clickable; colour by directory or trust; highlight search. Positions persist in memory and sessionStorage: measured drift after opening a concept and returning is under 1 px, also after reload.
