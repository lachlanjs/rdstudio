---
type: Design
title: Map view
description: Criteria and design for the nested map of a knowledge base, where folders are regions and links are drawn at the scale they belong to.
status: draft
tags: [design, dashboard, map]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T04:20:31Z }
---

# Purpose

The graph shows every note and link at once, which stops working as a bundle
grows. The map follows the [nested networks](/ideas/learning/nested-links.md)
idea from the [manifesto](/ideas/manifesto/characterising-complexity.md):
folders are regions, and each link is shown at the scale where it lives. It
sits beside the graph until it replaces it or proves it should not.

# Criteria

Each is checkable by looking at a screenshot or reading the code.

1. **Label budget.** At any zoom level at most *N* labels are shown, most
   important first. *N* is a setting (default 30), because the right value is
   only known through use.
2. **Links at their scale.** A link is drawn between the most specific
   *visible* items containing its two ends. Links inside a closed folder are not
   drawn; links between closed folders are merged into one line whose width
   shows how many it stands for.
3. **Cross-scale links separately.** Links between notes in the same folder and
   links that cross folders can each be shown alone.
4. **Folders are regions.** Every folder is a visible region containing its
   notes and subfolders; nesting is never implied only by lines.
5. **Stable.** The same bundle gives the same layout; small edits move little.
   No simulation runs on open.
6. **Progressive detail.** Zooming into a folder opens it and shows its
   contents; zooming out closes it. The detail threshold is a setting.
7. **Orientation.** The current place is always visible as a folder path, and
   stepping out is one action.
8. **Importance is visible.** Landmarks (`landmark: true`) and central notes
   are larger and labelled first.
9. **Works on a phone** at 390 px wide with touch (pinch, tap).
10. **Theme-aware** and readable in every theme, light and dark.

# Design

- **Layout:** nested circle packing of the folder tree (d3 `pack`). Note
  size grows with importance (landmark flag, then PageRank over links). Within
  a folder, notes are ordered so linked notes are packed next to each other.
- **Detail:** a folder is open when its on-screen radius exceeds the detail
  threshold; the root is always open.
- **Links:** each end climbs to its highest ancestor that is visible (a note
  or a closed folder); lines between the same pair are merged.
- **Interaction:** click a note to open it, click a folder to zoom to it,
  click empty space to step out; the folder path at the top is clickable.

# Settings

Label budget, detail threshold, which links to show (all, within folders,
across folders, none). Stored per browser, like the graph's.
