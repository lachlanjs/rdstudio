---
type: Design
title: Dashboard design
description: Visual tokens and layout rules for the dashboard, and why they were chosen.
tags: [dashboard, design]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T06:12:10Z
---

# Direction

A researcher's lab notebook for mathematical work, read on desktop and phone.
One bold element, the graph on an engineering-grid ground; everything else quiet.

# Tokens

Every theme is one stylesheet in `web/themes/` defining the same tokens for
light and dark: `--paper`, `--paper-raised`, `--paper-sunk`, `--ink`,
`--ink-soft`, `--ink-faint`, `--rule`, `--grid`, `--accent`, `--accent-soft`,
trust colours (`--reviewed`, `--machine`, `--unverified`, `--stale`), change
categories (`--cat-*`), graph palette (`--g0`…`--g7`), fonts (`--font-text`,
`--font-ui`, `--font-mono`), `--text-size` and `--radius`. `fonts.css` declares
every face; a browser downloads only those the active theme uses.

| Theme | Reading / interface / code | Character |
|---|---|---|
| Notebook (default) | Literata / Atkinson Hyperlegible Next / system mono | engineering paper, violet |
| Journal | Source Serif 4 / Source Sans 3 / JetBrains Mono | academic, black on white, Oxford blue |
| Modern | Inter / Inter / JetBrains Mono | neutral greys, teal, rounder |
| Blueprint | IBM Plex Sans / IBM Plex Sans / IBM Plex Mono | drafting blue, orange marks |
| Terminal | JetBrains Mono throughout | retro phosphor, square corners |

Mode is `system` (follows the OS), `light` or `dark`, set with
`data-mode` on the root element. Settings live in localStorage.

# Layout

- Desktop: tree 272 px, text column capped at 72ch, frontmatter panel 288 px.
- Below 1180 px the panel moves under the text; below 760 px the tree becomes
  a drawer and the tabs take a second header row.
- Sentence case everywhere; no all-caps labels.
