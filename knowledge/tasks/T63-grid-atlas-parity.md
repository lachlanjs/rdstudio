---
type: Task
title: "T63 — The grid Atlas: parity, the Station skin and retiring the old Atlas"
description: Everything the continuous Atlas does, on the grid (lenses, selection, study paths,
  tours, labels, phone), the Station skin, then the grid as the only Atlas and the old one deleted.
tags: [task, m13, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-05T23:44:02Z}
---

# Prompt

The second step of the grid Atlas ([T62](/tasks/T62-grid-atlas.md)): keep the
old Atlas until parity, then replace it completely.
[Decision](/decisions/grid-atlas.md).

# Plan

To be confirmed after T62 and [T64](/tasks/T64-dag-layout.md). It comes
after both: T62's placeholder layout takes its positions from the old
layout, so the old Atlas's layout code can be deleted only once the DAG
layout has replaced the placeholder. In outline:

1. **Parity,** each item checked against the current Atlas
   ([design](/design/map-view.md)):
   - the three height lenses as tone and fill (Understanding, Activity,
     Health), and the needs-work frame;
   - the selection card with its leader, a selected note's own links in the
     blue pen, hover;
   - study paths and tours (the `path` and `tour` routes use the same view);
   - the label budget, folders opening by detail, the folder path;
   - keyboard, touch and the phone layout with its lens bar;
   - the layout cache and keeping notes in place.
2. **The Station skin,** from `StationGridAtlas` and
   `StationGridAtlasFolder`: the deck plan, pixel type in the blocks.
3. **Retire the old Atlas:** grid becomes the only shape. Removed: the
   circle and contour folders, downhill and gates routing, the terrain, the
   packing and forces (`views/contours.js`, `views/terrain.js`,
   `views/layout.js` and most of `views/map.js`), the placeholder layout,
   their `[map]` settings, walkthrough checks and bench steps. A stored
   `folders` or `routing` choice is ignored.
4. **The design note** is rewritten for the grid.

# Acceptance

- Every walkthrough check on the Atlas passes on the grid, or is replaced by
  its grid equivalent and listed.
- No code path, setting or test names the circle or contour Atlas.
- The grid Atlas is readable in both themes, in light and dark, and at 390
  wide.

# Outcome

Not started.
