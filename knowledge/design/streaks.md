---
type: Design
title: "Streaks"
description: "Daily and weekly streaks for recall, new learning, problem solving and all three together, counting real work only, with reprieves earned by keeping a streak, all worked out from the learner record."
status: draft
tags: [design, learning]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-04T10:00:00Z }
---

# Purpose

A visible reason to come back each day, pointed at learning rather than at
merely showing up. This reverses an earlier "no streaks" rule; see [the
decision](/decisions/streaks.md).

# What counts

A **day** runs from 4 a.m. to 4 a.m. local time, so late study counts for
the day it belongs to.

| Streak | A day counts when |
|---|---|
| **Recall** | at least as many review notes were practised (recall or fill-the-gap drills, or exercises testing notes already in review) as were due at the day's start, up to three. A day with nothing due counts as a **rest day**: an empty queue never breaks a streak. |
| **New learning** | a note first reached "worked through" or "understood" (by marking or by evidence) |
| **Problem solving** | an exercise answered with real effort: not given up. Hints are fine. |
| **All three** | all three, the same day |

**Weeks** run Monday to Sunday, and count when at least four days counted (`[learner] week_days`). The current week never breaks a weekly streak.

# Reprieves

- One is earned for every 7 days of a daily streak, banked up to two.
- One is used automatically on a missed day, and that day shows as
  "reprieve" on the calendar.
- With none banked, a missed day ends the streak.
- Today is never a miss: until it counts, the streak shows as at risk.

# Derived, not stored

Streaks are worked out from the learner record alone (a pure function in the
core). They are the same on every device and need nothing new synced.

# Kept in check

- When the day's load note shows (well above the usual amount), the Learn
  tab says the streaks are safe for today and suggests stopping.
- The record keeps the evidence. Streaks never count towards understanding.

# Shown

- **The Learn tab:** a row of four counters at the top, with best and
  reprieves banked.
- **A calendar** of the last five weeks for "all three", marking counted,
  rest, reprieve and missed days.
- **Later:** the meta-streak in the phone app's project list.
