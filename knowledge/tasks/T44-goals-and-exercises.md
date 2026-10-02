---
type: Task
title: "T44 — Goals and exercises"
description: "Goal and Exercise notes, shared or private; choice, value and text answers; marking by the dashboard, by yourself against the solution, or by an agent; coverage per goal."
tags: [task, m10, todo]
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
