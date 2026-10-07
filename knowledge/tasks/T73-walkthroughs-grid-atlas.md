---
type: Task
title: T73 — Bring the browser walkthroughs up to the grid Atlas
description: Four end-to-end walkthroughs still look for the continuous Atlas's markers, which the
  grid Atlas does not draw, and stop or fail there; rewrite their Atlas steps for the grid.
tags: [task, m13, tests, atlas, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-06T22:35:10Z}
---

# Prompt

Found on 2026-10-06 when `main` was merged into `grid-dag-view`. The grid
Atlas replaced the continuous one
([T63](/tasks/T63-grid-atlas-parity.md)), but the walkthroughs in `e2e/`
were not changed with it. Run then:

- `e2e/learn.py` stops at its first Atlas step, waiting for `.m-place`.
- `e2e/teacher.py` stops the same way.
- `e2e/compose.py` stops on an element it expects on the map.
- `e2e/reshape.py` fails one check of 28 ("the map shows the Philosophy
  bubble").
- `e2e/edit.py` (26), `e2e/signin.py` (4) and `e2e/code.py` pass.
  `e2e/code.py` was rewritten for the grid Atlas at the merge and extended
  since ([T71](/tasks/T71-atlas-flat-and-room.md),
  [T72](/tasks/T72-feeders.md)); it shows the selectors to use: `.g-title`
  for a folder's name, `svg.gridmap g.gn` for a note, `.map-wrap`'s
  `routes()` and `layout()` for what is drawn.

So `mise run e2e` does not pass on `grid-dag-view` or the branches off it,
and has not since the grid Atlas landed. The developer was told and has not
yet asked for the fix.

# Plan

1. In each of the four, replace the Atlas steps' selectors and waits with
   the grid's, keeping what each step checks (a note selects and opens, a
   study path, a tour, hiding what is not reached, a new note or folder
   appears on the map).
2. Drop checks of things the grid Atlas does not have (terrain, contours,
   the continuous layout's settings), and add the grid's equivalents where
   there is one (reached ground, the lenses' tones).
3. Run all seven and record the counts here.
