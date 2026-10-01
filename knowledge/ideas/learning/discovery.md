---
type: Idea
title: Discovery states and hiding what is undiscovered
description: Each note is undiscovered, discovered, processed or understood by you; views can hide or grey out what you have not reached, and one outline style shows the state everywhere.
tags: [learning, dashboard, map, proposal]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-01T04:00:00Z }
---

# Summary

Proposed by the user on 2026-10-01, for later. Notes and folders have a
**discovery state**: undiscovered, discovered, and then processed or
understood. A **show / hide undiscovered** switch removes what you have not
reached from the tree, map and graph, or shows it greyed out. The state is
shown the same way everywhere: a thin outline box around the open note and
around the map's hover previews, whose colour and style give the state, and
the type of the title in the tree and on the map.

It is the [professional mode](/ideas/learning/professional-mode.md)'s
"coverage overlay" (the fog of war, done as code coverage is), made concrete,
and belongs with [coverage and review](/tasks/T27-coverage-review.md).

# Whose state it is

Discovery is about a person, not a note: the same note is understood by one
reader and undiscovered by another. So it lives in the private
[learner record](/ideas/learning/learner-record.md), as events, not in the
note's frontmatter, which is shared, committed and read by agents. A note
never says "understood"; your record says you understood this version of it.

# The states

| State | How it is reached | Evidence |
|---|---|---|
| Undiscovered | the start | none |
| Discovered | opening the note | the `seen` event the note page already records |
| Processed | you mark it ("I have worked through this") | a `processed` event |
| Understood | you mark it, or an exercise or explain-back passes ([T26](/tasks/T26-exercises.md), [T28](/tasks/T28-explain-back.md)) | an `understood` event, with its kind (autodidactic, interactive, ai) |

- **Tied to versions.** Each event carries the note's content hash, as `seen`
  does. When a note changes meaningfully after you understood it, it shows as
  understood-but-changed, the way a verification goes stale, and
  [catching up on change](/tasks/T29-catch-up.md) can list it.
- **Folders** take theirs from their notes: a folder is discovered once any
  note in it is, and shows how much of it is processed or understood (a
  thin bar, or a fraction on hover), never a single score.
- **Going back down** is allowed (marking a note not understood after all),
  as a later event; the record keeps the history.

# Hiding and greying out

- **Shown** (the default): undiscovered notes and folders are drawn greyed out
  in the tree, map and graph, still clickable.
- **Hidden:** they are left out, but the **frontier** stays: notes one link
  away from something discovered are shown faintly, so there is always a next
  step, as a fog of war shows its edge. Search still finds everything, and
  says when a result is hidden.
- The switch sits with the map's and tree's other display options, is per
  device, and is off whenever the learner record is off.

# How the state is shown

One scheme, reused wherever a note appears (the open note, the map's hover
previews, cards in lists), never colour alone, so it reads in every theme and
without colour vision:

| State | Outline | Title |
|---|---|---|
| Undiscovered | none, or faint dotted (when shown greyed) | faint ink |
| Discovered | thin dashed | regular |
| Processed | thin solid | regular |
| Understood | solid, in the accent, slightly heavier | semibold |
| Understood, since changed | solid with a gap or corner mark, in the stale colour | semibold |

The title's weight carries the state in the tree and on the map, where an
outline would be noise. That channel is free: the tree's dots already show
**trust** (whether the note is verified), which is about the note, not about
you, and the two must not be confused.

# Principles

From [professional mode](/ideas/learning/professional-mode.md): private by
default, off until switched on, no streaks, praise or animation, states only
from evidence or your own marking, never from time spent, and every part can
be turned off.

# Open questions

- Should "processed" and "understood" both exist, or is one enough to start
  (with understood reserved for evidence from exercises)?
- Should agents be able to mark a note processed for you (after a tutoring
  session), and if so, recorded as their marking, not yours?
- In team use, may a person share their states with a supervisor, and how is
  that kept a deliberate act?
- Does "discovered" need more than opening (reading to the end, a minimum
  time)? The principles argue against time spent; opening is honest about
  what it is.
