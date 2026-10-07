---
type: Idea
title: "Ask Atlas: a question answered on the map, showing where the answer came from"
description: Ask a question on the Atlas; the answer is composed from the notes and the code, and
  the notes it drew on are marked on the map with previews, the chain of lookups drawn, and the way
  each was found shown by colour.
tags: [idea, atlas, assist, retrieval]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:14:22Z}
---

# The idea

From the developer, 2026-10-07:

> an "Ask Atlas" feature which would be run in the Atlas mode and would
> compose a response using text found in the OKF / codebase. The most
> relevant snippets would be visually represented in the OKF itself with a
> preview linked with a dotted line to the notes that they came from - and
> if a chain of OKF calls is used (from one note to the next to the next),
> then this chain could be visually illustrated also.
>
> Notes which are found through RAG could be highlighted with a different
> colour to notes found through OKF search tool calling.

It makes concrete the first of the two
[Project-mode features](/ideas/project-agent-features.md "see also"),
watching an agent's path through the base. Not decided and not built.

# What is already there for it

Since [T84](/tasks/T84-assist-lookup.md "requires") every lookup Axis makes
is kept as a step and streamed as it happens:

- the tool, and the notes a search named;
- the note opened and the section read, with an excerpt of it;
- `how` it was reached: `search`, `read`, `link`, `code`;
- `from`: the note already in hand that links to the one opened. A run of
  these is the chain.

So the trace the picture needs exists. What is missing is the place to ask
from on the Atlas, and the drawing.

# The agent's view

Worth building, and the best argument yet for the Atlas in Project mode: it
shows what the map is for, which is what the developer doubted of the
code map. Points to settle first:

- **Which snippets are "most relevant".** What the model opened is not what
  it used. Have it cite: each claim in the answer carries a mark naming the
  step it rests on, and only cited steps get a preview. Uncited lookups are
  shown fainter, as places it looked and did not use.
- **How many previews.** Three to five at once, or the map is covered. The
  rest open on hover or from the answer. The tip that avoids highlighted
  notes ([T71](/tasks/T71-atlas-flat-and-room.md "see also")) is the
  start of placing them.
- **The chain.** Draw it along the existing routes between the notes, in
  order, with the feeder animation already built, not as new straight
  lines across the map. A search has no "from": show it as a set of notes
  lighting up at once, then the one chosen.
- **Colour for how it was found.** Three ways, not two: by keyword search,
  by meaning ([semantic retrieval](/ideas/semantic-retrieval.md "see also"),
  if built), and by following a link. Colour alone will not carry three on
  every theme: pair it with a mark or a line style.
- **Code.** The Atlas shows notes or code, not both at once. Snippets of
  code would be listed with the answer and shown on the map only in the
  code view, unless the two views are joined.
- **Where the question starts.** In the editor a request starts from a
  note. On the Atlas there is none: start from the selected note or folder
  if there is one, else from a search.
- **Nothing is written.** As in the editor: an answer, never an edit.

# A first version

A box on the Atlas, the answer in the card at the side, the notes it opened
lit in order as the steps arrive, chains drawn along routes, and previews
for cited notes only. No embeddings: the colours for search and link first.
