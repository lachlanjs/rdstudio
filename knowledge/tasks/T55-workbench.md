---
type: Task
title: "T55 — The workbench"
description: "Problem, answer and the teacher's margin in three columns, cards level with their words and joined to them by leader lines in each pen's line style; four exercise states."
tags: [task, m12, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T09:00:00Z }
---

# Prompt

Step 4 of the redesign; sketches MarginaliaWorkbench and MarginaliaWorkbenchLight.

# Outcome (2026-10-05)

- **An exercise is the workbench:** the whole width, in the Practice space
  (the shell puts a `/k/` route for an Exercise note under Practice), from
  the sketch MarginaliaWorkbench.
  - **A breadcrumb:** Practice / the set / the exercise's number and title,
    and "Edit the exercise", which opens the note editor in the Library
    frame.
  - **Three columns:**
    - **The problem:** title, what it is for and what it tests, its state
      once tried, and the problem.
    - **Your answer:** for a written answer, Hint, Feedback and Discuss
      above the live-preview editor. For a choice or value, the answer and
      "Show your working".
    - **The teacher's margin**, for written answers, or Your attempts for
      the others.
  - **A footer under the answer:** the draft's state, Versions (a popover
    that also holds "Keep this version"), Show the solution, then Mark it
    yourself and Ask an agent to mark it (or Check).
  - **The verdict, the solution and marking** follow in the answer column,
    as before.
- **The margin** (`TeacherMargin`):
  - **One card per pin,** headed by the mode (Hint 2 of 3, Feedback,
    Discussion). Each quotes its words, and a quote shows its passage in the
    answer. A discussion card says what you asked and what the teacher said.
    Every card's foot names the version it answered, with restore and its
    cost.
  - **Cards with an anchor** sit level with their words and are ordered by
    where those words are. Replies pinned to nothing come first.
  - **Leader lines** in each pen's line style (red solid, green double, blue
    dotted, a hint thin and neutral) run from the words' end into a gutter
    beside the margin and into the card. Lanes are offset so they do not
    overlap.
  - **Replanned** when replies arrive, the answer changes, fonts load or the
    window resizes. Under 860 px the cards stack after the answer.
  - "What the teacher saw, last time" sits under the cards.
- **Code:**
  - `TutorSession` holds the turns, the reply streaming in and what was seen,
    shared by `TutorTools` (the buttons, confidence and the question, above
    the answer) and `TeacherMargin`.
  - `TutorPanel` is gone.
- **Layout:** three columns above 1240 px; problem above, answer and margin
  below, down to 860 px; one column under that (the phone workbench is
  T58).
- **Checked:** `e2e/teacher.py` (91), updated for the new layout and
  checking that the margin draws leader lines in all four styles; every
  other walkthrough and suite.
