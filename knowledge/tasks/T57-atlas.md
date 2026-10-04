---
type: Task
title: "T57 — The Atlas"
description: "New markers, lenses one at a time, trunks with counts, terrain baked in the worker, north as later in the study order, and a layout that keeps notes in place. Contour folders and downhill routes follow in T60."
tags: [task, m12, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T09:00:00Z }
---

# Prompt

Step 6 of the redesign; sketches under Atlas in design/project.

The second step (contour folders and downhill routes) became
[T60](/tasks/T60-atlas-contours.md), so each task is one commit.

# Outcome (2026-10-05)

On the existing engine (circle packing, gates and corridors), as the sketches
under "Atlas · one question at a time" ask; details in
[the map's design](/design/map-view.md).

- **Markers:** the shape is the kind of note, as before. Fill and ring are
  where you stand:
  - not reached is a faint outline, a little smaller;
  - opened is an outline;
  - worked through is filled;
  - understood is filled with a double green ring;
  - a solid red ring means an exercise testing the note was missed.

  A landmark is larger, and a reference is a barred circle.
- **Lenses, one question at a time:**
  - Links (on by default) draws one trunk per pair of top-level folders,
    with its count. These are requires-links only, with implied ones hidden.
  - A folder in focus adds the links inside it, keeps its own trunks and
    fades the rest.
  - Links off leaves the terrain and folders.
  - A selected note shows only its own links, in the blue pen: large dots
    for what it requires, small for what builds on it.
  - Understanding switches the terrain.
  - The old behaviour (every link, with its filters) is kept under More
    options as "Every link".
  - A sentence under the key says what is drawn.
- **Selecting:** clicking a note selects it and opens a card level with it,
  joined by a leader in its pen. The card gives where you stand, how many
  notes it requires and how many build on it, and the actions Open the note,
  its exercise and Study path. Clicking again, double-clicking or Enter opens
  the note; Escape lets go. This changes the old behaviour, where a click
  opened the note.
- **Terrain:** baked per top-level folder on a 112-cell grid in the layout
  worker (`views/terrain.js`), and cached by positions and values. Drawing it
  only transforms the cached paths.
  - It has the normalised height, the four contours, the fog stipple and the
    frontier hachures.
  - It steps back while links carry the detail.
  - A bake is about 3 ms per folder whether it holds 60 notes or 3,000
    (timed in Node).
- **North:** the force from the sketch's layout, from each note's depth in
  the chain of requires- and uses-links. The north arrow shows where there
  is an order; project mode turns it off. Layout cache version 3.
- **Keeping notes in place:** after a change of contents, the layout starts
  from where items sat before (from the view, or on opening from the layout
  kept in the browser) and settles gently.
- **Folders:** top-level folders now open at overview (`detail` 60), each
  with its name and count on the arc outside the wall.
- **Measured** (bench, desktop, dark, the Node server, against the build
  before this task):

  | | dg, 63 notes | field, 1,186 notes |
  |---|---|---|
  | First map | 143 → 172 ms | 161 → 186 ms |
  | Settled | 197 → 227 ms | 501 → 471 ms |
  | fps while moving | 58.5 → 60 | 54 → 60 |
  | Frame p95 | 16.8 → 16.7 ms | 33 → 16.7 ms |

  The first render costs more because more folders are open. The bench has
  no learner record, so its renders carry no terrain.
- **Not done:**
  - grid references and the graticule;
  - the Activity and Health lenses (T59);
  - contour folders and downhill routes (T60);
  - a Goal chip (goals are on Today and Practice; a note's study path is on
    its card).
- **Checked:** `e2e/learn.py` (64): terrain and fog, trunks with counts, the
  sentence, north, selecting a note and its card, Links off, Escape, and
  Open the note. Every other walkthrough and suite passes.
