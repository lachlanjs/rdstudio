---
type: Task
title: T80 — The agent is called Axis in the app
description: The words the app shows name the agent Axis, in both modes, where they said the
  teacher; the names inside (configuration, API, folders, skills) are unchanged.
tags: [task, m13, naming, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T01:37:48Z}
---

# Prompt

Applying [the decision](/decisions/axis.md): "I like Axis - lets use that
for both the teacher and the project helper."

# What was changed

On `feat/artifacts`. Only words a person reads:

- The You menu and the command palette: "Axis", "the agent: how it teaches
  and helps here, and what it knows of you".
- The page at `#/teacher`: titled Axis, with a first line saying it is the
  agent that works with you, a teacher in a learning project and the one
  that keeps a project in order.
- Today, in both modes: "Axis's next step", "set … by Axis", "Ask Axis what
  is next".
- The exercise tools ("Ask Axis", "To work with Axis here…"), the Atlas's
  key ("Axis says: needs work"), Settings, the model panel, the editor's
  bar, and the error when a reply cannot be had.

# What was not

As the decision says: `[teacher]` in `rdstudio.toml`, `/api/teacher`, the
route `#/teacher`, the `teacher` folder beside the learner record, the
`teach` and `tutor` skills, and the code's own names. The skills' text
still speaks of teaching, which is what those skills are for.

# Checks

`e2e/teacher.py`'s checks of the page's heading, the link from Settings and
the You menu, changed to the new words, pass (the walkthrough still stops
later at the Atlas, [T73](/tasks/T73-walkthroughs-grid-atlas.md)).
