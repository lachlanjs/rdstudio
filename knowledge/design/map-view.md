---
type: Design
title: Map view
description: Criteria and design for the Atlas, the nested map of a knowledge base, where folders are regions, links are drawn at the scale they belong to, and the terrain shows where you stand.
status: draft
tags: [design, dashboard, map]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-06T03:47:50Z}
---

# Purpose

The graph shows every note and link at once, which stops working as a bundle
grows. The map follows the [nested networks](/ideas/learning/nested-links.md)
idea from the [manifesto](/ideas/manifesto/characterising-complexity.md):
folders are regions, and each link is shown at the scale where it lives. It
sits beside the graph until it replaces it or proves it should not.

# Criteria

Each is checkable by looking at a screenshot or reading the code.

1. **Label budget.** No more labels are shown than can be read: a note
   carries its title only once its block is large enough on screen.
2. **Links at their scale.** A link is drawn between the most specific
   *visible* items containing its two ends. Links inside a closed folder are not
   drawn; links between closed folders are merged into one line whose width
   shows how many it stands for.
3. **Cross-scale links separately.** Links between notes in the same folder and
   links that cross folders can each be shown alone.
4. **Folders are regions.** Every folder is a visible region containing its
   notes and subfolders; nesting is never implied only by lines.
5. **Stable.** The same bundle gives the same layout. (Small edits moving
   little is not met yet: the layout is worked out afresh.)
6. **Progressive detail.** Zooming into a folder opens it and shows its
   contents; zooming out closes it. The detail threshold is a setting.
7. **Orientation.** The current place is always visible as a folder path, and
   stepping out is one action.
8. **Importance is visible.** Landmarks (`landmark: true`) have a heavier
   frame.
9. **Works on a phone** at 390 px wide with touch (pinch, tap).
10. **Theme-aware** and readable in every theme, light and dark.

# Design

The grid Atlas ([T62](/tasks/T62-grid-atlas.md),
[T64](/tasks/T64-dag-layout.md), [decision](/decisions/grid-atlas.md)). It
replaced the continuous Atlas of circle packing, contour folders, downhill
routes and terrain ([T57](/tasks/T57-atlas.md),
[T60](/tasks/T60-atlas-contours.md)), which was retired in
[T63](/tasks/T63-grid-atlas-parity.md); those tasks record how that one
worked. The code is `views/gridmap.js` (the drawing), `views/map.js` (the
model, settings and lens panel) and `views/grid/`.

- **Cells:** everything sits on a square grid. A note is a block of 18 by 5
  cells, room for its whole title on two or three lines. A folder is a rectangle with cut
  corners, 5 cells of margin inside and its title on its top edge; folders
  nest, each level a tone lighter.
- **Room and clearance ([T71](/tasks/T71-atlas-flat-and-room.md)):**
  neighbours, layers and folders stand 6 cells apart. A route keeps 2 cells
  clear of any note or wall it passes (tracks sit mid-channel, lanes stand
  off the items beside them, and the router pays for each close cell), so a
  third of each gap is left for routes.
- **Folderless (optional):** the same layout over the whole base as one
  folder, so every note is in one DAG; a note's top-level folder is a strip
  of colour on its edge, and the folders are listed with their colours
  down the right, in a list that folds away.
- **Under the pointer:** what the note requires is lit in the blue pen;
  what those require in turn, all the way back, is fainter and in another
  colour.
- **Each folder is laid out on its own,** as a layered DAG of its items: its
  notes, and its subfolders, each one block. A link belongs to the lowest
  folder holding both its ends, and there joins the two items that hold
  them. Links between the same two items are one trunk with a count.
- **The DAG:** an order of the items with as much weight of requires- and
  uses-link as possible running from what is required to what requires it.
  Trunks against the order are back trunks. See also links take no part.
- **Layers:** an item sits one layer after the last thing it requires. A
  layer too long for its folder wraps.
- **Flow turns at each level:** the top level runs bottom to top, its
  folders' contents left to right, theirs bottom to top again. On a touch
  device wider than tall the top level runs left to right (`gridFlow`:
  `auto`, `up` or `right`); both are worked out there and kept.
- **Trunks** are drawn on paths the layout makes: out of the late side of
  the item required, along a track of its own between two layers, into the
  early side of the item requiring it. Two items in line are joined by a
  straight run. Bends are cut at 45 degrees.
- **Back trunks** are found a way by the router (`views/grid/router.js`:
  shortest paths over cells in eight directions, turns dear) and drawn
  dashed. A trunk between two notes that a longer way already joins is
  implied, and hidden.
- **Pointing at a note, or selecting it,** lights what it depends on, in the
  blue pen: inside its folder, every link down its chain of requirements;
  beyond it, only what it requires directly, drawn all the way from note to
  note through the walls; and what builds on it directly, dotted. The rest
  steps back.
- **Where you stand** is tone and fill: ground within one cell of a reached
  note is lighter; a block is faint, outlined, filled, or filled with a
  double green rule; a red frame needs work.
- **Detail:** a folder is one titled block until it is `detail` wide on
  screen and a cell is 1.6px; notes carry their titles from a cell of 6px.

- **Height lenses:** what the tones mean, one at a time. **Understanding**
  (the learning default): where you stand. **Activity** (the project
  default): when the note last changed, this week, this month or this
  quarter. **Health**: one step each for reviewed by a person, tested by an
  exercise, and current.
- **A selected note** has a card: where you stand, how many notes it
  requires and build on it, Open the note, its exercise and its study path.
  Click it again, double-click or press Enter to open it; Escape lets go.
- **A study path or a tour** numbers its notes, lights the links among them
  (for a tour, from each stop to the next), and lets the rest step back.
- **Hiding what you have not reached** leaves out those notes and the
  folders holding none.
- **Placing without waiting:** the layout is worked out in a Web Worker and
  kept in the browser, by what the map contains, for each direction of flow.

# Settings

Three layers, each overriding the one before: built-in defaults, the
project's `[map]` table in `rdstudio.toml`, and choices made in the browser
(stored per browser).

| Setting | Default | What it does |
|---|---|---|
| `detail` | 60 | A folder opens when it is this many pixels wide on screen |
| `showLinks` | true | The Links lens: the trunks between the items of each open folder |
| `terrain` | true | Tone the ground and the notes by the height lens |
| `height` | (by mode) | The height lens: `understanding` (learning, needs the learner record), `activity` (project mode) or `health` |
| `source` | `notes` | What is mapped: `notes`, or `code` ([the code map](/design/code-map.md), when the code is indexed) |
| `folderless` | false | The whole base as one layered DAG with no folders; each note carries its top-level folder's colour ([T71](/tasks/T71-atlas-flat-and-room.md)) |
| `panelOpen` | (by room) | The lens panel open, or folded to its bar |
| `foldersOpen` | true | The folderless view's list of folders open, or folded to its heading |
| `hideImplied` | true | Leave out a link between two notes that a longer way already joins |
| `gridFlow` | `"auto"` | The top level's direction: `up`, `right`, or `auto` (up; right on a touch device wider than tall) |

Settings of the continuous Atlas (`folders`, `routing`, `room`, `spacing`
and the rest) are ignored.

Marker shapes by type (case-insensitive; unknown types are circles):
definition circle; theorem, lemma, proposition, corollary diamond; example
triangle; trick square; reference barred circle; overview star; decision square;
task triangle; question cross; idea wye; procedure star. Available shapes:
`circle`, `ring`, `diamond`, `triangle`, `square`, `star`, `cross`, `wye`.

```toml
[map]
detail = 120

[map.markers]
Module = "square"
Interface = "diamond"
```
