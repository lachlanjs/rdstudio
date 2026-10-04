---
type: Task
title: "T54 — Today"
description: "The home screen: streaks, Set for you, Continue where you left off, reviews due, changed since you looked, the teacher's next step pinned to its row, and goals."
tags: [task, m12, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T09:00:00Z }
---

# Prompt

Step 3 of the redesign; sketch MarginaliaToday.

# Outcome (2026-10-05)

- **Today is the home page** (`#/`, `TodayPage`), from the sketch
  MarginaliaToday.
- **The main column:**
  - **The streak strip:** four counters (number first, a filled or empty
    square for today, best when it is above the current run); the week's
    days against the target as segments, weeks in a row, reprieves banked;
    the last five weeks folded beside it.
  - **Set for you:** each open set as its note's title and description
    ("Diagnostic 1: …" split at the colon), its exercises numbered, each
    with its state.
  - **Continue where you left off:** the most recent draft, with its goal,
    the start of the answer, "Continue writing", and the hints used.
- **The margin:** reviews due ("Review them"), waiting for marking, changed
  since you looked, the teacher's next step, goals with exercises passed,
  and a link to the rest (where you stand, tours, reading order) on
  `#/learn`.
- **Four exercise states** (`shownState`): passed (a double green line),
  missed (a solid red line), in progress (bordered: a draft with something
  in it, or an answer waiting for marking) and not tried (faint). Partly
  shows as missed.
- **The next step:** `next.md`, a new teacher file written by the `next`
  skill, with frontmatter `about` and `pen`. It shows as a pin card in its
  pen, level with the row it is about when that row is on the page, joined
  to it by a leader line in the pen's style (on wide screens).
- **Server:** `GET /api/teacher/drafts` lists drafts in progress, newest
  first, with the start of each and its hints.
- **Moved here from the Learn page:** streaks, Set for you and goals. The
  Learn page keeps where you stand, explain-back, practice, tours and the
  reading order.
- **Also:**
  - Maths letters and digits are set in Charter (fonts.css, Math Charter),
    as the brand book asks.
  - Opening an exercise no longer writes an empty draft.
  - A finished set's last exercise links back to Today.
  - The sketch's `.meta` text style is `.caption` here, as `.meta` already
    names the details panel.
- **Checked:** a unit test for the drafts list; `e2e/teacher.py` (90),
  updated so streaks, sets, goals and waiting answers are checked on Today,
  plus the next step written through MCP; every other walkthrough.
