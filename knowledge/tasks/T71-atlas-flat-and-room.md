---
type: Task
title: "T71 — The Atlas: a folderless view, room for routes, a panel that folds"
description: "An optional view of the whole base as one layered DAG with each note's folder as a colour on its edge; half as much room again between notes and folders, with routes kept clear of what they pass; the lens panel folds to a bar; and the Atlas maps the notes by default in project mode too."
tags: [task, m13, atlas, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-07T10:00:00Z }
---

# Prompt

From the developer, 2026-10-07:

- An optional "folderless" view: treat the knowledge base as one big graph,
  colour an edge of each node by its folder, find a close-to-maximal DAG, lay
  it out by the Sugiyama method with the grid's routing, then add the
  remaining links back.
- The margin between nodes and folders 50% bigger, and a margin for routes:
  if a node's margin is half the least distance between two nodes, a route
  keeps 66% of that, which leaves a third of the gap for routes.
- The Atlas's settings collapsible.
- Mapping a codebase on the Atlas is "somewhat shaky"; Project features
  should stay with the knowledge base and agents' workflows.

# What was built

On the branch `feat/atlas-flat`, off `grid-dag-view`.

- **Folderless (`folderless`, More options, Folders: None):** the model is
  flattened so that every note is an item of the root, and the layout that
  each folder already used ([T64](/tasks/T64-dag-layout.md)) lays out the
  whole base: a greedy order with as much weight of link forwards as
  possible (Eades, Lin and Smyth), layers, order by sweeps, trunks on
  tracks. Links against the order are back trunks, routed afterwards by the
  router and drawn dashed. Each note has a strip of its top-level folder's
  colour down its first edge (`--f0` to `--f7`, no pen's colour), the
  folders are named with their colours where the breadcrumbs are, and a
  note's tip says where it is filed.
- **Room:** neighbours in a layer, layers, and folders stand 6 cells apart
  (they were 3, 4 and 4), and a folder's wall is 5 from its contents (3).
  Six, not 4.5 or 5, so that the thirds are whole cells.
- **Clearance (`KEEP`, 2 cells, `grid/cells.js`):** a trunk's track sits in
  the middle of its channel and never nearer a row than 2 cells; a lane
  passing a row keeps 2 from the items beside it; and the router pays `hug`
  for each cell within 2 of a note or of a folder's wall, so a back link or a
  link lit under the pointer stands off what it goes round. A third of each
  gap is left to run in.
- **The panel folds:** its heading is a bar with Hide or Show; folded, it
  names the lenses that are on. It stays as it was left (`panelOpen`).
- **Notes by default:** the Atlas maps the knowledge base in project mode
  too. The code map ([T66](/tasks/T66-code-map.md)) is still there under
  Map: Code. Changing what is mapped makes the panel again, so its key and
  lenses fit.

- **Follow-up, 2026-10-07:** the folders and their colours are a list down
  the right, one to a line, that folds to its heading (`foldersOpen`). A
  note pointed at lights what it requires in the blue pen, as before, and
  what those require in turn, all the way back, fainter, thinner and in
  another colour (`--far`), with fainter frames on those notes: the note's
  own requirements stand out from the whole tree under them.

# Checks

Unit tests for the clearance (no trunk within 2 cells of a note it passes,
both flows) and the folderless layout; the code walkthrough covers the
default, Folders: None, and folding the panel (19 checks).

# Not done

- Folderless on the code map leaves out links that end on a file or class.
- No focus on a folder in the folderless view (there are none to zoom to).
