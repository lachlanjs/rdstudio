---
type: Task
title: "T52 — One theme: tokens and fonts"
description: "Marginalia as the one theme, dark first: the brand book's tokens, the corrected Charter, the six themes and their extra fonts retired."
tags: [task, m12, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T09:00:00Z }
---

# Prompt

Step 1 of the [redesign](/design/redesign.md); the brand book is `design/project/README.md`.

# Outcome (2026-10-05)

- **One theme:** `app/static/themes/marginalia.css`, generated from
  `design/tools/tokens.mjs`.
  - **The tokens:** surfaces, rules, text, the three pens and their soft
    fills, the focus ring and the syntax roles, dark in `:root`, light under
    `data-mode="light"` or a light system with `data-mode="system"`.
  - **Also:** the four font families, space and radius.
  - **The old variable names** (`--paper`, `--ink`, `--accent`, the route
    and group colours) now point at the brand's tokens, so the rest of
    `app.css` keeps working until each screen is rebuilt. Nothing but the
    pens carries hue: the old category and folder colours are neutral now.
- **Dark first:** the page starts dark unless light, or following the
  system, was chosen. Settings keeps "Light or dark" and loses the theme
  picker. `report.js` follows the same rule.
- **Fonts:**
  - **Charter** is replaced by the corrected files from the design: the
    supplied files had their descender sign wrong, which drew underlines
    through the letters.
  - **Removed:** Literata, Atkinson Hyperlegible Next, Inter and IBM Plex
    Sans, with their licences. Six theme files went with them.
- **Base styles:**
  - **Interface:** Ioskeley Mono at 14 px.
  - **Links:** the blue pen, dotted.
  - **Focus:** the blue focus ring.
  - **Buttons:** square-cornered, with a control border. Primary is
    inverted neutral (no accent colour); danger is the red pen's outline.
  - **Chips:** outlined, small corners.
  - **Headings:** Charter bold at the brand's sizes; list titles in Charter
    regular.
  - **Code highlighting:** the brand's five roles: violet keywords, amber
    literals, italic comments, bold names.
- **Fixed on the way:**
  - **Charts:** Mermaid measured text before Ioskeley Mono had loaded, so a
    chart's legend overran on a phone. Drawing now waits for fonts, and fits
    again when they arrive.
  - **Pins:** the answer editor could place pins before a reloaded draft
    filled it, dropping them (it passed by timing before). The text is
    synced first, and pins are re-placed only when they change or the text
    is replaced, so typing still carries them along.
- **Checked:** every suite, `mise run agree`, and every walkthrough
  (`edit.py` checks selection contrast in both modes).
