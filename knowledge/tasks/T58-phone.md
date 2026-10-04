---
type: Task
title: "T58 — Phone layouts"
description: "The bottom tab bar, Today and the workbench at 390 wide, pins hanging under their paragraph, marking actions in place of the tab bar while an exercise is open."
tags: [task, m12, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T09:00:00Z }
---

# Prompt

Step 7 of the redesign; sketches PhoneToday, PhoneWorkbench, PhoneAtlas.

# Outcome (2026-10-05)

At 760px and below, following PhoneToday, PhoneWorkbench and PhoneAtlas.

- **The shell:**
  - The top bar is one row: the wordmark, the project and a search icon
    that opens the palette.
  - The spaces are a bar at the bottom: Today (with its count), Library,
    Practice, Atlas and More, each a 44px target with a line icon.
  - More opens the You menu as a sheet above the bar; it holds Project,
    Teacher, Settings, light or dark, and full screen.
  - Page heights subtract the bar (`--tab-h`), so the Atlas and the panes
    end above it.
- **The workbench:**
  - While an exercise is open, the tab bar gives way to its marking actions,
    fixed at the bottom so they show while you read the problem too. The
    first row is the saved status, Versions and Show the solution; the second
    is Mark it yourself and Ask an agent to mark it (or Check).
  - The header becomes a back arrow (Practice).
  - The teacher's cards sit under the answer in the order of the words they
    quote, each hanging by a short stem in its pen's line style (red solid,
    green double, blue dotted). The quote stays on every card.
- **Today:**
  - The teacher's next step hangs under the row it is about, by a stem in
    its pen, whenever Today is one column (up to 1,100px). The margin copy is
    then hidden.
  - Each exercise row is a whole-row target at least 44px tall, on every
    width.
- **The Atlas:** the lens panel folds to one bar naming the lenses that are
  on ("Lenses Links, Understanding"), and Change opens it.
- **Also fixed:** a long path in inline code no longer pushes the Teacher
  page sideways on a phone.
- **Not done:**
  - Pins inside the answer's own paragraphs: the answer is one editor, so the
    cards follow it rather than interleaving with its paragraphs.
  - The "Diagnostic 1 · 3 of 3" title in the exercise header: it says
    Practice.
  - Phone labels falling below or to the left at the screen edge: the
    Atlas's existing label placement already tries right, left, above and
    below.
- **Checked:**
  - `e2e/teacher.py` (94): the marking bar and back arrow, the tab bar, and
    the More sheet.
  - No sideways scrolling on Today, Library, Practice, Atlas, Project,
    Teacher, Settings and an exercise at 390px.
  - Every other walkthrough and suite passes. `e2e/learn.py` failed once
    with an element not found and passed in three runs after.
