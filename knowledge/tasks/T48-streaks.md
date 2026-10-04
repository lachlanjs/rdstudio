---
type: Task
title: "T48 — Streaks"
description: "Daily and weekly streaks for recall, new learning, problem solving and all three, with reprieves, derived from the learner record and shown on the Learn tab."
tags: [task, m11, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-04T10:00:00Z }
---

# Prompt

See [streaks](/design/streaks.md).

# Outcome (2026-10-04)

- **The rules:** `streaks()` in the core, a pure function over the record.
  The caller numbers local days, starting at 4 a.m.
  - **Replaying the schedule:** it replays the review schedule day by day, so
    "due at the day's start" is what it was then.
  - **Recall:** practise as many due notes as were due, up to three. Recall
    and fill-the-gap drills count, and so do exercises testing a note in
    review. A day with nothing due is a rest day.
  - **New learning:** a note first worked through or understood, by marking
    or by evidence.
  - **Problem solving:** any answer that is not a give-up, whether or not
    the exercise names notes.
  - **All three:** the same day, with recall's rest days counting.
  - **Reprieves:** one per 7 days kept, banked up to two, and used by
    themselves on a missed day.
  - **Weeks:** Monday to Sunday, counting with `[learner] week_days` days
    (default 4). The week in progress never breaks the streak.
- **The dashboard:** four tiles at the top of the Learn tab (all three
  first). Each shows the current run, whether today is done, this week's
  days against the target, the run of weeks, the best, and reprieves banked.
  A folded calendar of the last five weeks of "all three" marks counted,
  reprieve and missed days. With the load note showing, the tiles say the
  streaks are safe for today.
- **Checked:** 6 core tests (the 4 a.m. boundary, give-ups, reprieves earned,
  used and capped, first reaching, recall with rest days and due notes,
  weeks); `e2e/teacher.py`, 3 more checks (63 in all).
