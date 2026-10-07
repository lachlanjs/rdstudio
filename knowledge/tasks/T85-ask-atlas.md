---
type: Task
title: T85 — Ask Atlas, first version
description: A question asked on the Atlas is answered from the notes, and the notes it opened are
  lit in order, chains drawn along routes and cited notes previewed.
tags: [task, m14, atlas, assist, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:43:33Z}
---

# Prompt

The first version sketched in [Ask Atlas](/ideas/ask-atlas.md "requires"),
which the developer put first, 2026-10-07: "The main thing I want to achieve
before bothering with code RAG is the 'Ask Atlas' feature".

# Plan

- A box on the Atlas to ask from; the answer in the card at the side.
  Nothing is written.
- It starts from the selected note or folder if there is one, else from a
  search.
- The model cites the lookup each claim rests on. Cited notes get a
  preview, three to five at once; the rest of what it opened is fainter.
- The steps Axis keeps ([T84](/tasks/T84-assist-lookup.md "requires"))
  arrive as it works: notes a search names light together, a note opened
  lights in turn, and a run of links is drawn along the routes between
  them with the feeder animation.
- Two ways of finding, shown by colour and by line: by search, by a link.
- Code it read is listed with the answer.

# Acceptance

- Asked a question the base answers, the answer names its notes and those
  notes are marked on the map, with the chain where one was followed.
- A browser walkthrough with a fake model that looks things up.
- Tried once with a real model.
