---
type: Task
title: T101 — Axis creates, changes and moves notes from Ask Atlas
description: From the Axis panel on the Atlas, the agent proposes new notes, changes to notes and
  moves, shown for the developer to accept before anything is written.
tags: [task, m16, assist, atlas, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T12:30:07Z}
---

# Prompt

The developer, 2026-10-08: "The only other feature I can think of right at
this moment that would be useful would be giving the agent the ability to do
more in the OKF base - like creating, moving, and modifying notes from the
Ask Atlas. The agentic side of the app could do with some work."

After [one agent loop](/tasks/T100-one-agent-loop.md "requires").

# Notes from the agent

Not the developer's words; what exists to build on.

- **The write path.** The MCP `record` tool creates and updates notes and
  stamps who wrote them. Axis should call the same code, not a second
  writer.
- **Leave to change.** [Axis changes a note only where it is
  let](/decisions/assist-changes-by-leave.md), built in
  [T98](/tasks/T98-edits-by-leave.md) for one note. Here the same rule covers
  a set of changes across notes.
- **Moving is the hard part.** A move must rewrite every link to the note,
  and the indexes. Suggested order: create and change first, move second.

# To settle before a plan

- What leave looks like across several notes: one proposal accepted whole,
  or each change accepted on its own.
- Where a proposal is shown: as marks on the map, as diffs in the panel, or
  both.
- How the stamp and review state are set: the model named in `generated`,
  and whether an accepted change counts as significant.
- Whether Axis may delete, or only create, change and move.
- Whether a proposal is kept with the question in the
  [kept questions](/tasks/T94-ask-history.md), and what replaying it shows
  once the notes have changed.

# Plan

(Filled in by the agent before implementation.)

# Acceptance

- From the Axis panel on the Atlas, a request can end in a proposed new
  note, a proposed change, or a proposed move.
- Nothing is written until the developer accepts.
- An accepted change goes through the same code as `record`, with the model
  named in the stamp.
- After a move, no link in the base points at the old place, and
  `rdstudio check` passes.

# Outcome

Done on 2026-10-08, on the branch `feat/m16-leaner`; not committed.
Approved with the rest of M16 ("Go ahead with things").

**What it does.** On the Atlas, the Axis panel has a switch, "May propose
changes", off unless ticked. With it on, a question may end in proposals:
a new note, a change to a note, or a move. Each is a card beside the
answer showing what it would do, with Accept and Reject. Nothing is
written until one is accepted.

**Choices made** (the agent's, for the developer to overrule; they answer
"To settle before a plan"):

- **Leave** is the one switch. It is not kept between visits.
- **Each proposal is accepted on its own.**
- **Shown in the panel**, not on the map: a change as the text taken out
  and the text put in; a new note with its place, type and text; a move
  with from, to and how many notes' links are rewritten.
- **The stamp** names the model, `human:you with model`, as for text
  accepted in the editor. Whether a change is significant is judged as any
  edit is; a small one keeps the note's own author and adds the model.
- **No deleting.**
- **Kept questions keep their proposals.** Opened later, what was not
  settled can still be accepted. What was accepted is not remembered by
  the page, so the server tells: a change already made is refused as
  "already made", a note that exists as existing.

**How.**

- `packages/cli/src/proposals.ts`: the tools `propose_note`,
  `propose_change`, `propose_move`, a second box on
  [the one loop](/tasks/T100-one-agent-loop.md). Each call is checked
  against the base and refused with the reason, which goes back to the
  model to put right. `apply()` makes an accepted one through the app's
  own `saveNote` and `moveNote`.
- A change is kept as text to find and text to put, not a whole body, so
  it is still made when the note has changed elsewhere, and refused when
  its own text has gone.
- `POST /api/atlas/proposals`, behind the guards of a note's save; a
  read-only server neither takes it nor offers the tools.
- `app/src/lib/views/ask.js`: the switch and the cards.

**Checked.**

- Five unit tests (`test/proposals.test.ts`) and one of the route: every
  refusal, several changes to one note, each kind applied, a move's links
  rewritten, a change after the note changed elsewhere, a change not made
  twice. 162 command line tests pass.
- In a browser, with a stand-in model (`e2e/propose.py`, now in
  `mise run e2e`): 18 checks, among them that asking writes nothing, that
  an accepted change and note are in the files and stamped, that the
  answer stays in view while the map reads the notes again, that the new
  note appears on the map, and that the base checks clean after a move.
- The Ask Atlas and editor browser suites still pass (45 and 71 checks).

**Found while checking:** a change whose new text holds the old (a
sentence added after one kept) could be made twice, doubling the text.
Fixed, with a test.

**Not checked.**

- With a real model: whether it proposes sensibly, reads before changing,
  and puts a refusal right. The instructions are untried on one.
- A proposed change and a proposed move of the same note, accepted in
  either order.
- The cards at phone width.

**Not done.**

- Proposals are not drawn on the map.
- A proposal accepted is not marked as such in the kept question.
