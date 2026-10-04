---
type: Task
title: "T60 — The Atlas: contour folders and downhill routes"
description: "Folder outlines as contours of their contents' fields, and routes that cross contours at right angles and gather in the flats, as options beside circles and gates; the default once timed at scale."
tags: [task, m12, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T12:00:00Z }
---

# Prompt

The second step of the Atlas ([T57](/tasks/T57-atlas.md)); sketches under
"Atlas · exploration" in design/project, and `design/tools/organic.mjs`.

- **Folder shape** `circle` or `contour`: each folder's outline is the 0.6
  contour of a field with one bump per child, 0.55 of the spacing between
  children wide; outlines nest. Names sit above the outline.
- **Routing** `gates` or `downhill`: shortest paths on a 5-unit grid where a
  step along the slope is cheap and across it up to 7 times dearer, high
  ground a little dearer, another folder's interior 6 times dearer, used cells
  25% cheaper. A trunk ends exactly on each outline it joins.
- With contour folders, the terrain is masked to 0 on each outline so the two
  families of contours never cross.
- Per project settings beside `[map]`; `contour` with `downhill` the default
  once downhill routing is timed above 1,000 notes, `circle` with `gates`
  the fallback until then.
