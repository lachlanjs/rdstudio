---
type: Design
title: Ask Atlas
description: "A question asked on the Atlas is answered in a panel beside the map from the notes and
  the code, and the map shows where the answer came from: the notes found, the links followed, and a
  passage beside each note the answer rests on. Questions are kept and can be played again."
tags: [design, atlas, assist, retrieval]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T23:11:36Z}
---

# What it is

The first version of [the idea](/ideas/ask-atlas.md "see also") was built in
[T85](/tasks/T85-ask-atlas.md "see also"): a box to ask from and a card
over the map. Since [T93](/tasks/T93-axis-panel.md "see also") it is one
panel, the Axis panel, docked in the map's frame. No note is written.

It uses the same lookups as
[the agent in the editor](/design/assist.md "requires"): the model is given
no context and calls read-only tools in rounds capped by tier
([the decision](/decisions/assist-looks-things-up.md "uses")). Each lookup
is a step, streamed as it is made. Here the steps are what the map draws.

# The panel

- To the right of the map where the frame is wider than tall and at least
  900 pixels wide; below it otherwise. The map has what the panel leaves
  and refits when that changes.
- Folded by default to a button "Axis" over the map's corner. A handle on
  its inner edge resizes it, by a drag or the arrow keys. Open or folded,
  and the size for each side, are kept on the device.
- From the top: the answer (or, with nothing asked, the questions asked
  before), which scrolls; the cost, which does not; the question being
  written.
- The question is written in the note editor's live preview, so maths,
  emphasis and links to notes work as they do in a note. Ctrl+Enter asks.
- The question asked is shown as a quotation above the answer.
- The cost line gives the price, the tokens in and out, the tier and the
  model. Opened, it lists tokens read from the cache, calls to the model,
  and lookups by kind.

# Questions kept

[Decided](/decisions/ask-atlas-keeps-questions.md "requires") and built in
[T94](/tasks/T94-ask-history.md "see also").

- A finished answer is kept in the asker's learner record, with a
  fingerprint of each note it opened or rests on. Nothing is kept where the
  learner record is off.
- Opening a kept question plays it again on the map, one lookup every 0.7
  seconds, without asking the model.
- A note changed since is flagged and its sentence checked again.
- A note or a followed link that is gone stops the replay: the answer is
  shown as it was, with what is missing named.

# Where a question starts

- A note is selected: the model is told which, with the titles of what it
  links to, and a chain of links starts from it.
- Otherwise the folder in focus: its notes' titles are given.
- Otherwise the whole map: the folders and how many notes each holds.

The box's placeholder says which of these applies.

# What the answer rests on

The model replies in a form: the answer, then a list of the notes it rests
on, each with the heading read and one sentence copied from the note.

- A note it never looked at is dropped from the list.
- The sentence is checked against the note's text, ignoring Markdown marks
  and spacing. One that is found is shown in quotation marks. One that is
  not is replaced by the start of what the model read, shown in italics and
  labelled as such.
- A note linked in the answer counts as rested on even if not listed.
- At most eight.

# On the map

| Mark | Meaning |
|---|---|
| Dashed amber frame | Found by a search of words; heavier once opened |
| Dotted teal frame | Found by [meaning](/design/search-by-meaning.md "uses") ([T90](/tasks/T90-ask-atlas-by-meaning.md "see also")); heavier once opened |
| Solid violet frame, and a violet line along the route | Reached by a link from a note already in hand |
| Tinted fill and a number | The answer rests on it; the number is its place in the answer's list |
| Fainter | Opened and not used |
| Dashed amber wall | A closed folder holding some of these |

- The colours are three of the folder colours, not a pen's: red, green and
  blue keep their meanings. Each also has a line style of its own, so the
  three can be told apart without colour.
- The first four notes the answer rests on each get a passage beside them,
  joined by a dotted line. They are placed as a note's tip is: clear of the
  marked notes, the panels and each other, and off other notes where there
  is room. They can be switched off. Below 700 pixels wide they are not
  shown; the answer card carries the passages either way.
- The view moves to hold what was opened, once for each note more, unless
  the map has been moved by hand since the question was asked.
- Code read is listed in the answer, not drawn.

# Limits

- The panel is not offered on a study path or a tour, in an exported
  snapshot, or without a write token.
- In the code view the answer is shown but nothing is marked: the map there
  holds code, not notes.
- A model that cannot call tools gets one search made for it and the first
  three notes read; those steps are still drawn.
- Usage is logged under the feature `atlas-ask`.
- An answer stopped or failed is not kept.
- Each question stands alone: one asked after an answer does not carry it
  ([T95](/tasks/T95-ask-follow-ups.md "see also")).
- A replay's pace is set, not the original: steps carry no times.

# Where it lives

`packages/cli/src/atlasask.ts` (the request, the reply's reading),
`packages/cli/src/atlasasks.ts` (the questions kept),
`POST /api/atlas/ask`, `GET /api/atlas/asks`, `GET` and
`DELETE /api/atlas/asks/{id}`, `app/src/lib/views/ask.js` (the panel, the
answer, the marks, the replay), `app/src/lib/views/gridmap.js` (the frame
and the drawing), `e2e/ask.py`.
