---
type: Task
title: T22 — Five themes, direction colours and a clearer range slider
description: Replace the themes with Studio, Notebook, Map, Space and Cyber, each restyling the map as well as the page; colour routes by direction only; make range-slider thumbs distinct.
tags: [task, m7, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-26T08:36:12Z
---

# Prompt

The developer asked for range-slider thumbs that stay apart when on the same
value, route colours meaning direction only with a legend, and a revamp of the
themes towards Space, Map, the existing look, Cyber and Notebook, leaning into
each.

# Outcome

- **Slider:** the thumbs are the two halves of a bracket, the lower just left
  of its value and the upper just right, so they never cover each other;
  pressing a half picks that thumb.
- **Direction:** each one-way route is a gradient from the note that links to
  the note it links to (`--route-from` to `--route-to`); two-way or mixed
  routes use `--route-both`. Ratings still set width and dotting. A legend sits
  in the map's Options panel.
- **Themes:** Studio (the previous default), Notebook (ruled paper, Caveat
  headings and labels, pencil filter; chalkboard dark), Map (land tints,
  dash-dot borders, contour sea, cased roads; night chart dark), Space (star
  field, nebulae, glowing stars; celestial atlas light), Cyber (neon grid,
  scanlines, glow, monospace; daylight light). See
  [dashboard design](/design/dashboard-design.md). Caveat (OFL) is vendored.
- Old stored theme choices map to their nearest new theme.

# Found on the way

The developer's own `rdstudio serve` in the test bed, started before link
ratings existed, kept rebuilding the shared `.rdstudio/site` with the old code,
which is why ratings sometimes vanished. Long-running servers need a restart
after a Python upgrade, and two servers on one project overwrite each other's
builds.

# Phones (developer feedback: slow on Space, little room in landscape)

- Short screens (height up to 560 px, a phone on its side) get the compact
  controls: Options and Tuning start collapsed; the hint is hidden; the tabs
  scroll instead of running off the edge.
- During a gesture the drawn layer is only moved and scaled; the full redraw
  (routes, gradients, labels) runs when the gesture pauses, ends or the zoom
  changes by half. Glows, blurs and pencil wobble are dropped while moving.
  Measured with a 4x CPU throttle: frame work during 24 zoom steps fell from
  213 ms to 89 ms, the same for every theme.
- The fixed page texture is only fixed on mouse-driven screens.

