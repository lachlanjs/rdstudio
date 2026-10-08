---
type: Task
title: T20 — Map view (first version)
description: A Map tab showing folders as nested regions with links drawn at their scale, tested on a separate differential geometry bundle.
tags: [task, m7, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-26T04:26:47Z
---

# Prompt

The developer's priority after the manifesto: get the visualisation of the map
right, using a differential geometry bundle in a separate repository as a
test bed. The label limit must be configurable.

# Outcome so far

- Test bed: `~/Repositories/differential-geometry`, 58 concepts three folders
  deep, with landmarks and cross-scale links. Agent-drafted, unverified.
- Criteria and design: [map view](/design/map-view.md).
- `web/js/map.js`, a Map tab beside the Graph:
  - nested circle packing of the folder tree; note size from landmark flag and
    PageRank; linked notes packed next to each other;
  - folders open as they grow on screen past a threshold (a setting);
  - each link attaches just inside its lowest common folder, so a folder shows
    its own links and cross-folder links merge into one line per pair of
    regions, thicker for more links; cross-folder lines are dashed;
  - hovering a note shows its individual links at any scale;
  - a label budget (a setting, default 30) filled in priority order: open
    folders, closed folders, then notes by importance; long titles wrap
    inside their circle or wait until zoomed in;
  - a clickable folder path; click a region to zoom in, empty space to step out.
- Checked in screenshots: desktop and phone, light and dark, the test bed and
  rdstudio's own bundle; no page errors.

# Second pass (developer feedback: sizing, spacing, curved lines)

- Notes drawn as dots at about half their packed size, with more padding;
  a narrower importance range.
- Cartographic styling: places, territories, routes; plain background.
- Routing through the gaps between items (Delaunay waypoints plus triangle
  interstices), straightened, B-spline curves, corridor reuse for bundling.
  Catmull-Rom curves overshot into hooks; a bow sized from centre distance
  hooked when a note sat next to a large region; both fixed.
- Hover fades unrelated items; items fade in as folders open.

# Third pass (developer feedback: routes through the hierarchy)

- Every link is drawn to the items showing its ends, routed through the
  hierarchy by gates on each folder's edge (the developer's "nearest point on
  the enclosing perimeter"), with a ring road inside each wall.
- Focus: routes full strength inside the focused folder, faded outside.
- Type markers (Definition, Theorem, Example, Trick, ...) configurable per
  project; landmarks ringed. Examples and tricks added to the test bed.
- Every layout and routing parameter is in a Tuning panel and settable under
  `[map]` in rdstudio.toml; see [map view](/design/map-view.md).
- A crossing and stretch readout. A bug had made every "is the straight line
  clear?" check pass (82 crossings through bubbles); fixed, 1 to 3 remain.
  Parameter sweeps showed layout parameters move route crossings by only
  about 7%: most crossings come from the link structure itself.

# Fourth pass (developer feedback: far more space, contents crowding the middle)

- Top-down spreading layout: contents scaled to a share of each folder, then
  spread evenly by a deterministic force simulation, drawn towards the side
  where their links leave; new settings `room`, `spread`, `outward`.
- Defaults: room 0.3, spacing 90, margin 60, dot 0.6. Crossings through
  bubbles 0 in the three views checked; with subfolders smaller on screen,
  each view shows less at once until zoomed.

# Next

Use it and tune. Open questions: straight region-to-region lines cross other
regions; reports are not on the map yet; the note page layout (mini-map,
nearby versus across-the-map links) is the next piece.

## Closed, 2026-10-08

Marked done in [T104](/tasks/T104-tidy-board-server-root.md): this first
map was replaced by the grid Atlas, and the old Atlas was retired on the
developer's word in [T63](/tasks/T63-grid-atlas-parity.md). Nothing here is
still being worked on.
