---
type: Task
title: "T61 — The Station theme"
description: "A theme option on top of Marginalia: a late-1970s film computer, chosen in Settings."
tags: [task, m13, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T15:00:00Z }
---

# Prompt

Step 1 of M13; sketches StationToday, StationWorkbench, StationAtlas.

# Outcome (2026-10-05)

- `app/static/themes/station.css`, layered on Marginalia and switched by
  `data-theme="station"` on the root element. Settings has a Theme choice
  beside light or dark; it is kept per browser (`rdstudio.theme`) and applied
  before first paint.
- Tokens from `station-*`, dark and light.
- **Type:**
  - Ioskeley Mono for everything, prose included, in mixed case.
  - Departure Mono for headings, counters and short labels, and only the
    short labels are in upper case: title bars, buttons, spaces and the
    mode tag.
- **The frame:**
  - The spaces are numbered, with the current one reversed.
  - Panels, the teacher's cards and the Atlas's panels have thin cyan
    frames, and section titles are reversed bars.
  - Rows are numbered like log entries (001), with dotted rules.
  - Square corners and scan lines.
- **The Atlas as a deck plan:** a grid ground, cyan walls and contours, and
  pixel labels.
- The pens are unchanged, and cyan is structure only.
- **Also fixed:** the Atlas threw on a project with an empty folder (an
  empty folder is a leaf of the tree, with no note behind it). It now
  counts as height 0.
- **Not done:**
  - The key-legend status line and its keyboard shortcuts.
  - The terminal lean and the retro option.
