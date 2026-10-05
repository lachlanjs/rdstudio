---
type: Task
title: "T63 — The grid Atlas"
description: "A third folder shape: everything on a coarse square grid, notes as blocks, folders as free-form regions, layout and routes searched together, routes in lanes with over and under."
tags: [task, m13, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T15:00:00Z }
---

# Prompt

Step 3 of M13; sketches GridAtlas, GridFreeAtlas, GridLooseAtlas and
GridExperiment, and `design/tools/grid.mjs` and `gridopt.mjs`.

Decided with the developer (2026-10-05): the searched layout runs both in the
background (in the worker, within a budget, cached and warm-started) and from
a command that bakes it into the repository ([T65](/tasks/T65-atlas-bake.md)).

# Outcome (2026-10-05)

`app/src/lib/views/grid.js`, ported from the design's `grid.mjs` and
`gridopt.mjs`, and drawn by `map.js`. Choose it under More options: Folders,
Grid. Contours stay the default until the grid is timed at scale.

- **Snapped at once:** the smooth layout's positions, snapped to cells with
  the design's gaps (2 between notes, 3 between folders). A note is an 8 by 2
  block, or larger with many links.
- **Searched in the worker:**
  - Simulated annealing over note positions, with the design's "loose,
    routes apart, north kept" weights. Folders become free-form regions.
  - The number of moves is fixed by the budget (`gridBudget`, 4000) and the
    map's size, so the result is the same on every machine. It comes to
    about 22,000 moves (about 5 s) for the 63-note test bed.
  - The result is kept in the browser (`rdstudio.grid`). After a change of
    contents the search starts cooler from the kept places, so the map keeps
    them.
  - The design's second pass, judging moves by real routes, is left out for
    time.
- **Routes:** A* over cells with 45 degree steps, each re-routed twice once
  the others are down, in lanes, drawn over each other with a halo gap.
  Trunks at overview carry counts. A folder in focus shows its own links
  note to note, and links leaving it run from the note itself to the other
  folder, as in the design.
- **Drawing:**
  - Floors one tone lighter per level, walls on the region's outline, and
    reached ground as a lighter tone with a dotted edge.
  - Notes as blocks: faint, outlined, filled, filled with a double green
    rule, or framed red. Each carries the glyph of its kind.
  - Names inside blocks once cells are big enough, and folder titles in
    their reserved row with reached counts.
  - The Station theme draws walls and dots in its cyan.
- **Shared with the rest of the Atlas:** the panel, lenses, selection and
  card, zooming and focus, and the folder card. On the grid, every node's
  x, y and r are those of its cells, and the smooth positions come back when
  the grid is left.
- **Not done or not timed:**
  - At about 1,200 notes the search's moves cost far more, so the snapped
    grid is what you mostly see; it stops at four times the budget. A
    folder-by-folder search is the fix.
  - The snapping runs on the main thread.
  - Not done: dragging and pinning blocks, over and under between routes in
    different cells, and a hex grid (all marked "not yet" in the design).
- **Checked:** `e2e/learn.py` (72):
  - blocks, regions and routes on the grid;
  - the searched layout kept in the browser;
  - selecting a block;
  - back to contours with nothing of the grid left behind.

# Follow-up (2026-10-05): faster, roomier

The developer found the Atlas too slow, the folders too compressed and the
contours too tightly packed, on the grid.

- **Too slow:** on rdstudio's own notes (about 120) the grid blocked the
  page for up to 112 s.
  - Its routes now run in the worker (plain typed arrays, `routeCells`);
    a set of routes is drawn when it arrives.
  - Each A* search keeps to a window around its ends.
  - There are fewer re-routing passes when there are many routes.
  - The search checks the clock on every move, stops at 1.5 times its
    budget, and its move count is calibrated to finish within the budget
    (3 s by default). It starts cool on big maps.
  - Now rdstudio's grid settles in 0.4 s, the search takes 0.5 s, routes
    0.25 s, and there are no long tasks.
- **Compressed:** a big folder (Tasks, 67 notes) was snapped over a 232 by
  236 box, because its tightest scale started from where two near-coincident
  notes put it. Its region then broke into islands.
  - The scale now starts from the blocks' own area, and falls back to rows
    in the smooth layout's order.
  - The snapping keeps the gaps the search asks for (5 cells between notes,
    6 between folders, walls 3 in).
  - Regions reach a cell further, with 3 cells between nested walls (not 2)
    and rounder outlines.
  - Blocks are 11 cells wide, so names read.
  - Top-level names are always shown, in full, over a halo.
- The browser's kept layout is versioned (`rdstudio.grid.3`), so older,
  tighter layouts are not reused.
