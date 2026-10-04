---
type: Task
title: "T60 — The Atlas: contour folders and downhill routes"
description: "Folder outlines as contours of their contents' fields, and routes that cross contours at right angles and gather in the flats, as options beside circles and gates; the default once timed at scale."
tags: [task, m12, done]
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

# Outcome (2026-10-05)

Ported from the sketch's `organic.mjs` into `app/src/lib/views/contours.js`,
run in the layout worker. Details are in
[the map's design](/design/map-view.md).

- **Contour folders:**
  - The outlines nest, and closed folders are filled outlines.
  - Names sit above an open outline, or in the middle of a closed one.
  - The terrain is masked to each top-level outline, so the understanding
    contours run inside it.
  - Circles are drawn until the outlines arrive, which is once per layout.
  - The threshold is 0.5, as in the sketch's code; the brief's text says 0.6.
- **Downhill routes:**
  - Searched with A* (the sketch used Dijkstra), on a growable binary heap
    over typed arrays, held to a window around the two ends.
  - Trunks end on the outlines.
  - Routes are cached per pair until the layout or the understanding values
    change, and the summary reports the right-angle measure.
- **Settings:** `folders` (`contour` or `circle`) and `routing` (`downhill`
  or `gates`) are per project under `[map]`, or per browser under More
  options. Contour with downhill is the default.
- **Timed:**

  | | Outlines | Routes |
  |---|---|---|
  | dg, 63 notes | 24 ms | 141 ms |
  | field, 1,186 notes | 148 ms | 314 ms |

  Both run in the worker after the map has settled, and fps stays 60 on
  desktop and 59 on the phone profile. In Node, on synthetic trees of 64 to
  2,016 notes, 28 trunks took 170 to 230 ms with a median 5 to 11° off a
  right angle.
- **Also fixed:** the Tuning panel's "Show as rdstudio.toml" now quotes
  string values (`distMeasure` was printed unquoted, which is not TOML). The
  bench now reports `outlines_ms`, `downhill_ms` and `terrain_ms`.
- **Not done:** the mixed pairings (contours with gates, circles with
  downhill) work but are not tuned, as the brief leaves them unsketched.
- **Checked:** `e2e/learn.py` (67) covers the outlines with names above
  them, the right-angle measure, and switching to circles and gates and back.
