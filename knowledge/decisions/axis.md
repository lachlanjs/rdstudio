---
type: Decision
title: The agent is called Axis, in both modes
description: The teacher of Learning mode and the helper of Project mode are one agent with one
  name, Axis, chosen to pair with the Atlas.
tags: [naming, agents, project-mode]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T00:50:54Z}
---

# Decision

From the developer, 2026-10-07: "I like Axis - lets use that for both the
teacher and the project helper."

The agent that teaches in Learning mode and helps in Project mode is called
**Axis** wherever the app names it. Applied in [T80](/tasks/T80-axis-name.md).

# Why Axis

The developer had asked for a name for the agent in Project mode that was
not "copilot or partner or assistant", then for "an actual name ... is
there anything that would pair well with 'Atlas'?" In anatomy the atlas is
the first vertebra of the neck and the axis the second, the one the atlas
turns on: a real pair. Others offered: Mercator (who named the atlas as a
book of maps), Maia, Alcyone, Merope and Calypso (daughters of Atlas), and
Gazetteer; and, as role names before that, Steward, Surveyor, Keeper,
Curator.

# Assumption

One name for both modes is right because it is one agent: the same skills,
the same account, the same record of the person. Only what it is doing
differs.

# What it changes, when applied

- The words the app shows: the Teacher page, "ask the teacher", "the
  teacher says", the settings and the walkthroughs' checks of them.
- Not the names inside: `[teacher]` in `rdstudio.toml`, `/api/teacher`, the
  `teacher` folder beside the learner record, and the skills' names stay as
  they are until there is a reason to move them, since changing them breaks
  existing configurations.

# Reopen if

- The name collides with a product people confuse it with.
- The two modes come to have different agents.
