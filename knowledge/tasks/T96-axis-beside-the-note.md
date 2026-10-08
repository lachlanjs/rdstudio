---
type: Task
title: T96 — Axis beside the note being edited, and the details under its title
description: In the editor, Axis moves from a bar and a reply above the text into a panel to the
  right of the note or below it, as on the Atlas; the details form moves from a column beside the
  note to a dropdown under its title.
tags: [task, m15, editor, assist, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T00:57:36Z}
---

# Prompt

The developer, 2026-10-08, with `note-example.png`: "Instead of having the
input at the top in a small text box - I want it on the right hand side next
to the prose. I want the Details section removed from the UI. This will be
moved to the top of the page underneath the title in an optional dropdown.
The area for inputting text will be at the bottom - with the same rich text
formatting as in the 'Ask Atlas' improvement just made. It should also be
collapsible with the same bottom/right orientation for portrait and
landscape mode as in the Atlas."

# Plan

1. The placing of the panel built for the Atlas
   ([T93](/tasks/T93-axis-panel.md "requires")) is taken out into
   `app/src/lib/axisDock.js` and used by both: beside where the frame is at
   least 900 px wide and wider than tall, below otherwise; folded or open;
   resized by a drag or the arrow keys; each remembers its own.
2. The editor's page is a frame of two: the note and the panel
   (`NoteAxis.svelte`). The page scrolls as before; the panel stays in view
   (sticky) and scrolls inside.
3. Folded, the panel is gone and an "Axis" button on the editing bar opens
   it; the panel's own "Axis" button folds it.
4. The details form (`EditDetails.svelte`) is a `<details>` under the note's
   title, which now heads the editing page. The column beside the note and
   the sheet on a phone go.
5. The question is written in the note editor's live preview, at the foot
   of the panel.

# Acceptance

- At 1280 px the panel is to the right of the note; on a phone upright it is
  below, above the formatting bar.
- It folds, is resized by a drag, and is as it was left after a reload.
- The details are under the title, closed until asked for, and a title
  changed there heads the page.

# Done

2026-10-08, on `feat/axis-panel`.

- All of the plan. In the Station theme the panel stops above the status
  line.
- Below the note the place to ask is compact: what is marked and what is
  let share a line or two with the model and Figure, and the question and
  Ask share the last line.
- Checked by `e2e/assist.py` (71 checks with T97 and T98). `e2e/compose.py`
  and `e2e/edit.py` were changed for the dropdown but not run: they need the
  differential-geometry test bed, which is not on the codespace used.
- Not tried on a real phone: how the panel sits with an on-screen keyboard
  that covers the page (iOS) is unknown.
