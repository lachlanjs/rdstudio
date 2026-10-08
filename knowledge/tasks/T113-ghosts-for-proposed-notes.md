---
type: Task
title: T113 — Proposed new notes and folders drawn on the map before they exist
description: A note Axis proposes is drawn as a ghost at the folder it would join, a new folder as a
  ghost folder, and a note in no folder as a ghost in free space.
tags: [task, m18, assist, atlas, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T23:44:44Z}
---

# Prompt

The developer, 2026-10-09: "If they are additions of new notes, then it
would be nice if they link to the folder they would add to … If a new note
belongs to no folder then perhaps it can appear as a node in free space."

After [proposals on the map](/tasks/T112-proposals-on-the-map.md "requires").

# What is wanted, as the agent reads it

| Proposal | On the map |
|---|---|
| A new note in a folder that exists | A dashed ghost node at that folder |
| A new note in a new folder | A dashed ghost folder holding the ghost node |
| A new note in no folder | A ghost node in free space, at the top level |

A ghost can be chosen, which brings its card into view. Accepted, it
becomes the real note where the layout puts it; rejected, it goes.

# What stands in the way

- **A note with no folder is refused today.** `propose_note` answers "a
  note goes in a folder" (`fresh()` in `packages/cli/src/proposals.ts`).
  That was too strict: notes at the top are legal, this base has
  `overview.md` there, and the map draws them. To lift.
- **The layout is worked out from notes that exist.** A ghost has no place
  in it.

# The choice of how, made by the agent

Offered to the developer on 2026-10-09 as the one design choice; they said
"Go ahead" without choosing, so the agent's recommendation stands until
they say otherwise.

- **Overlay (chosen for the first version).** Ghosts are pinned to the edge
  of the folder they would join, or to free space, and nothing else moves.
  On accepting, the real layout takes over and the note settles in its own
  place, which may not be where the ghost was.
- **Reflow (not chosen).** Ghosts are given to the layout, so each is shown
  where it would land. The whole map then shifts when a proposal arrives
  and again when one is rejected.

# To settle before a plan

- Where on a folder's edge a ghost sits, and what happens with several.
- Where "free space" is on a map that is full: beside the top level's
  frame is the likely answer.
- Whether a ghost shows the links its text would make.

# Plan

(Filled in by the agent before implementation.)

# Acceptance

- Each of the three cases above is drawn, dashed, and told apart from a
  real note at a glance.
- No real note or folder moves when a proposal arrives or is rejected.
- A ghost chosen brings its card into view; its card shows its folder.
- `propose_note` takes a note with no folder.
- Accepted, the ghost goes and the real note appears, with no reload.

# Outcome

Not started.
