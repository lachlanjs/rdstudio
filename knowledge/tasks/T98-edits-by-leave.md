---
type: Task
title: "T98 — What Axis may change in a note: a marked passage, a place for new text, or anywhere"
description: "A turn says what it is about and what it may change: a passage marked in the note
  (read only unless let), a separate place for new text, or the whole note, where the model chooses
  its own insertions, rewordings and deletions; every change is a suggestion."
tags: [task, m15, editor, assist, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T00:57:58Z}
---

# Prompt

The developer, 2026-10-08: "It should be possible to highlight text relevant
to the question, specify if the agent is welcome to edit that selection, and
select a place for text insertion *separate* from the highlighted text. It
should also be possible to ask the agent to make a general edit to a note,
selecting its own places for text insertion, modification, deletion, etc."

# Plan

See [the decision](/decisions/assist-changes-by-leave.md "requires").

1. Places in the editor (`app/src/lib/editor/places.ts`): while the panel is
   open, a selection made in the note becomes the passage and stays marked
   when the cursor moves on; "Put new text at the cursor" sets a place apart
   from it. Both move with the text; a passage typed over is gone.
2. Two ticks: "Axis may change it" (the passage) and "Axis may edit anywhere
   in the note". Both off unless ticked.
3. The request carries the passage (`from`, `to`), the place (`at`) and
   `may`. The note is sent with ⟦passage⟧ and ⟦HERE⟧; the reply's form
   offers only what is let: `<insert>`, `<passage>`, or `<change>` blocks of
   `<old>` and `<new>`.
4. The server reads the reply (`parseChat`): each `<old>` must be found in
   the note in one place; what is not let, not found, found twice,
   overlapping or cut short is dropped and said.
5. Several suggestions at once in the note (`suggest.ts`), each accepted or
   rejected in the note or in the panel, or all together.

# Acceptance

- A passage marked and not let: the model is told to leave it, and a
  rewrite it sends anyway is not offered.
- A passage and a place: the text is proposed at the place.
- Let edit anywhere: changes in several places, accepted together.

# Done

2026-10-08, on `feat/axis-panel`. All of the plan.

- A change proposed while the note was being typed in is placed again by
  its old text, or said to be lost.
- Asking again rejects what was still waiting, so the note sent is the note
  as it stands.
- Whole-note editing is refused over 60 000 characters, a passage over
  40 000.
- Checks: 2 unit tests of the reply and the marks (server), 2 of the places
  and the suggestions (editor), `e2e/assist.py`.

# Limits

- Not tried against a real model: how reliably a model copies `<old>`
  exactly is the open risk. A miss costs that one change, never a wrong
  edit.
- Old "Rewrite" and "Write here" are now a tick or a place, then Ask: one
  more click than before.
