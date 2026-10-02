---
type: Task
title: "T26 — Interactive exercises"
description: "Offline exercises checked by the dashboard: fill the gap, placement, landmarks named and placed, recall with a self-grade."
tags: [task, m8, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T09:20:35Z }
---

# Prompt

Results go to the learner record. See the exercises in
[tours and exercises](/ideas/learning/tours-and-exercises.md).

# Outcome (2026-10-02)

Practice (`#/practice`, from the Learn tab): short rounds of up to ten,
checked by the dashboard, offline, on notes from everywhere or one folder.

- **Recall:** a note's title and folder; recall what it says, then Show the
  note (description and sections) and grade yourself: missed it, partly, got
  it. Notes due for review come first, then landmarks, then notes you have
  opened.
- **Fill the gap:** a hidden note's folder and the notes it links to and
  from; choose it among four (the others never among the clues, and from the
  same part of the map where possible).
- **Placement:** a note's title and description; choose its folder among
  four, its sibling folders first since they are the near misses.
- **Landmarks:** name the landmarks from memory (`landmark: true`, or the
  most linked-to notes when none are marked), allowing a slip or two in
  longer names; Show the rest lists those not named.
- Each answer is an `exercise` event (`exercise`, `concept`, `result`: got,
  partly or missed; interactive). Recall and fill the gap are **evidence**:
  a right answer makes a note understood and schedules its next review
  (T27). Placement and landmarks are practice, recorded but not evidence,
  since naming or placing a note is not understanding it.
- No scores or streaks: a round ends with what was got, partly got and
  missed, linked to the notes.
- Placed on its own page rather than on the map: a card works the same on a
  phone, and the answer links to the note and its place on the map.
- Checked: `e2e/learn.py` (12 more checks: each exercise, its event, and the
  phone).
