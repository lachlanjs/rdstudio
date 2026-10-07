---
type: Design
title: Ask Atlas
description: "A question asked on the Atlas is answered beside the map from the notes and the code,
  and the map shows where the answer came from: the notes found, the links followed, and a passage
  beside each note the answer rests on."
tags: [design, atlas, assist, retrieval]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T04:24:15Z}
---

# What it is

The first version of [the idea](/ideas/ask-atlas.md "see also"), built in
[T85](/tasks/T85-ask-atlas.md "see also"). On the Atlas there is a box to
ask from. The answer is shown in a card beside the map. Nothing is written.

It uses the same lookups as
[the agent in the editor](/design/assist.md "requires"): the model is given
no context and calls read-only tools in rounds capped by tier
([the decision](/decisions/assist-looks-things-up.md "uses")). Each lookup
is a step, streamed as it is made. Here the steps are what the map draws.

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

- The box is not offered on a study path or a tour, in an exported
  snapshot, or without a write token.
- In the code view the answer is shown but nothing is marked: the map there
  holds code, not notes.
- A model that cannot call tools gets one search made for it and the first
  three notes read; those steps are still drawn.
- Maths in the answer is not typeset in the card.
- Usage is logged under the feature `atlas-ask`. Questions and answers are
  not kept.

# Where it lives

`packages/cli/src/atlasask.ts` (the request, the reply's reading),
`POST /api/atlas/ask`, `app/src/lib/views/ask.js` (the box, the card, the
marks), `app/src/lib/views/gridmap.js` (the drawing), `e2e/ask.py`.
