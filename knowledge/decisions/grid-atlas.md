---
type: Decision
title: The grid Atlas replaces the continuous Atlas
description: The Atlas moves to a square grid of note blocks and rectangular folders with routes
  over cells; the circle and contour Atlas is kept switchable until the grid reaches parity, then
  deleted.
tags: [decision, dashboard, map]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-05T22:33:21Z}
---

# Decision

The grid Atlas (sketches `GridAtlas*`, `design/tools/grid.mjs`) replaces the
continuous Atlas of [T57](/tasks/T57-atlas.md) and
[T60](/tasks/T60-atlas-contours.md) completely
([T62](/tasks/T62-grid-atlas.md), [T63](/tasks/T63-grid-atlas-parity.md)).
Decided by the developer on 2026-10-05.

- **Folders are rectangles** for now, for simplicity. Free-form regions are
  not ruled out later.
- **The old Atlas stays switchable** until the grid does everything it does,
  and is deleted then: the circle packing and forces, contour folders,
  downhill and gates routing, and the terrain.
- **The layout** is each folder as a layered DAG of its items, and one item
  in its parent's ([T64](/tasks/T64-dag-layout.md)). The sketch's snapped
  layout was a placeholder and is gone; its searched layout
  (`design/tools/gridopt.mjs`, simulated annealing) was never ported.

# Assumption

The grid's router and drawing do not depend on how positions were chosen, so
they can be built now and keep working when the layout changes. In the
sketch the router takes only cells: blocks, owners, heights.

# Alternatives considered

- **A third folder shape beside `circle` and `contour`**, as the sketch
  proposes: keeps three maps to maintain.
- **Port the searched layout first:** about a minute per layout at 63 notes,
  and it would be thrown away.

# Reopen if

The grid cannot show a bundle of about 1,000 notes legibly or in reasonable
time (the continuous Atlas is timed at 1,186), or the layout that replaces
the placeholder needs folder shapes the cell model cannot express.
