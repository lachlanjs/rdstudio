---
type: Design
title: Map view
description: Criteria and design for the Atlas, the nested map of a knowledge base, where folders are regions, links are drawn at the scale they belong to, and the terrain shows where you stand.
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
- **Style (T57, the Atlas):** cartographic, in the Marginalia brand with the
  Survey direction's terrain (design/project/README.md). Notes are places,
  folders are land with a dashed wall (finer dashes for subfolders), the name
  and note count along the arc just outside the wall when open, a solid disc
  with its name and count when closed. Labels are Martian Mono. Routes are
  neutral lines: structure, not meaning.
- **Markers:** a note's shape comes from its `type` (see Settings). Fill and
  ring are where you stand: a faint outline (and a little smaller) not
  reached, an outline opened, filled worked through, filled with a double
  green ring understood, and a solid red ring when an exercise testing the
  note was missed (the teacher says it needs work). A landmark is drawn
  larger. Colour never stands alone: each state also differs in fill or ring.
- **Terrain (the Understanding lens):** each note adds a hill as high as its
  understanding (0 to 3) and as wide as 0.62 of the distance to its nearest
  sibling, so nested folders get finer terrain. Height is normalised: a note
  alone gives its own level and a crowd gives the crowd's mean, however many
  notes it holds. Contours at 0.4 (the frontier), 0.9, 1.6 and 2.3; reached
  ground is clear, the rest is a dot stipple of fog, and the frontier is
  hachured on the side facing the fog. Terrain is clipped to the top-level
  walls. It is baked per top-level folder on a 112-cell grid in the layout
  worker (`views/terrain.js`), cached by that folder's positions and values,
  and drawn by transforming the paths: when one note's value changes, only its
  folder is baked again. A bake takes about 3 ms whether the folder holds 60
  notes or 3,000. With the learner record off there is no terrain.
- **Smooth terrain (follow-up to T62):** a note's hill is as wide as its
  folder's typical spacing (the median distance to a nearest sibling), so a
  crowd makes a plateau, not a ring per note. There are three contours
  (0.4, 1.3, 2.3), islands too small to read are dropped, and the terrain
  ramps gently to nothing at a contour folder's outline. Outlines are round
  (0.85 of the spacing per child) and kept inside their folder's circle, so
  neighbours never overlap. The top level fills 55% of the map, not 30%.
- **Calmer (T62):** reached ground is a lighter tone and the frontier a thin
  line, with no fog stipple or hachures; walls are thin and solid
  (subfolders dashed). Notes not reached are drawn only once their folder is
  in focus, apart from the frontier and landmarks, and each folder's name
  counts what is reached (12/18). The key is folded behind one button.
  Pointing at a folder keeps its routes, quiets the rest, and shows a card:
  progress, what needs work, what it builds on and what builds on it.
- **The grid (T63, `folders = "grid"`):** everything on square cells: notes
  as 8 by 2 blocks, folders as free-form regions, height as nesting, routes
  by A* along the cells in lanes. Snapped from the smooth layout at once,
  then searched in the worker (`gridBudget`, a fixed number of moves for the
  map's size), kept in the browser and warm-started after changes. See
  `views/grid.js` and [T63](/tasks/T63-grid-atlas.md). Routes are found in the
  worker too. Gaps: 5 cells between notes, 6 between folders; regions reach 5
  cells, 3 more per level of nesting; blocks 11 by 2.
- **Height lenses (T59):** the terrain's height is one of three lenses,
  one at a time. **Understanding** (above) is the learning default.
  **Activity** is the project default: when the note last changed in git (or
  its file's time), this week, this month or this quarter, with 90 days
  untouched as fog; its top state is a plain ring, since recent is not right.
  **Health** is one step each for reviewed by a person, tested by an
  exercise, and current; its top state is a double green ring. The markers
  and the key follow the lens.
- **North:** within each folder, a child's mean depth in the chain of
  requires- and uses-links pulls it north (`north`), so north is later in the
  study order and the arrow on the map says so. Project mode turns it off.
- **Detail:** a folder is open when its on-screen radius exceeds the detail
  threshold; the root is always open. Items fade in as folders open.
- **Links through the hierarchy:** every link is drawn between the items
  that currently show its two ends (a note, or the closed folder hiding it).
  Links between the same pair merge into one thicker route.
- **One question at a time:** the Links lens (on by default) draws one
  trunk per pair of top-level folders, carrying their requires-links (all
  links where none are rated) with implied ones hidden, and its count where
  it runs between them; links inside a folder are not drawn at overview.
  With a folder in focus, the links inside it appear at the shown scale, its
  trunks stay and the other trunks fade. With Links off, only the terrain
  and the folders. A selected note shows only its own links, in the blue pen,
  whether or not Links is on: large dots for what it requires or uses, small
  dots for what builds on it. A study path or a tour replaces the links, it
  does not stack on them. The terrain steps back while links carry the
  detail: at overview with Links on, only the fog and a thin frontier; one
  contour at overview otherwise, or with a folder in focus and Links on; all
  of it with a folder in focus and Links off, or a note selected.
- **Every link (optional, `allLinks`):** the previous behaviour, every link
  at the shown scale, filtered by distance in bubble walls (either the larger of
  the two ends' distances out to the lowest folder they share, or the total
  crossed out and back in; 0 is two notes in the same folder), by rating (see
  [link ratings](/design/conventions.md)), optionally only those touching the
  focused folder, and with implied links hidden: a → c is hidden when c is
  reachable from a through a chain of links at least as strong, never through
  `see also` (a transitive reduction; links inside a cycle of `requires` are
  kept). Routes are styled by their strongest rating: `requires` stronger,
  `see also` dotted.
- **Lanes (optional):** one-way links keep to one side of their route
  (offset along the route's normal, by direction) and two-way links take the
  middle, so opposite directions separate. They spread lines apart but do not
  change where routes cross.
- **Contour folders (T60, the default):** each folder's outline is the
  contour at 0.5 of a field with one bump per child (a note, or a soft disc
  of 0.7 its radius for a subfolder), 0.6 of the median spacing between its
  children wide. A parent's field contains its children's, so outlines nest.
  Positions are the circle layout's; outlines are worked out once per layout
  in the worker (`views/contours.js`), with circles drawn until they arrive.
  Names sit above the outline. The terrain is multiplied by a mask that is 0
  on the top-level outline and rises to 1 a little way inside, so the
  understanding contours stay inside it and the two families of lines never
  cross. `folders = "circle"` keeps the packing's circles, names on the arc.
- **Downhill routes (T60, the default):** a line that meets every contour at
  a right angle runs straight up or down the slope, so routes are shortest
  paths (A*) on a 5-unit grid where a step along the slope is cheap and a step
  across it costs up to 7 times more. High ground costs a little more than
  low, and another folder's interior 6 times more. The slope is that of the
  folder fields plus half the understanding field. Cells a route uses get 25%
  cheaper, so routes gather like streams. Each search is held to a window
  around its two ends. The staircase is straightened and rounded, and a
  folder end stops exactly on the outline. Routes are solved in the worker,
  heaviest first, and kept per pair until the layout or your understanding
  changes. A route is drawn when it arrives. The summary reports how far
  routes are from a right angle where they cross outlines. That is exact only
  where the outline and the understanding contours are parallel, since one
  line cannot be perpendicular to two families of curves that are not.
  `routing = "gates"` keeps the corridor router below.

  Timed on the 1,186-note bundle (desktop): outlines 148 ms and routes 314 ms,
  both in the worker after the map has settled; panning stays at 60 fps.
- **Gates routing:** each folder has a corridor network: a waypoint in the middle of
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
- **Placing without waiting:** the layout (`js/layout.js`) runs in a Web
  Worker. The map appears at once in the starting circle packing and settles
  when the worker is done, keeping the reader's view if they have moved it.
  Finished layouts are cached in the browser, keyed by a hash of the
  contents and the six layout settings, so a reload is already settled.
  Each folder considers only the links with an end inside it, which gives the
  same positions as considering them all.
- **Focus:** with every link drawn, when zoomed into a folder, routes are
  drawn at full strength inside it and faded outside it, so the detail in view
  is clear while routes still show where they lead.
- **Hover:** unrelated places and routes fade; the note's routes come
  forward and its hidden implied links appear faintly.
- **Interaction:** click a note to select it (its links, and a card beside
  it joined by a leader in its pen: where you stand, how many notes it
  requires and build on it, Open the note, its exercise and its study path),
  click it again, double-click it or press Enter to open it; Space selects
  from the keyboard and Escape lets go. Click a folder to zoom to it, empty
  space to let go of the selection or else step out; the folder path at the
  top is clickable.
- **Keeping notes in place:** when the contents change, the new layout
  starts each folder's items from where they sat before (relative to their
  folder) and settles gently, so the rest of the map stays put; a change of
  settings lays out afresh to show what the setting does. A note that moves
  takes its hill with it, since the terrain follows positions.
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
| `detail` | 60 | A folder opens when its radius on screen passes this many pixels |
| `showLinks` | true | The Links lens: trunks between top-level folders, and the links inside the folder in focus |
| `terrain` | true | Show the terrain of the height lens |
| `height` | (by mode) | The height lens: `understanding` (learning, needs the learner record), `activity` (project mode) or `health` |
| `source` | (by mode) | What is mapped: `notes`, or `code` ([the code map](/design/code-map.md); the default in project mode when the code is indexed) |
| `folders` | `"contour"` | Folder shape: `contour` (the outline follows the contents, names above), `circle` (the packing's circles, names on the arc) or `grid` (square cells, blocks and regions) |
| `gridShape` | `"convex"` | The grid's folders: `convex` (boxes with the corners cut, from the snapped layout) or `free` (regions shaped by the layout search) |
| `gridBudget` | 3000 | The grid's layout search, as milliseconds on a reference machine (a fixed number of moves for the map's size) |
| `routing` | `"downhill"` | `downhill` (crosses contours at right angles, gathers in the flats) or `gates` (gates, corridors and bundling) |
| `allLinks` | false | Draw every link at the shown scale instead of trunks, filtered by the settings below |
| `distMeasure` | `"out"` | How distance is counted: `out` (larger of the two ends' walls out to the shared folder) or `path` (all walls crossed) |
| `distMin`, `distMax` | 0, 9 | Range of distances to show, in bubble walls |
| `rateMin`, `rateMax` | 2, 3 | Range of ratings to show: 1 see also, 2 uses (and unrated), 3 requires |
| `hideImplied` | true | Hide links implied by chains of links at least as strong (only when the bundle has ratings) |
| `focusOnly` | false | With every link drawn, when zoomed into a folder, show only links with an end inside it |
| `lanes` | false | With every link drawn, one-way links keep to one side of their route, two-way links take the middle |
| `room` | 0.3 | How much of a folder its contents fill; lower leaves more space between everything |
| `spread` | 1 | How strongly items in a folder push apart to use its space evenly |
| `outward` | 1 | How strongly an item moves to the side of its folder where its links leave |
| `spacing` | 90 | Least gap between neighbouring items, in map units (the map is 1000 across), scaled down inside smaller folders |
| `margin` | 60 | Space between a folder's edge and its contents, where routes reach the gates; scaled like spacing |
| `north` | 5 | How strongly notes later in the study order move north in their folder; 0 in project mode |
| `dot` | 0.6 | A note's marker as a fraction of its slot |
| `dotMax` | 6 | Cap on a marker's radius on screen, in pixels (a landmark's is 2.5 more) |
| `bundle` | 0.1 | How much cheaper a corridor becomes each time a route uses it |
| `detour` | 8 | Cost multiplier for a route segment through a bubble |
| `bow` | 0.12 | Sideways curve of an unobstructed link, as a fraction of its length |
| `width` | 1.2 | Width of a route carrying one link, in pixels |
| `laneGap` | 4 | With lanes on, how far one-way routes sit from the middle, in pixels |

Marker shapes by type (case-insensitive; unknown types are circles):
definition circle; theorem, lemma, proposition, corollary diamond; example
triangle; trick square; reference barred circle; overview star; decision square;
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
