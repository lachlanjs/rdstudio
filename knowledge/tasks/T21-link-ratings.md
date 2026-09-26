---
type: Task
title: T21 — Link ratings, implied-link culling and link filters
description: Rate links by how consequential they are, hide links implied by chains of others, and filter the map by folder level, rating and focus.
tags: [task, m7, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-26T07:45:00Z
---

# Prompt

The map was still messy, especially around Manifolds. The developer proposed a
range filter on the level of the shared folder, a rating of how consequential
each link is with a range filter, and asked for a practical plan for culling
implied links. Ratings live in link titles.

# Outcome

- `okf.py` parses link titles into ratings (`requires`, `uses`, `see also`);
  the build exports them; `Bundle.requires_cycles()` finds concepts that
  require each other (Tarjan), reported by `rdstudio check` and listed in the
  Review tab. See [link ratings](/design/conventions.md).
- Map: links carry their rating; implied links are computed once per load and
  hidden; two-ended sliders for shared-folder level and rating; toggles for
  links, hiding implied links, and focused-folder-only; routes styled by
  rating; hover colours what a note needs versus what needs it, and shows its
  hidden implied links faintly. See [map view](/design/map-view.md).
- The `record-okf` skill tells agents how to rate links.
- Test bed: all 241 links rated by the agent (68 requires, 40 uses, 133 see
  also; no cycles), for the developer to check.

# Measurements (differential geometry, default settings)

Route crossings in the Manifolds view went from 803 to 405 and in Riemannian
from 726 to 386; most of this comes from hiding `see also` links, and only 9
implied links were culled, since most shortcuts had been rated `see also`.
Focused folder only with levels 1 to 2 leaves 7 routes in Manifolds.

# Revision (developer feedback)

- The range filter was meant to count bubble walls, not the shared folder's
  level. Replaced by a distance filter with two measures: steps out (the larger
  of the two ends' walls out to the shared folder) and path length (all walls
  crossed).
- The two-thumb slider let overlapping thumbs block each other; rebuilt as a
  custom control: the nearest thumb moves, overlapping thumbs are separated by
  the drag direction, arrow keys move a focused thumb.
- Lanes built as a setting: one-way links offset to one side by direction,
  two-way links in the middle. Measured: they do not change route crossings
  (782 with, 779 without, Manifolds view, all ratings shown); they separate
  directions visually. The crossing readout now counts each physical route
  once.
