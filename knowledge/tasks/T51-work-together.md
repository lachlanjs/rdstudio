---
type: Task
title: "T51 — Work together"
description: "The hint ladder, feedback and discussion pinned to passages of the draft in red, green and blue, hints carried into the answer, confidence, and a replay of the draft."
tags: [task, m11, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-04T10:00:00Z }
---

# Prompt

See [work together](/design/tutor.md), section Modes. Depends on T49 and T50.

# Outcome (2026-10-04)

- **Under a written answer:** "Work with the teacher", with three buttons.
  - **Hint:** climbs a ladder of three rungs (a word, then a direction, then
    the step). The button says which rung comes next.
  - **Feedback:** asks first how sure you are (unsure, fairly sure, sure, or
    not saying).
  - **Discuss:** takes a question, the passage highlighted in the answer, or
    both.
  
  The teacher answers only when asked.
- **Replies:** each stream into a card as it is written, and is then kept
  as a turn: mode, rung, question, confidence, the version of the draft it
  answered, the reply, its pins, the model and the cost.
  - **Pins** are marked in the draft: red and green underlines, blue, and a
    dashed line for a hint. CodeMirror maps them through later edits; after
    a reload they are placed again by their quotes.
  - **A pin's quote** in the card selects its passage in the draft. A pin
    whose passage is gone says so and links to the version.
  - **Each card** can show the draft as it was, or restore it (undoably,
    through T49's versions). The latest card shows "What the teacher saw",
    section by section, with estimated tokens.
- **The reply's form:** fixed in code, because the parser reads it.
  `[red] "exact words"`, then the comment; likewise `[green]`, `[blue]` and
  `[hint]`. A quote is found exactly, or with runs of spaces matched loosely.
  The teaching style is the new `tutor` skill, which can be customised like
  the others.
- **Context,** through T50's assembler:
  - **cached:** the tutor skill, the reply form, and the solution (for the
    teacher only);
  - **as well:** the exercise, the notes it tests (in full), what they build
    on (titles and descriptions), the profile's struggles that name them
    (without citations), and this session's last six replies;
  - **from the developer:** the draft and working, the highlighted passage,
    the question, and what to do.
- **Models:** hints use the hint model; feedback and discussion the strong
  one. Usage is logged by feature (hint, feedback, discuss), so the Teacher
  page shows spending for each.
- **Help is part of the answer.** The attempt records `help` (counts by
  mode), and the draft, with every turn, is filed under the attempt.
  `exercise_pending` gives the marker `help` and the `session`. The
  `exercise` skill gains "Answers written with help": mark what the
  developer did with the hints, and say which steps were their own; no
  automatic penalty.
- **HTTP:** `POST /api/teacher/tutor/{id}`, as server-sent events (`text`
  pieces, then `done` with the turn and what was seen, or `error`). Drafts
  now carry `turns`.
- **Checked:** unit tests (parsing pins, locating quotes, the context built,
  rungs climbing, turns kept, spending by feature); `e2e/teacher.py` against
  a fake OpenRouter, 13 more checks (83 in all).
- **Not done:**
  - A margin beside the answer on wide screens: cards sit below the answer,
    which also works on a phone.
  - The scrubbing replay of the draft: the versions list and "show the draft
    as it was" cover it for now.
  - The "explain it to me" variant of discussion.
  - Trying it with a real model, which needs the developer's OpenRouter
    account connected.
