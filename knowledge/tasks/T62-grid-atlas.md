---
type: Task
title: "T62 — The grid Atlas: cells, routes and drawing"
description: "The grid Atlas in the app as a third folder shape on real bundles: note blocks and
  rectangular folders on cells, A* routes with lanes, solved in the worker, behind a layout
  interface with a placeholder layout."
tags: [task, m13, active]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-06T00:19:15Z}
---

# Prompt

Integrate the new Grid Atlas from the redesign branch, which will replace the
existing continuous Atlas completely. Assume rectangular folders for
simplicity for now. Keep the old Atlas until parity. The node and edge layout
algorithm will then be redesigned around finding DAGs within the total graph.

Sketches `GridAtlas`, `GridAtlasFolder`, `GridAtlasAll`; code in
`design/tools/grid.mjs`. [Decision](/decisions/grid-atlas.md). The first of
two steps; [T63](/tasks/T63-grid-atlas-parity.md) is the second.

# Plan

Approved by the developer on 2026-10-05, with the closed-folder proposal
below. Amended the same day for the DAG layout
([T64](/tasks/T64-dag-layout.md)): the interface in step 1 carries what that
layout produces.

1. **The layout interface,** the one thing the DAG layout must implement.
   Given the folder tree, the links and options, it returns:
   - the grid's size, and a block of cells for each note;
   - a region of cells for each folder. A rectangle for now, but the cell
     model stores the owner of each cell, so a hull with 45 degree sides fits
     later without changing the router;
   - for each link, its level (the lowest folder holding both ends), whether
     the layout placed it (in the DAG) or left it to be routed afterwards
     (back), and any cells reserved for it.

   The placeholder marks every link as back and reserves nothing. Nothing
   after the interface knows how positions were chosen.
2. **The placeholder layout** (`app/src/lib/views/grid/snap.js`), from the
   sketch's `build`: positions from the existing layout (`views/layout.js`,
   so north and keeping notes in place carry over), snapped to cells, each
   folder scaled down and nudged until notes keep 2 clear cells and folders 3.
   A note is 8 by 2 cells, larger with many links. A folder has a title row,
   a free row and 2 cells of margin. It is a baseline to measure T64 against,
   and goes when T64 lands.
3. **The cell model** (`grid/cells.js`): per cell, the height (nesting
   depth), what blocks it (a note or a title row), the folder that owns it
   and whether it is reached.
4. **The router** (`grid/router.js`), from the sketch's `makeRouter`: A* over
   cells with 45 degree steps and the sketch's costs. Changed for scale: the
   search arrays are allocated once and reused, with the typed binary heap
   `views/contours.js` already has, and each search is held to a window
   around its two ends. Links are routed in the order the layout gives
   (placed links first, then back links by level), and each route is
   re-routed twice. Then lanes, and rounded bends.
5. **In the worker** (`views/layout-worker.js`): layout, cells and routes,
   cached by the same key as today's layout.
6. **Drawing** (`views/gridmap.js`, an SVG like the current map):
   - blocks with the glyph for the kind of note and the four states;
   - folder walls on grid lines with cut corners, one tone lighter per level,
     titles in their own row;
   - reached ground lighter with a dotted edge;
   - one trunk per pair of top-level folders with its count at overview, and
     a folder in focus showing its own links singly;
   - a folder whose cells would fall below a threshold on screen drawn
     closed, as one titled block;
   - pan, zoom, click a folder to zoom to it, click a note to select it.
7. **The setting:** `folders = "grid"` under `[map]` and in More options.
   `contour` stays the default until T63.
8. **Tests and timing.**
   - Unit tests for the cells and the router: the same input gives the same
     routes, no route enters a block or a title row, every route ends on a
     block edge.
   - The bench gains `grid_layout_ms` and `grid_routes_ms`, on dg (63 notes)
     and field (1,186 notes).
   - The Tuning summary reports crossings and the share of route beside
     another route, as `GridExperiment` measures them, so the DAG layout can
     be compared with the placeholder on the same numbers.

Not in this task: the searched layout (`design/tools/gridopt.mjs`), free-form
folders, dragging and pinning.

# Acceptance

- With `folders = "grid"`, this repository's bundle and the dg bundle draw
  as a grid Atlas that matches the sketches in structure: blocks, nested
  rectangular folders, trunks with counts, a folder in focus.
- Layout and routes run in the worker, and their times on dg and field are
  recorded here.
- The other folder shapes behave exactly as before.

# Outcome

Built on 2026-10-06, on the branch `grid-dag-view`; not committed. Left
`active` until the walkthroughs have been run (see Not checked).

- **Chosen with** `folders = "grid"` under `[map]`, or Folders: Grid under
  More options. The Atlas tab then draws `views/gridmap.js`. Contour stays the
  default, and study paths and tours are still drawn by the continuous Atlas.
- **The layout interface** is plain data, described at the top of
  `views/grid/snap.js`: the grid's size, a block per note and folder (parents
  before children), and each link with its level and whether the layout
  placed it. `gridLayout` in `views/layout.js` is the one function T64
  replaces.
- **The placeholder layout** (`grid/snap.js`) is the sketch's: the smooth
  layout's positions snapped to cells. One change: the sketch's search for a
  scale assumed its own units, so it now starts where a folder's spread is
  one cell.
- **Cells** (`grid/cells.js`) and **routes** (`grid/router.js`) as planned,
  in the worker. Three changes from the sketch, all for scale:
  - the search's arrays are made once per layout and each search is held to
    a window round its two ends;
  - the distance left is overstated by 1.6, which visits a seventh of the
    cells for routes 3% longer;
  - the charge for a crowded cell stops rising at 3 routes, and each route
    reconsiders twice only up to 100 routes (once up to 300, then not).
- **Drawing:** blocks with the kind's glyph and the four states, the title
  from a cell size of 10px; nested walls with cut corners, a tone lighter per
  level; reached ground lighter; trunks with counts at overview; a folder in
  focus with each of its links singly and the other trunks quiet; lanes; a
  folder drawn closed, as one titled block, until it is `detail` wide on
  screen. Click a folder to zoom, a note to select and again to open, empty
  space to step out. The panel's key is the grid's own.
- **Different from the sketch:**
  - The edge of reached ground is a plain line, not dotted: thousands of dots
    repainted at 12 frames a second against 55.
  - The grid's dots are the page's background, not an SVG pattern, and
    appear from a cell size of 8px.
- **Timed** (`bench/run.py --folders grid`, which is new; this codespace,
  headless Chromium, generated bundles):

  | | Layout | Routes at overview | Frames a second, desktop | Phone |
  |---|---|---|---|---|
  | subject, 63 notes | 266 ms | 44 ms (19 trunks) | 54 | 55 |
  | field, 1,186 notes | 1,156 ms | 513 ms (15 trunks) | 47 | 56 |

  The continuous Atlas on the same machine: 58 and 52 frames a second on
  desktop. The dg bundle is not on this machine, so it is not timed.
- **The Tuning summary** reports the grid's size, routes, crossings, cells of
  route and the share beside another route. On the 63-note bundle at
  overview: 19 trunks, 14 crossings, 321 cells, 49%.
- **A limit found:** route time rises steeply when nearly every pair of
  folders is linked. 125 trunks among 41 folders took 1.5 s, but 299 took 35 s
  (a unit-test bundle, since made realistic). Real bundles here had 12 to 19.
- **Checked:** 14 unit tests in `grid/grid.test.js` (layout, cells, routes,
  the same result for the same bundle, a thousand notes); the app's 35 tests
  and its type check; by eye on this repository's bundle and the two
  generated ones.
- **Not checked:** the walkthroughs (`mise run e2e`), because their test bed
  (the differential geometry bundle) is not on this machine. No walkthrough
  check for the grid has been written. `map.js` gained exports, the Grid
  choice and an optional key, so the continuous Atlas should be walked
  through once before this is called done.
- **Left for T63:** the selection card and a selected note's own links,
  hover, study paths and tours, the label budget, hiding what is not
  reached, the phone layout, keeping notes in place. More options still
  lists the continuous Atlas's settings, most of which do nothing on the grid.
