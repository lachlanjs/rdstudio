---
type: Task
title: T93 — Ask Atlas in a docked Axis panel
description: "Ask Atlas moves from a floating box and card into one panel docked beside or below the
  map: it folds, resizes by a drag, takes a question in the note editor's live preview, and keeps
  the cost in view."
tags: [task, m15, atlas, assist, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T23:11:13Z}
---

# Prompt

The developer, 2026-10-07, with a screenshot of
[Ask Atlas](/design/ask-atlas.md "requires") on Station: "I want to work on
the layout and functionality of the 'Ask Atlas' feature so that things flow
on the screen better."

- "Axis should take up a panel either at the bottom or on the right." Below
  the map in portrait (a phone), to its right in landscape.
- "Axis should be collapsible via a button saying 'Axis'. When opened, the
  amount of the screen that is taken up should be resizeable via a drag."
- The price: "once you have the response, you shouldn't be able to scroll
  away from it. Basic token usage breakdown would be nice across input and
  output, resources retrieved from search, etc." It need not be live.
- "The original question should not form a heading, but should be displayed
  in a question quote callout."
- "When asking a question, there should be more area available." It is
  asked "in the same rich format provided in the note editor", with maths
  typeset as it is there.

# Plan

1. One panel in place of the box and the card. The map's frame is split:
   the map takes what the panel leaves. Right when the frame is wider than
   it is tall and at least 900 pixels wide; otherwise below.
2. An "Axis" button folds it to a tab and opens it again. A handle on its
   inner edge resizes it by a drag (and by the arrow keys). Open or folded,
   and the size for each side, are kept on the device.
3. The question is written in the answer editor (the note editor's live
   preview: maths, emphasis, lists). Ctrl+Enter asks.
4. The question asked is shown as a quote callout above the answer.
5. A footer that does not scroll: the tier, the model, the cost, and the
   tokens in and out. Opened, it gives the breakdown: tokens read from the
   cache, calls to the model, and lookups by kind (searches of words,
   searches by meaning, notes read, links followed, code read).
   The server adds these up across the rounds and sends them with the
   answer.
6. The passages beside notes on the map typeset their maths.

# Acceptance

- At 1280 by 800 the panel is to the right; at 390 by 844 it is below; the
  map is not covered by it in either.
- Folded, only the "Axis" tab is left and the map has the whole frame.
- Dragging the handle changes the panel's size and the map refits; the
  size is there after a reload.
- A question with `$x^2$` shows typeset maths while it is written.
- With a long answer scrolled to any place, the cost is on screen.
- `e2e/ask.py` passes with its selectors updated.

Kept questions and their replay are
[T94](/tasks/T94-ask-history.md "see also"); follow-up questions are
[T95](/tasks/T95-ask-follow-ups.md "see also").

# Done

2026-10-07. Ask Atlas is one panel, docked in the map's frame.

- To the right of the map where the frame is wider than tall and at least
  900 pixels wide; below it otherwise. A phone turned on its side gets it
  on the right.
- Folded by default, to a button "Axis" over the map's corner. A handle on
  its inner edge resizes it by a drag or the arrow keys. Open or folded and
  the size for each side are kept on the device. The map refits as its
  frame changes.
- The question is written in the note editor's live preview. Ctrl+Enter
  asks; Enter makes a line.
- The question asked is a quotation above the answer, its maths typeset.
- A footer outside what scrolls gives the cost, the tokens in and out, the
  tier and the model. Opened, it lists the tokens read from the cache, the
  calls to the model, and the lookups by kind. The server adds the tokens
  up across the rounds (`spent` on the answer).
- Passages beside notes, and the sentences in the answer's list, typeset
  their maths.
- Below the map the question and its controls are one row, so the answer
  keeps the height.

Not done as planned: the default is folded, not open, so the map is whole
until Axis is wanted.

Checked by `e2e/ask.py` (45 checks with T94's), including a phone upright
and on its side, and by a unit test of the usage.
