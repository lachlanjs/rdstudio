---
type: Task
title: "T72 — The Atlas: feeders, where a trunk's links come from inside a folder"
description: "Where a trunk ends on a folder, branches run inside it from each item holding some of the trunk's links to the trunk's foot on the wall, with their counts, and on into subfolders, so a trunk between two folders can be followed down to the notes at each end."
tags: [task, m13, atlas, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-07T12:00:00Z }
---

# Prompt

From the developer, 2026-10-07. Trunks join folders at the same level and
count the links between them. With folders A and B inside C, D inside E, and
a trunk between C and E: draw trunks from the edges of A and B to the base
of that trunk on C's side, and from D to its base on E's side; the same for
notes in C and E beside those folders, as ordinary connections. "It would
help explain visually where to expect connections between folders to come
from."

# What was built

On `feat/atlas-flat`.

- **Feeders (`layout.js` `feeders`):** each end of a drawn trunk that is a
  folder is a stem. The trunk's links are grouped by the folder's item (a
  note or a subfolder) that holds their end, and from each item a branch is
  routed to the trunk's foot, the cell just inside the wall where the trunk
  arrives. The item with the most links goes first; each one after may stop
  on a branch already there, so the branches to one foot join like a tree.
  A branch from a subfolder is a stem in turn, fed from inside it, down to
  the notes. Each carries its count, and the counts at a foot add up to the
  trunk's.
- **Routing:** the same router as back links (8 directions, the 2 cells of
  clearance of [T71](/tasks/T71-atlas-flat-and-room.md)), now able to end on
  a set of cells (`routeTo`), with the layout's own trunks counted as in use
  so branches keep off them. Feeders are part of the layout, worked out in
  the worker and kept with it: 17 ms more for 75 notes, 233 ms for 1,056.
- **Drawn** inside a folder that is open, a little quieter than trunks, with
  smaller counts. Feeders in More options turns them off (`feeders`).

- **Follow-up, 2026-10-07** ("way too messy" with a branch from every
  note):
  - Only the branches from subfolders are drawn. Those from notes are
    still worked out (after the subfolders', which never join one) and kept
    in the layout as `leaf`, each with the branch it joins (`via`).
  - **Trace along trunks (`traceTrunks`, More options, off by default):** a
    link to another folder, lit when a note is pointed at, is drawn the long
    way: out from the note required along its feeders to the trunk, along
    the trunk, and in along the feeders at the other end, with the same
    animation. Off, it runs the short way through the walls, as before.
    Where part of the way is not drawn (a back trunk), the short way is used.
  - A folder's wall is 8 cells from its contents (it was 5), half as much
    again, for the feeders that run inside it.

# Checks

Unit tests, both flows: every drawn trunk ending on a folder is fed, its
feeders start on items of that folder and their counts add up to the
trunk's; a feeder stays inside its folder, crosses no note, and the first to
each foot ends on the wall where the trunk does. The code walkthrough checks
they are drawn.

# Not done

- A back or implied trunk (found by the router when shown) has no feeders.
- On the code map, a link that ends on a file or class itself is counted by
  its trunk but has no branch below that file or class.
