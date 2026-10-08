---
type: Task
title: T112 — Axis's proposals marked on the map, with cards and notes linked both ways
description: A proposed change or move marks its note on the Atlas, and each card links to the note
  or folder it concerns, and back.
tags: [task, m18, assist, atlas, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T23:44:34Z}
---

# Prompt

The developer, 2026-10-09: "I would like the proposals shown somewhat on
the map. If they are edits, it would be nice if the cards link to the notes
they edit. If they are additions of new notes, then it would be nice if
they link to the folder they would add to".

After [T101](/tasks/T101-axis-writes-notes.md "requires"), which shows
proposals as cards in the panel only. New notes that do not exist yet are
[T113](/tasks/T113-ghosts-for-proposed-notes.md).

# What exists

- The cards (`proposed()` in `app/src/lib/views/ask.js`). A change's and a
  move's card already names its note as a button that shows it on the map.
- The marks the map draws for an answer (`marks()` there, drawn by
  `gridmap.js`): a ring by how a note was reached, and a fill where the
  answer rests on it. A proposal's step names no notes on purpose, so
  nothing is marked for one.
- `map.show(id)` zooms to a note's folder and selects it. There is no
  call to zoom to a folder by name from the panel.

# What is wanted, as the agent reads it

| Proposal | On the map | The card links to |
|---|---|---|
| A change | The note carries a "change proposed" mark | The note |
| A move | The note is marked, with a line to the folder it would go to | The note, and that folder |
| A new note | See T113 | The folder it would be added to |

- **Both ways:** choosing a marked note on the map brings its card into
  view in the panel.
- **As it is settled:** an accepted or rejected proposal loses its mark.

# To settle before a plan

- What the mark looks like, apart from the marks for found, reached,
  written and rested on. A fourth colour is one more thing to read.
- Whether a move's line is drawn by the router, as links are, or straight.
- Whether a kept question opened later shows its unsettled proposals'
  marks.

# Plan

(Filled in by the agent before implementation.)

# Acceptance

- A proposed change marks its note on the map, and the mark goes when the
  proposal is accepted or rejected.
- A proposed move marks its note and shows where it would go.
- Each card has a link that shows its note on the map; a new note's card
  has one that shows its folder.
- Choosing a marked note brings its card into view.
- The key under the answer explains the mark.

# Outcome

Not started.
