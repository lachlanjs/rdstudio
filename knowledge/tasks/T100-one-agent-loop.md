---
type: Task
title: T100 — One agent loop for Axis
description: Fold the separate agent set-ups (Axis in the editor, Ask Atlas, the tutor) into one
  loop with one set of tools, so that a new tool is added once.
tags: [task, m16, assist, atlas, refactor, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T05:12:58Z}
---

# Prompt

The developer, 2026-10-08: "The agentic side of the app could do with some
work." They then asked what would improve the project, naming "making the
tool leaner (refinement, reduction), cleaner organisation, or adding new
impactful features".

This task is the agent's suggestion in reply, not the developer's words: do
it before [Axis writes to the base](/tasks/T101-axis-writes-notes.md), so
the write tools are added in one place.

# What was seen

From file sizes and a skim, not a full reading; check it before planning.

- `packages/cli/src/assist.ts` (717 lines), `atlasask.ts` (207) and
  `teacher.ts` with `tutor.ts` (630 together) each assemble their own prompt
  from named parts and run their own turn.
- `lookup.ts` (354) already holds the lookup tools that assist and Ask Atlas
  share.
- `serve.ts` has three streaming routes with the same shape: text pieces,
  steps, done, error.

# To settle before a plan

- Whether the tutor belongs in the same loop, or only Axis in the editor and
  Ask Atlas. The tutor marks and teaches; it may share less than it seems.
- What is common: the prompt parts and their token budgets, the rounds of
  tool calls, the step events, cost logging, kept chats.
- What stays particular to each: its instructions, the form of its reply,
  what it is given at the start.

# Plan

Approved by the developer on 2026-10-08 with the rest of M16, so written
with the work.

Reading the code showed "What was seen" above to be wrong in its main
claim. The loop was already one: `rounds()` in `assist.ts` ran both Axis
beside the note and Ask Atlas, and both took their tools from `lookup.ts`.
What was separate was smaller:

- The loop lived inside the editor's file, and took a `Lookup` and nothing
  else, so no other tool could be offered.
- The same paragraph on how to look up code and how the rounds work was
  written out twice.
- The list of code read was built twice.

Settled:

- **The tutor stays as it is.** It makes one call with no tools and has its
  own help for exercises; there is no loop in it to share.
- **Each surface keeps** its instructions, its reply's form and what it is
  given at the start.

# Acceptance

- One module runs a turn: prompt parts, tool rounds, streaming, cost.
- Each surface is a small description passed to it.
- A tool added to the shared set is available to every surface allowed it,
  with no second registration.
- The existing tests for assist, Ask Atlas and the tutor pass unchanged in
  what they assert.

# Outcome

Done on 2026-10-08, on the branch `feat/m16-leaner`; not committed. A
smaller change than the task supposed (see Plan).

- **`packages/cli/src/agent.ts`** (new, 114 lines) holds the loop:
  `rounds()`, the rounds allowed by tier, what a request spent, the hooks,
  and the words common to every surface.
- **Tools come in boxes.** A `Toolbox` gives its tools and runs a call,
  returning the text for the model and the step kept. `rounds()` takes a
  list of boxes; the box that offers a tool runs it. `Lookup` is one box.
  This is what [T101](/tasks/T101-axis-writes-notes.md) needs: its write
  tools are a second box, passed only where Axis may write.
- **The steps of every box come back from `rounds()` in the order made.**
- `assist.ts` and `atlasask.ts` now import the loop; `assist.ts` is 70
  lines shorter.

**Checked:** three new tests in `test/agent.test.ts` (two boxes in one
run; a tool nobody offers is answered and the rounds still end; code read
is listed once). All 151 command line tests pass and the type check is
clean. Behaviour is unchanged: the 148 tests from before pass as they
were.

**Not done:** the tutor is not on the loop, by the choice above.
