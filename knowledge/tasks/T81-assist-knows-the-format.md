---
type: Task
title: T81 — Axis in the editor is told how notes work here
description: The editor's agent is given the forms the app reads in a note (link ratings as titles,
  embeds, pictures, checklists) and what the Atlas makes of them; a long passage is sent whole and
  can come back whole.
tags: [task, m13, assist, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T01:53:31Z}
---

# Prompt

From the developer, 2026-10-07. They selected one item of the
[roadmap](/tasks/roadmap.md "see also") and asked Axis to convert it to a
"See also" link. It proposed
`- [x] T01 Package skeleton and configuration (see also [T01](/tasks/T01-package-skeleton.md))`,
and said "The note gave no example of a 'See also' link". Their reading:
"the agent is not provided with proper context about how to assist the user
within rdstudio." They want to ask it to rate every link of the roadmap
"see also", because those links clutter the Atlas, and will use that as the
test. The edit is theirs to make with Axis; it was not made here.

# Finding

The request ([an agent in the editor](/design/assist.md "requires")) said
only "Link to a note as `[its title](/its/path.md)`". Nothing told the model
that a rating exists, that it is the link's title, or what the Atlas does
with it. The record-okf skill tells agents outside the app; the app's own
agent was never told.

Two more faults would have met the whole-roadmap request:

- a fill's reply had room for 2000 tokens. The roadmap is about 8500
  characters and comes back longer, so the reply would have been cut;
- a note longer than 14 000 characters was cut to a window even where the
  cut fell inside the selected passage, so accepting the reply would have
  deleted what was cut.

# Outcome

In `packages/cli/src/assist.ts`:

- A section **How notes work here** (`FORMAT`) is sent with every request,
  in all three modes, cached. It gives the link form, the three ratings and
  their meaning, that a rating is the link's title with a worked example,
  what the Atlas does with ratings, artifacts and pictures, checklists,
  maths, diagrams and footnotes, and a rule: when asked to change the form
  of something, change only that and give the rest back exactly.
- The marked passage is always sent whole (the window grows with it), and
  the reply's room grows with the passage (`fillTokens`).
- A passage over 40 000 characters is refused for a rewrite, with the
  reason (`MAX_PASSAGE`).
- A reply cut short (an `<insert>` never closed) proposes nothing and says
  so, where before the raw reply was shown.

Checked by two unit tests in `packages/cli/test/assist.test.ts`; the CLI
suite (119) and the editor walkthrough (21/21) pass.

# Tried by the developer

2026-10-07, the whole roadmap, on `anthropic/claude-sonnet-5.5`: the reply
was cut at exactly its allowance, 4512 tokens, and nothing was proposed.
The allowance assumed three characters a token; a list of links and paths
runs nearer two. It is now a token for each character of the passage, plus
1000 (`fillTokens`).

# Not done

- Not tried with a real model: the developer's roadmap request is the test.
- The wording of "see also" adds "a list entry (an index, a roadmap, a list
  of tasks)" to the skill's meaning. That is the agent's reading of the
  developer's wish, not something they said.
- The model is still handed the first six linked notes and five found by
  search whatever is asked, which for a change of form is waste (the reply
  "drew on" T01 to T06). Not changed.
- `FORMAT` and the record-okf skill say the same thing in two places.
