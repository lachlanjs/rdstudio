---
type: Task
title: "T64 — The grid Atlas: a layout from the DAGs in each folder"
description: "Lay out the grid Atlas bottom-up: in each folder find a DAG among its links, place it
  by the Sugiyama method, freeze it, and repeat one folder up with subfolders as single items; back
  links are routed last at their own level."
tags: [task, m13, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-06T03:13:10Z}
---

# Prompt

The developer's idea for the DAG-based grid Atlas layout (2026-10-05):

- Within the deepest folder:
- Find a subgraph (subset of edges) which forms a DAG
- Call this subgraph the "DAG Subgraph" for that folder
- Do not use insignificant "See also" connections in computing this
- Compute a DAG layout using this and place it in the grid using the Sugiyama layout algorithm
- Identify the remaining connections as "back" connections - these will be routed later
- Call this subgraph (with the back connections) the "Complete Frozen Subgraph" for this folder.
- Proceed to the next folder layer up, which introduces:
    - New nodes
    - New "Complete Frozen Subgraphs" and their "DAG Subgraphs"
- Of the DAG Subgraphs and Nodes, calculate a new DAG Subgraph which incorporates these
- This forms the DAG subgraph for this next folder up
- Use this new DAG subgraph to organise the folders and nodes at the level of the current folder
- The layout of the nodes inside the folders within the current level should only change as long as the following requirements are met:
    - The nodes of a subfolder can be bounded within a convex hull surrounded by edges which can be vertical or at 45 degrees
    - These convex hulls must not overlap with the convex hulls at their level
- Once this is complete, identify the back connections, which will be routed later
- Continue up the directory levels applying the same steps until reaching the top
- Route the collected back connections at their directory level, avoiding dense crossings and ensuring no overlap with folder boxes

Follows [T62](/tasks/T62-grid-atlas.md), whose layout interface it implements
in place of the placeholder. [Decision](/decisions/grid-atlas.md).

# Plan

A first reading by the agent, to be confirmed with the developer before
implementation. Where it interprets the prompt, it says so.

1. **Each link has a level:** the lowest folder containing both ends. At
   that level it joins the two items (a note, or a subfolder standing for
   everything in it) that hold its ends. This is the map's existing rule of
   links at their scale ([design](/design/map-view.md)). Links between the
   same two items merge, weighted by their count.
2. **The DAG subgraph of a folder.** Take its items and its links rated
   requires or uses (unrated counts as uses; see also is left out). Find the
   groups of items that reach each other in a circle (strongly connected
   components; `views/map.js` already has the code). Inside each group, mark
   as back links the fewest and weakest that break every circle: uses before
   requires, lighter before heavier. Everything else is the DAG.
3. **Sugiyama on cells,** written here with no new dependency:
   - *Layers:* each item sits one layer after the latest thing it builds on.
     Later study is north, so layers run from south to north, as the Atlas's
     north already means.
   - *Order within a layer:* sweeps that put each item at the average place
     of its neighbours in the next layer, keeping the order with fewest
     crossings.
   - *Cells:* a layer is as tall as its tallest item plus clear rows for
     routes. Items are placed left to right with the clear cells T62 uses (2
     between notes, 3 between folders), each pulled towards its neighbours.
   - *Long links* (crossing more than one layer) reserve a column of free
     cells in each layer they pass, which the router then uses.
4. **Freezing.** A laid-out folder becomes one rectangle (its contents, the
   title row and the margin) and is one item in its parent's layout.
   Interpretation: to begin with, nothing inside moves when the parent is
   laid out, except that a folder may be mirrored left to right when that
   reduces crossings. A rectangle is the simplest hull with vertical,
   horizontal and 45 degree sides, and rectangles are placed without overlap,
   so both of the prompt's conditions hold. Looser hulls, and contents that
   shift to meet links from outside, are a later step.
5. **Routes.** The DAG's links are routed first, level by level, along the
   reserved columns. The back links are routed last, each at its own level,
   by T62's router: the charge for running beside another route spreads
   them, and a folder that holds neither end is closed to them.
6. **The interface** from T62 is unchanged: blocks, folder regions, and for
   each link whether it is in the DAG or back, its level and its reserved
   cells.
7. **Measured against the placeholder** on the Tuning summary's numbers
   (crossings, cells of route, share beside another route, north kept), on
   dg and on field.

Open questions for the developer:

- **What may change inside a frozen folder** when its parent is laid out:
  nothing but a mirror, as proposed, or more?
- **Stability.** A new note or link can change layers and move much of a
  folder. Is that acceptable, or should a layout start from the last one?
- **Width.** A folder whose notes all sit in one or two layers becomes a
  long row of 8-cell blocks. Should a wide layer wrap onto several rows?
- **The DAG's own links:** routed as above, or drawn as straight runs
  between layers?

# Acceptance

- Every requires or uses link in a folder's DAG points north.
- Back links are identifiable on the map and never cross a folder they do
  not belong to.
- The same bundle gives the same layout.
- The comparison with the placeholder is recorded here.

# Outcome

A first version, built on 2026-10-06 on `grid-dag-view`; not committed, and
for the developer to look at before the plan above is brought up to date.
It is the grid Atlas's default layout (`gridLayout = "dag"`, or Grid layout:
Layers under More options); `gridLayout = "snap"` keeps T62's.

The developer's answers (2026-10-06), with a picture of a hierarchic layout
with group nodes as the target:

- Anything inside a subfolder may move when its parent is laid out, as long
  as the DAG found in it is kept; how far to use that is the agent's call.
- What happens when notes are added or moved is the next thing to work out,
  not part of this.
- Wide layers: whatever reads best.
- Links are never straight lines: any of the eight directions, usually
  across, down and across; back links may take longer ways round to avoid
  crowding and note blocks.
- A folder may be an eight-sided convex polygon.

**What was built** (`app/src/lib/views/grid/dag.js`):

- **One DAG for the whole map,** not one per folder. The first attempt
  followed the plan above (each folder laid out alone, then stacked as one
  block in its parent) and gave a tower: 95 by 400 cells on the abstract
  algebra bundle, because Groups, Rings, Fields and Galois each wait for the
  one before. The picture shows the other way: layers shared by everything,
  and a folder as a box round the layers its notes sit in. Restricted to any
  folder, the whole map's DAG is still a DAG, so the developer's "DAG
  subgraph" of a folder is kept.
- **The DAG:** an order of the notes with as much weight of requires- and
  uses-link pointing forwards as possible (Eades, Lin and Smyth's greedy
  order). Links against it are back links.
- **Layers:** a note sits one layer above the highest thing it requires. A
  note requiring nothing sits just under the first note that needs it; a
  note with no links sits at the foot of its folder.
- **Folders** span their notes' layers, stand side by side where those
  overlap, and can stand on one another. Rectangles with cut corners.
- **Across:** from the deepest folders up, each folder's items are ordered to
  keep linked items close, then placed half way between as far left and as
  far right as the items before them allow.
- **Wrapping:** many notes of one folder in one layer wrap onto several rows.
- **Routes:** T62's router, the DAG's links first and back links last, drawn
  dashed. No columns are reserved for long links.
- **Not used yet:** the freedom to move things inside a subfolder to suit its
  parent. A subfolder is arranged by its own links only.

**Measured** on the abstract algebra bundle (90 notes, 200 links):

| | Grid | Overview | Groups in focus |
|---|---|---|---|
| Snapped (T62) | 140 by 159 | 6 trunks, 1 crossing, 58 cells | 104 routes, 446 crossings, 3,128 cells |
| Layers | 254 by 207 | 6 trunks, 1 crossing, 100 cells | 104 routes, 400 crossings, 4,699 cells |

Every link the layout placed runs north, across folders as well as inside
them. Crossings are a tenth fewer and routes half as long again, so on these
numbers it is not yet better than the snapped layout; what it gains is the
order.

**Problems:**

- **Shallow bundles become a strip.** The generated 1,186-note bundle, whose
  links are random and few layers deep, comes out 4,419 by 577 cells, and its
  15 trunks take 11.7 s to route (0.5 s snapped). Folders that share layers
  can only stand side by side.
- **Tall, thin folders.** A folder with one or two notes a layer is a column,
  and links between its own notes must pass beside the notes between.
- **Crossings inside a folder in focus are high** (400), since subfolders are
  arranged without regard to links leaving them.

**Checked:** 5 unit tests (blocks, placed links run north, the same result
for the same bundle, the order of a cycle, a thousand notes in 1.2 s), the
app's 40 tests and type check, and by eye on the abstract algebra bundle.
The layout takes 79 ms at 63 notes and 199 ms at 1,186. The walkthroughs
have not been run (no test bed on this machine).

## Second version (2026-10-06)

The developer sent a second picture (yWorks, hierarchic layout with
subcomponents) as the clarity to aim for, and approved six steps. Built so
far: 1, 3 and 4, and the part of 2 that orders folders with the whole map in
mind. Not committed.

- **1. Implied links are left out.** A link is implied when a chain at least
  as strong joins the same two notes; the layout marks them and the Atlas
  hides them (Hide implied, on by default). On the abstract algebra bundle
  that is 15 of 200.
- **3. Reserved columns and alignment.** A link that passes rows keeps a
  free column one cell wide in each, in the deepest folder on its way. The
  links up from one note share their columns, so they rise as one trunk and
  branch where they arrive. Each item is then drawn under and over what it
  is linked to, as far as its neighbours allow.
- **4. Routes by rule.** A link of the DAG leaves the foot of the note that
  requires, runs across in the free rows between two rows of notes, and down
  its column to the head of the note required. Runs between the same two
  rows take tracks of their own, and the gap grows to hold them. The layout
  hands these paths to the Atlas, which draws them at once; only back links
  and links to closed folders go to the router.
- **2, in part.** Every folder's order is improved with the others: an item
  moves towards the notes its links lead to anywhere on the map, and so does
  every folder round it. This is where the freedom inside subfolders is
  used. Crossings are not counted or minimised directly yet.
- **The whole map with its notes:** folders now open from a cell of 1.6px
  (was 3) and a width of `detail` (was twice that), so a bundle of this size
  shows every note and link at overview.

On the abstract algebra bundle: 307 by 294 cells; of 185 links shown, 183
are drawn on the layout's own paths and 2 are back links.

Still to do: 5 (self-contained folders as their own blocks, which is also
the answer to shallow bundles becoming a strip: the generated 1,186-note
bundle is 3,068 by 508 cells), 6 (hulls with 45 degree corners), counting
and minimising crossings, and keeping runs clear of folder titles. Runs
down pass through the title rows of the folders they enter.

Checked: 20 unit tests in `grid/grid.test.js`, among them that every path
is square, runs south, starts on a note's foot, ends on a note's head and
passes through no note; the app's 41 tests and type check.

## Third version: the nested layout (2026-10-06)

The developer judged the shared-layer versions too dense, agreed that every
link at once is the wrong aim, and gave a mock-up of differential geometry
("Each folder a DAG") as the target. Decided by the developer:

- **Each folder is a layered DAG of its items, and one item in its
  parent's.** Links between folders join their walls, as one trunk with a
  count.
- **Flow turns at each level:** the top level bottom to top, its folders'
  contents left to right, theirs bottom to top, and so on. On a phone turned
  on its side the top level runs left to right, with both worked out and
  ready.
- **Links light up on demand.** Pointing at a note shows what it depends on,
  each link drawn all the way to the note, not to its folder. Later: animate
  the route being drawn from start to end, then the stroke round each
  dependency.
- **Larger notes,** with room for their text, and 45 degree corners on link
  paths and folder outlines.

**Built** (`app/src/lib/views/grid/nested.js`, now the default;
`gridLayout = "layers"` and `"snap"` keep the earlier two; not committed):

- The DAG, layers, wrapping, order, alignment, shared lanes and tracked
  routes of the second version, applied to one folder's items at a time.
- A note is 14 by 4 cells, two lines of title.
- The layout's `trunks` carry their own paths. Back trunks and implied ones
  have none: back trunks are routed by the 8-direction router and dashed;
  implied ones are hidden.
- `gridFlow`: `auto` (up; right on a touch device wider than tall), `up` or
  `right`. A layout is kept per direction, and on a touch device the other
  is worked out in the background.
- **Hover or select a note:** every link down its chain of requirements as a
  line in the blue pen, the links from what builds on it dotted, those notes
  outlined, the rest stepped back. A link inside one folder uses the
  layout's path; one between folders is routed note to note through the
  walls. An end inside a closed folder is drawn to that folder.
- Link bends and folder and note corners are cut at 45 degrees.

**On the abstract algebra bundle:** 248 by 273 cells flowing up (500 by 143
flowing right). 183 links: 107 trunks on the layout's own paths, 2 back.
The generated 1,186-note bundle is 1,050 by 1,189 cells, both directions
laid out in 110 ms.

**Not done:** the animation; a hull that hugs a folder's contents (outlines
are rectangles with cut corners); lit links between folders are found by the
router, so they can run over the resting trunks instead of along them; the
phone's lens panel covers part of the map when on its side (T63).

**Checked:** 27 unit tests in `grid/grid.test.js` (for both directions:
blocks inside their folders, trunk paths square from edge to edge through
no note and no other folder, what is required earlier along the flow at
every level), the app's 48 tests and type check, and by eye at 1440 by 900,
390 by 844 and 844 by 390. The walkthroughs have not been run.

## After the developer's first look at the nested layout (2026-10-06)

"Much better. Best so far." Two changes asked for and made:

- **Hover lights less.** Inside the note's own folder, its whole chain of
  requirements; beyond the folder, only what it requires directly; and what
  builds on it directly. What was worked out for a note is kept, and the
  layout is sent to the worker once, not with every ask, so pointing again is
  at once. On "Galois's criterion": 8 lit links, where it was 58.
- **Fewer turns.**
  - A trunk enters an item at the cell level with where it comes from, and
    the trunks from an item leave it together level with the middle one's
    port, so two things in line are joined by a straight run. On the
    abstract algebra bundle, of 108 trunks 64 are straight, 37 have two
    bends and 7 more (not measured before the change).
  - The router, which on this layout draws only back links and lit links,
    is charged more for a turn (1.5 and 3, were 0.35 and 0.9).
  - The bends that remain are there to keep trunks apart: a track of its own
    between two layers, and a port of its own on the item.

Then, the same day, on the developer's word:

- **Lit links between folders stay as they are,** routed through the open
  space between folders. Running them along the resting trunks would need
  much wider margins in every folder.
- **Straighter trunks.** A trunk whose port the item it leaves reaches now
  leaves from the cell level with that port, on its own, and only the trunks
  that must turn share a run. Of 108 trunks on the abstract algebra bundle,
  85 are straight (were 64), 17 have two bends and 6 more.
- **A folder's title sits on its top edge,** as part of the edge, not in a
  row inside (`titles: "edge"` on the layout; no cells are closed for it).
  Two free rows under the edge keep a subfolder's title clear of its
  parent's.

**One layout kept (2026-10-06).** On the developer's word the nested layout
is the grid Atlas's only one. The snapped layout (T62's placeholder) and the
shared-layer one are deleted with their settings (`gridLayout`), tests and
the code paths that drew them; `grid/snap.js` and `grid/dag.js` are gone and
`grid/nested.js` says what a layout is. Nothing on the grid depends on the
continuous Atlas's layout any more, so T63 can delete that with the rest.
The router's search is greedier (3.2, was 1.6): a link between folders on a
grid of a thousand notes takes 9 ms, where the dearer turns had made it 130.
The app's 38 tests pass.
