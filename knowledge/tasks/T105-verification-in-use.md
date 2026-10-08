---
type: Task
title: T105 — Find out why no note here is verified, and act on it
description: All 174 notes in this project's own knowledge base are unverified; decide whether
  verifying costs too much or is not worth doing, and change the design to suit.
tags: [task, m16, trust, review, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T04:53:17Z}
---

# Prompt

The developer, 2026-10-08, asked what would improve the project, naming
"making the tool leaner (refinement, reduction), cleaner organisation, or
adding new impactful features".

This task is the agent's suggestion in reply, not the developer's words.

# What was seen

The session brief on 2026-10-08 read: "174 concepts … Awaiting the
developer: 0 changed since review, 1 open questions, 174 unverified."

Only the developer verifies a note. The tool is about keeping a person's
understanding level with what agents write, and its own project has used
that step on nothing.

# To settle

This is a question for the developer before it is a piece of building.

- Is verifying too costly as built: too many steps, no good place to do it
  from, no sense of which notes matter?
- Or is it not worth doing for most notes, so that it should apply to a
  few kinds (decisions, design) and not to tasks and ideas?
- Does [explain-back](/tasks/T28-explain-back.md) already do the real job,
  so that "verified" should follow from it and not be a separate step?

# Plan

(Filled in by the agent before implementation.)

# Acceptance

- A decision note records what verification is for and which notes it
  applies to.
- The count the brief reports means something: either it falls as the
  developer works, or notes that need no verifying are not counted.

# Outcome

Not started.
