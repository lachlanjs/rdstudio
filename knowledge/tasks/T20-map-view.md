---
type: Task
title: T20 — Map view (first version)
description: A Map tab showing folders as nested regions with links drawn at their scale, tested on a separate differential geometry bundle.
tags: [task, m7, active]
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

# Next

Use it and tune. Open questions: straight region-to-region lines cross other
regions; reports are not on the map yet; the note page layout (mini-map,
nearby versus across-the-map links) is the next piece.
