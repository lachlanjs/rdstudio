---
type: Task
title: T94 — Ask Atlas keeps its questions and replays them
description: Each question asked on the Atlas is kept with its answer in the learner record; a list
  of them is in the Axis panel, and one whose notes and links are still as they were is replayed on
  the map.
tags: [task, m15, atlas, assist, learner, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T23:11:18Z}
---

# Prompt

The developer, 2026-10-07: "Previous questions and answers should be saved
somewhere and a catalog of previous questions should be available - if the
original notes and links found by the agent in answering the question are
still intact, the thought process in the Atlas (finding and linking of
notes) and the zoom animations etc should replay."

Where they are kept: the private learner record, agreed the same day
([the decision](/decisions/ask-atlas-keeps-questions.md "requires")).

# Plan

1. The server keeps each finished answer in the learner record, under
   `atlas/asks/`, one JSON file each: the question, where it was asked
   from, the answer, the steps, the notes it rests on, the usage, and a
   fingerprint of each note opened or rested on.
2. `GET /api/atlas/asks` lists them, newest first; `GET` one returns it
   with what has changed since: notes gone, notes changed, links followed
   that are no longer there, and each quoted sentence checked again.
   `DELETE` forgets one.
3. The [Axis panel](/tasks/T93-axis-panel.md "requires") has a list of
   past questions. Opening one shows its answer.
4. Replay: the steps are fed to the map one at a time at a set pace, so the
   marks, the routes and the moves of the view happen as they did. Steps
   carry no times, so the pace is not the original.
   - Everything as it was: the whole replay.
   - A note changed: replayed, the note flagged, its sentence re-checked.
   - A note or a followed link gone: the answer as text, with a line saying
     what is missing; what is still there is marked without the replay.
5. Not kept where the learner record is off; the panel says so.

# Acceptance

- A question asked is in the list after a reload, and replays.
- With a note it rests on edited, the replay flags that note.
- With such a note deleted, the answer is shown with what is missing named
  and nothing throws.
- Forgetting one removes its file.

# Done

2026-10-07.

- Each finished answer is kept as one JSON file under `atlas/asks/` in the
  learner record, with a fingerprint of every note it opened or rests on.
  Nothing is kept where the learner record is off, and the panel says so.
- With nothing asked, the panel lists the questions asked before, newest
  first, each with when, where from and what it cost. One can be forgotten
  from the list or from its answer.
- Opening one plays it again: the lookups arrive one every 0.7 seconds, so
  the marks, the routes and the moves of the view happen in order, then the
  answer, its passages and its cost. The model is not asked again. "Play
  again" repeats it. With reduced motion it is shown at once.
- A note changed since is flagged, and its sentence is checked again: one
  no longer in the note is not shown as a quotation.
- A note gone, or a followed link gone, stops the replay: the answer is
  shown as it was, with what is missing named, and what is still on the map
  is marked.

Routes: `GET /api/atlas/asks`, `GET` and `DELETE /api/atlas/asks/{id}`.
Code: `packages/cli/src/atlasasks.ts`.

Checked by `e2e/ask.py` and a unit test of keeping, reading back and
forgetting.

Limits: an answer stopped or failed is not kept. A question asked in the
code view is kept, but has nothing to replay there.
