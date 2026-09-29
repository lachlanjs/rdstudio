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
categories (`--cat-*`), group palette (`--g0`…`--g7`), fonts (`--font-text`,
`--font-ui`, `--font-mono`, optional `--font-heading`), `--text-size` and
`--radius`. `fonts.css` declares every face; a browser downloads only those the
active theme uses.

Themes also restyle the page and the map through optional tokens, each with a
default in `style.css`: page texture (`--page-image`), heading sizes, the map
canvas (`--map-canvas`, `--map-image`, `--map-size`), folder regions
(`--region-open-alpha`, `--region-closed-alpha`, `--region-dash`), places
(`--place-fill`, `--place-font`), routes (`--route-from`, `--route-to`,
`--route-both`, `--route-opacity`) and territory names (`--territory-font`,
`-style`, `-size`, `-weight`, `-spacing`, `-ink`).

**No filters on the map.** Glows, blurs and the pencil wobble were SVG and CSS
filters, repainted on every zoom step; on a 1,186-note bundle they turned
0.2 s of pauses during a pan and zoom into 6 to 19 s
([T31](/tasks/T31-benchmarks-and-event-ids.md)). Themes use fills, strokes,
dashes and opacity only.

| Theme | Reading / interface | Light | Dark |
|---|---|---|---|
| Studio (default) | Literata / Atkinson Hyperlegible Next | engineering paper, violet | slate, lavender |
| Notebook | Literata / Atkinson, Caveat headings and map labels | ruled exercise book, blue-black ink, broken pencil outlines | chalkboard |
| Map | Source Serif 4 / Source Sans 3 | topographic chart: land tints, dash-dot borders, contour sea, cased roads | night navigation chart |
| Space | IBM Plex Sans, Plex Mono labels | celestial atlas | star field, nebulae, bright stars |
| Cyber | IBM Plex Sans / JetBrains Mono | hard-edged daylight grid | neon on black, grid and scanlines |

The choice is stored as `rdstudio.look`; choices from before this set
(`rdstudio.theme`) map to Studio, Map or Cyber.

Mode is `system` (follows the OS), `light` or `dark`, set with
`data-mode` on the root element. Settings live in localStorage.

# Layout

- Desktop: tree 272 px, text column capped at 72ch, frontmatter panel 288 px.
- Below 1180 px the panel moves under the text; below 760 px the tree becomes
  a drawer and the tabs take a second header row.
- Sentence case everywhere; no all-caps labels.
