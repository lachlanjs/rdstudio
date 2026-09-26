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

- **Layout:** circle packing of the folder tree gives a starting
  arrangement. Then, from the top down, each folder's contents are scaled to
  fill only a share of it (`room`) and spread out by a short, fixed-length
  force simulation inside its wall: items push apart evenly, keep a minimum
  gap (`spacing`), stay clear of the wall (`margin`), linked siblings are
  drawn together, and each item is drawn towards the side of the folder where
  its links leave (`outward`), which shortens routes and reduces crossings. A
  final pass separates anything still overlapping. The simulation has no
  randomness, so the same bundle always gives the same map. Note markers are
  a fraction (`dot`) of their slot, capped on screen.
- **Style:** cartographic. Notes are places, folders are territories (faint
  fill, thin boundary, name along the top when open, in the middle when
  closed), links are routes. Plain background.
- **Markers:** a note's shape comes from its `type` (see Settings); landmarks
  get an outer ring, whatever their shape.
- **Detail:** a folder is open when its on-screen radius exceeds the detail
  threshold; the root is always open. Items fade in as folders open.
- **Links through the hierarchy:** every link is drawn between the items
  that currently show its two ends (a note, or the closed folder hiding it).
  Links between the same pair merge into one thicker route.
- **Which links:** filtered by the level of the lowest folder both ends share
  (0 is between top-level topics), by rating (see
  [link ratings](/design/conventions.md)), optionally only those touching the
  focused folder, and with implied links hidden: a → c is hidden when c is
  reachable from a through a chain of links at least as strong, never through
  `see also` (a transitive reduction; links inside a cycle of `requires` are
  kept). Routes are styled by their strongest rating: `requires` stronger,
  `see also` dotted.
- **Routing:** each folder has a corridor network: a waypoint in the middle of
  each gap between neighbouring items (Delaunay triangulation of their
  centres), one in the open space of each triangle, and a *gate* on the
  folder's edge directly outward from each item, with gates joined by a ring
  road that follows the wall. A route is planned top-down: across the lowest
  folder containing both ends, then, in each folder on the way down, from the
  point where it crosses that folder's edge to the next item inward. Routes
  are shortest paths (segments through an item cost more), straightened where
  clear and drawn as B-splines. Corridors already used get cheaper, so links
  heading the same way share gates and form trunks. Routes are computed in
  layout units and cached until the set of open folders or a setting changes.
- **Focus:** when zoomed into a folder, routes are drawn at full strength
  inside it and faded outside it, so the detail in view is clear while routes
  still show where they lead.
- **Hover:** unrelated places and routes fade; the note's routes come
  forward, dark towards what the note needs and in the accent colour from what
  needs it (direction by colour, not arrows), and its hidden implied links
  appear faintly.
- **Interaction:** click a note to open it, click a folder to zoom to it,
  click empty space to step out; the folder path at the top is clickable.
- **Measurement:** the Tuning panel reports routes, crossings through bubbles
  that are not the route's own, crossings between routes, and stretch (route
  length over straight-line distance). Defaults were chosen by sweeping the
  parameters on the differential geometry bundle and minimising these.

# Settings

Three layers, each overriding the one before: built-in defaults, the
project's `[map]` table in `rdstudio.toml`, and choices made in the browser
(stored per browser). The Tuning panel's "Show as rdstudio.toml" prints the
current values in the right form to copy into a project.

| Setting | Default | What it does |
|---|---|---|
| `labels` | 30 | Most labels shown at once, most important first |
| `detail` | 140 | A folder opens when its radius on screen passes this many pixels |
| `showLinks` | true | Draw links at all |
| `levelMin`, `levelMax` | 0, 9 | Range of the lowest shared folder's level (0 = between top-level topics) |
| `rateMin`, `rateMax` | 2, 3 | Range of ratings to show: 1 see also, 2 uses (and unrated), 3 requires |
| `hideImplied` | true | Hide links implied by chains of links at least as strong (only when the bundle has ratings) |
| `focusOnly` | false | When zoomed into a folder, show only links with an end inside it |
| `room` | 0.3 | How much of a folder its contents fill; lower leaves more space between everything |
| `spread` | 1 | How strongly items in a folder push apart to use its space evenly |
| `outward` | 1 | How strongly an item moves to the side of its folder where its links leave |
| `spacing` | 90 | Least gap between neighbouring items, in map units (the map is 1000 across), scaled down inside smaller folders |
| `margin` | 60 | Space between a folder's edge and its contents, where routes reach the gates; scaled like spacing |
| `dot` | 0.6 | A note's marker as a fraction of its slot |
| `dotMax` | 10 | Cap on a marker's radius on screen, in pixels |
| `bundle` | 0.1 | How much cheaper a corridor becomes each time a route uses it |
| `detour` | 8 | Cost multiplier for a route segment through a bubble |
| `bow` | 0.12 | Sideways curve of an unobstructed link, as a fraction of its length |
| `width` | 1.2 | Width of a route carrying one link, in pixels |

Marker shapes by type (case-insensitive; unknown types are circles):
definition circle; theorem, lemma, proposition, corollary diamond; example
triangle; trick square; reference open ring; overview star; decision square;
task triangle; question cross; idea wye; procedure star. Available shapes:
`circle`, `ring`, `diamond`, `triangle`, `square`, `star`, `cross`, `wye`.

```toml
[map]
detail = 180
spacing = 50

[map.markers]
Module = "square"
Interface = "diamond"
```
