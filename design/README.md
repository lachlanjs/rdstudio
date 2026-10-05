# Redesign: design system and sketches

The output of the redesign described in
[`knowledge/design/redesign.md`](../knowledge/design/redesign.md): tokens,
fonts, usage rules and 53 static sketches, plus the scripts that generate
them. The app has since been built from the first set (M12); the later
sketches listed under "Added since M12" are proposals and are not in the app.

## What is here

| Path | What |
|---|---|
| `project/README.md` | The brand book: content rules, tokens in use, the pens, the Atlas, decisions on record. Read this first. |
| `project/tokens.json` | Colour (dark and light), type, spacing and radius tokens. |
| `project/fonts/` | Charter, Ioskeley Mono, Martian Mono, Departure Mono and the KaTeX fonts. Licences are in `project/assets/Licences/`. |
| `project/components/<Name>/preview.html` | One sketch each, a self-contained page at 1440 by 900 (phone sketches are 390 by 844 frames). Each has a `README.md` beside it. |
| `tools/` | The generator. `tools/old/` holds copies of the app's own `layout.js` and `makeRouter`, used to position and route the Atlas sketches. |

## Rebuild the sketches

```sh
cd design/tools
npm install
npm run build            # writes project/ and a local harness/
npm run shot -- AtlasLinks ProjectToday      # screenshots into design/shots/
npm run audit -- AtlasLinks ProjectToday     # text contrast check
```

`shot` and `audit` need a Chromium that Playwright can find; set
`CHROMIUM_PATH` to use a specific one. To view a sketch by hand, open
`design/harness/<Name>.html` after a build.

## Added since M12

None of this is in the app. Each is a set of sketches and the script that
draws them.

- **Station terminal theme** (`tools/station.mjs`, `Station*` sketches): a
  third chooseable theme beside the terminal lean and retro-futurist. Mixed
  case, upper case for labels only.
- **Maths font sheet** (`tools/mathfonts.mjs`, `MathFonts`): seven of the MathJax 4
  fonts beside KaTeX with Charter letters, rendered at build time from
  `tools/mathfonts/*.json`.
- **Calmer Atlas** (`AtlasCalm`, `AtlasCalmHover`): the contour Atlas with
  less drawn at rest.
- **Grid Atlas** (`tools/grid.mjs`, `GridAtlas*`, `StationGridAtlas*`): a
  third folder shape, `grid`, beside `circle` and `contour`. Notes are blocks
  of cells, height is nesting, routes are A* over cells and end on block
  edges. The kind of note is a glyph in the block.
- **Searched grid layout** (`tools/gridopt.mjs`, `GridExperiment`,
  `GridFreeAtlas*`, `GridLooseAtlas*`): note positions and routes optimised
  together by simulated annealing, with folders as free-form regions of
  cells. `GridExperiment` holds the measured comparison of six layouts. The
  preferred one is loose (4 clear cells between notes), with routes charged
  for running side by side and later study weighted north: 89 crossings and
  23% of route beside another route, against 211 and 75% for the unsearched
  grid. `tools/gridopt-cache.json` holds the searched positions so a build
  does not repeat the search (about four minutes for all four); delete it to
  run the search again.

Open on the grid Atlas: the layout is recomputed from scratch, so it is not
stable when notes are added and there is no dragging or pinning; cells are
small at overview in the loose layout (5.6px); folder shapes are irregular;
each search was run with one seed on placeholder links; nothing is tested
beyond 63 notes; the searched layouts have no station-theme sketches.

## What is decided

- Direction A (Marginalia) with Survey's terrain on the Atlas. Directions B
  and C are kept for reference and are stale.
- The three pens: red solid is critical, green double is right, blue dotted
  is discussion and links. Colour never stands alone.
- Two modes, set per project: Learning and Project. Learning features (the
  understanding lens, tours, the teacher's pin) sit on top of a project.
- The Atlas shows one question at a time. Links are on by default and
  filtered: requires-links only, implied ones hidden, one trunk per pair of
  folders at overview. A selected note shows only its own links.
- Folder shape and routing are per-project settings. `contour` outlines with
  `downhill` routing is the default; `circle` with `gates` (the existing
  router) is the option.
- Marker shape is the kind of note; fill and ring are understanding.
- Terrain height is the mean level of nearby notes, not the sum.
- Exercise status has four values, including in progress; half-done work is
  kept in persistent state.
- On a phone, the marking actions replace the tab bar while an exercise is
  open.
- The terminal lean and the retro-futurist theme are user settings.
- Code is highlighted with two hues no pen uses.

## What is not done

- **Everything is a static sketch.** There are no components; the next step
  is to build the tokens and components in `app/`.
- **Placeholder content.** The ramplib files, commits and reviews, the
  differential geometry links and understanding levels, and the variance
  scaling note are invented.
- **Scale is untested.** The terrain and the downhill router have only run
  on 63 notes. The sketch code is direct and slow; see the Atlas section of
  `project/README.md` for how to bake both in the layout worker.
- **`tools/old/layout.mjs` differs from the app's `layout.js`** by one added
  force (later in the study order sits further north) and nothing else.
- **Charter's metrics are corrected.** The supplied files had the descender
  with the wrong sign, which drew underlines through the letters. The copies
  in `project/fonts/` have it fixed; use these, not the originals.
- **Not sketched:** light versions beyond the workbench and the code sheet;
  project mode on a phone; Study path, Tour and Goal on the new Atlas; the
  command palette open; the You menu; the Practice landing page.
- **Known rough edges:** subfolder outlines can still be crossed by terrain
  contours; a fully reached folder shows a frontier just inside its outline;
  the health lens needs three facts per file that the app may not have.
