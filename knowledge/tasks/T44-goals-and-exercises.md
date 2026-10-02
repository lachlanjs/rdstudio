---
type: Task
title: "T44 — Goals and exercises"
description: "Goal and Exercise notes, shared or private; choice, value and text answers; marking by the dashboard, by yourself against the solution, or by an agent; coverage per goal."
tags: [task, m10, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-02T12:00:00Z }
---

# Prompt

See the [teacher design](/design/teacher.md), sections Goals and Exercises.

- **Goals and exercises:** `type: Goal` and `type: Exercise` notes, plus
  private ones in `teacher/goals/` and `teacher/exercises/`. All of them
  are kept off the map and graph, like tours.
- **Answering:** an exercise view answers `choice` and `value`
  exercises, checked in the dashboard. A `text` answer (Markdown and maths)
  is marked by yourself against the solution, or queued for an agent. The
  solution stays hidden until you answer or give up.
- **Events:** `attempt` and `attempt_marked`, where a got is evidence for
  each note in `tests`. The core's `discoveryStates` and `reviewSchedule`
  read them.
- **Goals in the Learn tab:** each goal with its coverage, its prerequisites
  and its exercises.
- **MCP:** `exercise_pending`, `exercise_record` and `exercise_mark`;
  `learner_state` gains goals.

# Outcome (2026-10-02)

- **Notes:** Goal and Exercise notes, kept off the map and graph and out of
  coverage, like tours (`OFF_MAP` and `isStudyNote` in the core). A folder
  holding only these is left off the map too.
  - An exercise names the notes it tests (`tests`), the goals it serves
    (`goals`) and how it is answered (`answer`). The links are resolved like
    any other.
  - A goal's needs are its `requires` links, and everything those require.
- **Answers:**
  - `choice`: `correct` is the number of the right choice, from 1, or a list
    of numbers for "choose every one".
  - `value`: a tolerance, absolute or relative, defaulting to about six
    significant figures, and an optional unit. Typed numbers are read
    leniently: 1/4, 2.5e-3, 2×10^3, a minus sign.
  - `text`: Markdown with maths, and a preview.
- **The solution:** the part after a heading named Solution (or Worked
  solution), hidden until you answer or give up. Giving up is recorded as
  missed, by you.
- **Marking:**
  - choices and values are checked in the dashboard (`by: dashboard`);
  - a text answer is marked by you against the solution (`by: self`), or
    saved for an agent;
  - a waiting answer can still be marked by yourself later, from its page;
  - all three count as evidence for every note tested, at the versions
    answered.
- **Events:** `attempt` (`exercise`, `tests`, `hashes`, `answer`, plus
  `result` and `by` when settled) and `attempt_marked`. The core reads each
  attempt as one event per tested note, so discovery, review and load treat
  them like any other evidence.
- **The dashboard:**
  - an Exercise note renders as the exercise: problem, answer, solution, and
    your attempts with any feedback;
  - a Goal note gets a progress panel: exercises passed, the notes it needs
    in reading order with your states, and a coverage bar;
  - the Learn tab lists goals first, and answers waiting for marking;
  - Practice lists the written exercises, the ones not yet passed first, with
    the drills below them.
- **MCP:**
  - `exercise_pending`, `exercise_record` (an answer given in chat) and
    `exercise_mark`;
  - `learner_state` gives each goal's exercises, whether it is met, and its
    coverage, plus how many answers wait;
  - `record` warns when an Exercise note's answer settings are wrong or it
    has no Solution section.
- **Explain-back** keeps its own flow (see the design).
- **Moved to [T45](/tasks/T45-profile-and-skills.md):** private goals and
  exercises in `teacher/`. They come with `teacher_write`.
- **Checked:**
  - core tests (number reading, answer settings, checking, solutions,
    references, attempts as evidence, goal progress);
  - MCP tests;
  - `e2e/teacher.py`, 22 more checks, among them a real agent marking
    through stdio MCP;
  - every other walkthrough and `mise run agree`.
