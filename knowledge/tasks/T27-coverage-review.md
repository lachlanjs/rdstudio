---
type: Task
title: "T27 — Coverage and review"
description: "Show on the map what you have shown you understand; a capped spaced-review queue; a quiet load indicator."
tags: [task, m8, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T09:20:35Z }
---

# Prompt

The sensor, P, I and D of the [PID feature map](/ideas/learning/pid-feature-map.md),
following [professional mode](/ideas/learning/professional-mode.md).

# See also

- [Discovery states](/ideas/learning/discovery.md) (proposed 2026-10-01):
  undiscovered, discovered, processed and understood per note, kept in the
  learner record; show or hide what is undiscovered; one outline scheme for
  the state on notes, map previews and titles. A concrete form of this task's
  coverage overlay.

# Outcome (2026-10-02)

Built as the [discovery states](/ideas/learning/discovery.md) proposal, all
derived from the learner record by `@rdstudio/core/learning` (pure functions,
unit tested) and shown only while the record is on.

- **States:** not opened yet, opened (a `seen` event), worked through and
  understood. Both of the last two are kept: worked through is your own
  marking; understood is your marking or evidence (a right answer in recall
  or fill the gap, or a marked explain-back). Marking can go back down (Not
  yet). Each state remembers the note's version, so a note changed
  meaningfully since shows as **changed since**.
- **Shown once, the same everywhere:** an outline round the open note's
  title block (dashed when opened, thin when worked through, the accent when
  understood, the stale colour with "changed since" when changed); the
  title's weight and ink in the tree and on the map (faint when not opened,
  bold when understood). Trust keeps the dots. Never colour alone.
- **Your understanding** in the details panel: where the note stands, and
  why (your marking, an exercise, explain-back); Worked through, Understood,
  Not yet; when it is next due for review.
- **Hide what I have not reached**, per device, beside the tree's filter and
  in the map's options (one switch): only notes reached and the frontier
  (one link from one reached, drawn faintly; with nothing reached yet, the
  landmarks and starting notes). Folders with nothing shown go too. The
  tree's filter still finds everything.
- **Learn tab, Where you stand:** coverage per top-level folder, a bar and
  the counts in words, never one score; **Due for review**, at most eight at
  a time (the rest wait, oldest first: anti-windup) with Review them, which
  starts recall with what is due; the next review's date when nothing is.
- **Spaced review:** boxes of 1, 3, 7, 16, 35 and 80 days. A note enters
  review when marked worked through or understood (due a day later) or on its
  first recall; got it moves it up a box, partly keeps it, missed it sends it
  back to the first. Marking it Not yet takes it out.
- **Load:** distinct notes studied today against the median of the days
  studied in the four weeks before (once there are five); said once, on the
  Learn tab, only when today is at least twice the usual and eight or more:
  "22 notes today against your usual 3; consolidation tends to work better
  after a break." No notifications, streaks or praise.
- The Learn tab now leads with where you stand, then practice, tours and the
  reading order.
- Found on the way: the map's zoom read the drawing's width as "100%" after
  the map had left the page (a console error); it now uses the measured
  size, and leaving stops any zoom in progress. Folders holding only tours
  are left off the map.
- Checked: unit tests for the states, review and load, and `e2e/learn.py`
  (17 more checks).
- Not done: the graph view does not show the states yet.
