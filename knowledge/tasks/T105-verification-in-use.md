---
type: Task
title: T105 — Find out why no note here is verified, and act on it
description: All 174 notes in this project's own knowledge base are unverified; decide whether
  verifying costs too much or is not worth doing, and change the design to suit.
tags: [task, m16, trust, review, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T22:39:27Z}
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

Done on 2026-10-09 as far as an agent can take it, on the branch
`feat/m16-leaner`. What is left is the developer's to answer, and is
recorded as [a question](/questions/what-verification-covers.md).

**What was found.** Both guesses in "To settle" hold.

- **Verifying cost too much.** The only way to verify a note was the
  command line: `rdstudio verify <id>`, one id at a time, typed in a
  terminal. The app's Review page listed every unverified note and told
  the developer to go and type that. Nothing in the app could do it.
- **Most notes are not the kind one verifies.** Of 187 notes, 110 are
  tasks: records of work done, which are true by having happened. The
  notes that state how things are or why, and can be wrong, are the 21
  decisions, 19 designs, 4 procedures and 3 references: 47.

**What was built: the cost.** A note is marked as checked from the app.

- A button, "Mark as checked", on each row of Unverified and of Changed
  since review on the Review page, and in the Trust section beside a note.
  It shows only where notes can be edited here, and on a note that is
  unverified or changed since it was checked.
- `POST /api/notes/{id}/verify`, behind a write's guards, recording the
  verification under the developer's name as `rdstudio verify` does. No
  agent's tool reaches it: only a person verifies.

**Checked.** A unit test of the route (the guards, the file changed only
in its `verified` field, a read-only server refusing) and two checks in a
browser (`e2e/propose.py`): from the Review page the note leaves the
list; from its own page it reads "Reviewed by a person" and the button
goes. 173 unit tests pass.

**Not built: what verification covers.** Whether tasks and ideas should
count as unverified at all changes what the brief reports, the Review
page lists and the Atlas's Health lens draws. That is a rule of the
tool, so it is asked, not chosen.
