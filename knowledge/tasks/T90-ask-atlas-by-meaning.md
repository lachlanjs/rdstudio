---
type: Task
title: T90 — Ask Atlas shows notes found by meaning
description: On the Atlas, a note found by meaning is shown apart from one found by keyword search
  or reached by a link.
tags: [task, m14, atlas, retrieval, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T04:24:15Z}
---

# Prompt

The developer, 2026-10-07: "Notes which are found through RAG could be
highlighted with a different colour to notes found through OKF search tool
calling." Step 4 of the agreed scope for
[semantic retrieval](/ideas/semantic-retrieval.md "requires").

# Plan

A third way of finding on [Ask Atlas](/tasks/T85-ask-atlas.md "requires"),
for steps of [`find_similar`](/tasks/T89-find-similar.md "requires"): its
own colour, paired with a mark or a line style so that it reads on every
theme, and named in the key.

# Acceptance

An answer that used all three ways shows each apart, on Marginalia and on
Station.

# Done

2026-10-07. A note found by meaning has its own mark on the Atlas: a
dotted teal frame, heavier once opened, and a teal tint when the answer
rests on it. The same colour marks it in the answer's list and on its
passage. The key shows "Found by meaning" only when an answer used it.

A note counts as found by meaning when a search by meaning named it before
any keyword search did and it was not reached by a link.

Checked by a step of `e2e/ask.py` (27 checks in all), skipped where the
model is not installed.
