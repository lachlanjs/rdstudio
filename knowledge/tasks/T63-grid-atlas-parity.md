---
type: Task
title: "T63 — The grid Atlas: parity, the Station skin and retiring the old Atlas"
description: Everything the continuous Atlas does, on the grid (lenses, selection, study paths,
  tours, labels, phone), the Station skin, then the grid as the only Atlas and the old one deleted.
tags: [task, m13, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-06T04:08:46Z}
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

Done on 2026-10-06, on the developer's word to retire the old Atlas, on the
branch `grid-dag-view`. The walkthroughs have not been run (see Not checked).

- **On the grid now:**
  - **A selected note's card:** where you stand, how many notes it requires
    and build on it, Open the note, its exercise, its study path. No leader
    line joins the card to the note.
  - **Study paths and tours:** the notes numbered (a closed folder shows the
    steps inside it), the links among a path's notes or from each tour stop
    to the next lit in the blue pen, the rest stepped back, the same cards
    as before, and the view opening on the whole path.
  - **Hiding what you have not reached:** those notes and the folders
    holding none are left out, with the trunks to them.
  - **Landmarks** have a heavier frame.
  - The lenses, hover, keyboard and the folder path were already there
    (T62, T64).
- **Removed:** the continuous Atlas: the circle packing and forces, contour
  folders, downhill and gates routing, the terrain, lanes, the distance and
  rating filters, the Tuning panel and its 13 sliders. `views/contours.js`
  and `views/terrain.js` are gone; `views/map.js` went from 1,960 lines to
  319 (the model, settings, lenses and panel) and `views/layout.js` to the
  worker and the layout's cache. 91 style rules went with them.
- **Settings:** `folders`, `routing` and the old tuning keys under `[map]`
  are ignored. What remains is in [the design](/design/map-view.md).
- **The bench** (`bench/run.py`) reports the grid's layout and routes as
  `layout_ms` and `routes_ms`; `--folders` is gone.
- **Not done:**
  - **The Station skin** of the Atlas, which goes with
    [T61](/tasks/T61-station-theme.md).
  - **A label budget:** every note large enough on screen carries its title.
  - **Keeping notes in place** when the contents change: the layout is
    worked out afresh.
  - **On a phone on its side** the lens bar covers the map's top left.
- **Not checked:** the walkthroughs. `e2e/learn.py` (18 places),
  `e2e/teacher.py` (4) and `e2e/compose.py` (2) look for the old Atlas's
  elements (`.m-place`, `.m-link`, `.m-dir`, the Tuning panel, "off a right
  angle") and will fail until rewritten for the grid, which needs their test
  bed (the differential geometry bundle), not on this machine.
- **Checked:** the app's 38 tests and type check; by eye on the abstract
  algebra bundle: the map, a note pointed at, a note selected, the study
  path to Abel-Ruffini (57 steps), and a phone both ways up. A tour has not
  been tried: that bundle has none.
