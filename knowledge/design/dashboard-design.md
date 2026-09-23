---
type: Design
title: Dashboard design
description: Visual tokens and layout rules for the dashboard, and why they were chosen.
tags: [dashboard, design]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T06:40:00Z
---

# Direction

A researcher's lab notebook for mathematical work, read on desktop and phone.
One bold element, the graph on an engineering-grid ground; everything else quiet.

# Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| paper | `#f4f6f2` | `#141a20` | page ground |
| ink | `#1c2632` | `#e2e8e3` | text |
| rule | `#d9e1da` | `#2b353d` | dividers |
| accent | `#5646c0` | `#a597f2` | links, current tab |
| reviewed | `#2e7a58` | `#5fbf8f` | human-reviewed |
| machine | `#5b6b7a` | `#93a4b3` | machine-confirmed |
| unverified | `#a86f12` | `#e0a847` | hollow dot |
| stale | `#b0413e` | `#ec7a73` | changed since review |

Type: Literata (reading, headings; pairs with KaTeX) and Atkinson Hyperlegible
Next (interface). Both vendored, no network.

# Layout

- Desktop: tree 272 px, text column capped at 72ch, frontmatter panel 288 px.
- Below 1180 px the panel moves under the text; below 760 px the tree becomes
  a drawer and the tabs take a second header row.
- Sentence case everywhere; no all-caps labels.
