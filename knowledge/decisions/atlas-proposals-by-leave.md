---
type: Decision
status: draft
title: On the Atlas, Axis proposes changes to the base and writes none itself
description: Asked from the Atlas with leave, Axis may propose a new note, a change or a move; each
  is accepted or rejected by the person, and only then written, through the app's own saving.
tags: [assist, atlas, agents, trust]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T12:30:14Z}
---

# Decision

Made by the agent while building [T101](/tasks/T101-axis-writes-notes.md)
on 2026-10-08, under the developer's "Go ahead with things". It is a draft
until the developer has looked at it.

- Axis proposes only where the person has ticked "May propose changes" for
  that question. Without it the tools are not offered and it is not told
  of them.
- A proposal writes nothing. Each is shown with what it would do, and is
  accepted or rejected on its own.
- An accepted proposal is written by the server through the same saving
  and moving as an edit made in the app, with the model named in the
  note's stamp.
- It may create, change and move. It may not delete.

This carries [the rule for a note](/decisions/assist-changes-by-leave.md)
to the whole base.

# Assumption

That a person reads a proposal before accepting it. The cards show the
text, so the rule costs a reading and no more.

# Reopen if

- People accept without reading, and wrong notes pile up: then the stamp
  or the review queue must carry more.
- Proposals become many at once (a reorganisation of a folder): then
  accepting one by one is too slow, and a set accepted whole is needed.
- An agent outside the app is trusted to write directly (it already may,
  through MCP `record`): then the two paths should be told apart in the
  stamp.
