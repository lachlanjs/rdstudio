A knowledge base for learning hard subjects: notes, a map of how they connect, exercises, and an AI teacher that marks and tutors. Dark first, light second. Calm enough to think in for hours, with one or two things nobody else does.

The wordmark is the word `rdstudio` in lowercase, set in Ioskeley Mono Bold (`label-strong`). No logo was supplied; do not draw one.

## Principles

- Reading comes first: the note and the answer are the brightest things on the screen (`text` on `surface`).
- Colour is meaning, never decoration. Three pens: red is critical, green is right, blue is discussion and links. Nothing else is coloured.
- Every mark from the teacher points at the words it is about.
- Structure is information: a rule, a number or a border says something, or it goes.
- Phone and desktop are the same product, not one squeezed into the other.

## Content fundamentals

- Plain sentence case, second person, no exclamation marks, no emoji. The teacher is "the teacher", the person is "you".
- Buttons name the action: "Mark it yourself", "Ask an agent to mark it", "Continue writing". Counts read in words: "Hint (2 of 3)", "2 of 3 answered", "3 of 4 days".
- State is a short phrase, not a badge: "not yet today", "done today", "nothing due today", "passed", "missed", "not tried".
- Labels are sentence case in `label`; never tracked capitals above a heading.
- Teacher feedback starts with the verdict and quotes the words it is about: "Right, and it is why the variances add."

## Using tokens

- **Surfaces:** `surface` is the page; `surface-1`, `surface-2`, `surface-3` are three steps up for panels, teacher cards and selected rows. Never pure black. Divide with `rule`; give controls a `rule-strong` border.
- **Text:** `text` for anything you read, `text-soft` for labels and nav, `text-faint` for metadata only. All three hold 4.5:1 on every surface in both themes.
- **Pens:** `pen-red`, `pen-green`, `pen-blue` at full strength for lines and text; `pen-red-soft`, `pen-green-soft`, `pen-blue-soft` as the highlight behind marked words. Put `text`, not the pen colour, on a soft fill. Only the pens carry hue.
- **Never meaning by colour alone.** Red is a solid line, green a double line, blue a dotted line. A hint is neutral: a thin overline in `text-soft` and a hollow leader dot.
- **Type:** `body` (Charter 18/1.65) for reading, about 70 characters a line in the Library; the workbench columns are narrower. `label`, `caption`, `code` and `number-lg` (Ioskeley Mono) for interface labels, numbers and code. `map-label` (Martian Mono, set the width axis with `font-variation-settings: "wdth" …`) for map labels only. `pixel-number` (Departure Mono) for big numbers only.
- **Spacing:** a 4px base (`space-1` to `space-16`); 16px phone gutters (`space-4`); 48px desktop page margin (`space-12`).
- **Shape:** `radius-md` (4px) for buttons and cards, `radius-sm` for highlights. No shadows, no blur, no gradients.

## Using components

- **The workbench** (problem, answer, teacher) is the reference layout: problem left, answer in the middle, the teacher's margin on the right. Other screens borrow its columns.
- **Pins, not bubbles.** A teacher card quotes the words it is about (underlined in its pen's line style) and a leader line of the same style joins it to those words in the answer. Cards sit level with their words and stack down when they collide. Order the cards by where their words sit, so leader lines never cross.
- **Streak counters** are numbers first (`number-lg`), labels second, and never shout. Done and not done are a filled and an empty square, not colour.
- **Primary buttons are inverted neutral** (`text` fill, `surface` text). There is no accent colour.
- **Easy to misuse:** the pens. A red that only decorates teaches people to ignore red.

## Accessibility

- WCAG AA for all text on every surface, in both themes. Pen text is for `surface` to `surface-2`; on `surface-3` use `text`.
- A visible focus ring (`focus-ring`, blue): 2px, offset 2px, 3:1 or more on every surface.
- Red pins are solid underlines, green pins double, blue dotted.
- Touch targets of 44px or more on phones. Little motion, only in answer to an action; respect `prefers-reduced-motion`.

## Fonts

- Charter (Bitstream), Ioskeley Mono, Martian Mono (variable: weight 100 to 800, width 75 to 112.5) and Departure Mono ship in `fonts/`. Licences are in `assets/Licences/`; keep them with the fonts.
- The Charter files here have the descender metric corrected: the supplied files carried it with the wrong sign (+236 instead of -236), which makes browsers draw underlines and borders through the middle of the letters. Nothing else in them changed.
- Maths is KaTeX. Its own fonts (`KaTeX_*`, SIL OFL) are bundled in `fonts/` because maths needs glyphs the four brand fonts do not have.
- None of the four fonts has the command key glyph or a check mark; draw the command key as an SVG icon and use line styles for state.

## Sketches

The components are sketches of the redesign, not production components, grouped by direction. Desktop screens are 1440 by 900 and phone screens 390 by 844, dark unless it says light, set in the real content.

- **A · Marginalia** is the base. Colour is meaning: the three pens, each with its own line style. Ioskeley Mono for labels and numbers, Charter for reading.
- **B · Survey** keeps the pens and puts the knowledge base on a survey sheet: a teal-slate ground (`survey-surface` to `survey-surface-3`), Martian Mono labels with the width axis narrowed, a measured rule, grid references beside the streak counters (`A2`, `C2`, `E2`, `F2` are the counters' squares on the sheet's graticule), and the Atlas drawn as terrain.
- **C · Instrument** is a rack of panels with Departure Mono readouts and lamps on a cool ground (`instrument-surface`, `instrument-panel`). The reading surface (`instrument-paper`, `instrument-ink`) is warm graphite and the only warm thing on the screen.
- **A + B** is Marginalia with the Survey Atlas, the recommended combination: Survey's contours, hachures, grid references and north arrow used only on the Atlas.
- **A, terminal lean** is a user setting on top of A, not a fourth direction; its key hints and status line are accepted as designed: square corners, numbered spaces with the current one in reverse video, the palette as a prompt, framed panes with the title set into the border, key hints in brackets on every action, a block caret and a status line. It adds no tokens. The pens, Charter for reading and the leader lines are unchanged.
- **Retro-futurist** is a theme option, not a direction: the terminal lean pushed to an pale phosphor display (`retro-*` tokens), with Departure Mono for names, headings and numbers, reversed title blocks, 2px frames and scan lines. Prose and maths stay in Charter. The pens keep their colours and line styles, so the phosphor tone is never a meaning. It has no glow, because blur and large shadows are ruled out. It breaks one rule of the base on purpose: uppercase labels. It is a user setting, like the terminal lean.
- **Phone** is A with the Survey Atlas at 390 wide: a bottom tab bar (Today, Library, Practice, Atlas, More), 16px gutters, 44px targets. There is no margin on a phone, so a pin hangs under the row or paragraph it is about by a short stem in its pen's line and quotes the words it pins.

### The Atlas: structure first, terrain on top

The two sketches under "Atlas · structure and routes" are drawn by the previous app's own `layout.js` and `makeRouter`, so they show what the engine does today plus what the redesign asks of it.

- **Structure.** Folders are nested regions with a wall; a folder's name follows its wall. A closed folder is a solid disc with its name and note count. This is the circle-packing hierarchy, unchanged.
- **Routes.** A link leaves each folder by a gate on its wall, crosses the lowest folder that holds both ends, and enters by the other side's gates. Links between the same pair of shown places merge into one route, wider with more links. Routes are neutral lines; they are structure, not meaning. The links of the selected note alone are drawn in the blue dotted pen.
- **Terrain.** Each note adds a bump as high as the lens value (understanding 0 to 3) and as wide as 0.62 of the distance to its nearest sibling, so nested folders get finer terrain. The bumps are averaged, not summed (see Height is normalised), contoured, and clipped to the top-level walls so terrain never crosses a wall.
- **North.** One force was added to the layout: within each folder, a child's mean depth in the requires-chain pulls it north. That is what makes "later in the study order" true. Project mode turns the force off.

**One question at a time.** Terrain, structure and links at equal weight are too much. The four sketches under "Atlas · one question at a time" are the intended behaviour; the two marked "Before" show everything at once for comparison.

1. **Links on, the default**: links are visible from the start and filtered to stay calm. One trunk per pair of top-level folders, with its count, even when a folder is open; requires-links only; implied ones hidden. At overview the terrain is the frontier and one contour.
2. **Links off**: terrain and structure only.
3. **A folder in focus**: its inside links appear at the shown scale, its trunks stay, other trunks fade.
4. **A note selected**: only that note's links, in the blue dotted pen, whether or not Links is on: large dots for what it requires or uses, small dots for what builds on it. With Links off the terrain stays in full.

Study path and Tour are routes too: they replace Links, they do not stack on it.

**Exploration: contour folders and downhill routes.** The four sketches under "Atlas · exploration" keep the same positions and replace two things.

- *Folder outlines are contours.* Each folder has a field with one bump per child (a note, or a soft disc for a subfolder), as wide as 0.55 of the spacing between its children. The outline is that field's contour at 0.6. A parent's field contains its children's, so outlines nest.
- *Routes cross contours at right angles.* A line that meets every contour at a right angle runs straight up or down the slope. Routes are shortest paths on a 5-unit grid where a step along the slope is cheap, a step across it costs up to 7 times more, high ground costs a little more than low ground, and another folder's interior costs 6 times more. The slope is that of the folder fields plus half the understanding field. Used cells get 25% cheaper, so routes gather.
- *The two families of contours never cross.* With contour folders, the terrain is multiplied by a mask that is 0 on the folder's outline and rises to 1 a little way inside. Every understanding contour therefore stays inside the outline and runs alongside it near the edge. Subfolder outlines are not masked: the terrain is continuous across them.
- *A trunk ends exactly on the outline* of each folder it joins, never inside it.
- *Measured.* Each sketch reports how far its routes are from a right angle where they cross folder outlines. It is exact only where the folder outline and the understanding contours are parallel, because one line cannot be perpendicular to two families of curves that are not.

**Both strategies stay, as options.** Neither replaces the other. They are two settings, per project, alongside the existing `[map]` settings:

| Setting | Values | Sketches |
|---|---|---|
| Folder shape | `circle` (the packing's own circles, names on the arc) or `contour` (outline follows the contents, names above) | "one question at a time" or "exploration" |
| Routing | `gates` (the previous router: gates, corridors, bundling) or `downhill` (crosses contours at right angles, gathers in the flats) | same |

Positions, the four states, the lenses and the terrain are identical under both. **`contour` with `downhill` is the default** for a new project; `circle` with `gates` is the option, and the fallback until downhill routing has been timed above 63 notes. The mixed pairings are not sketched.

What the terrain needs from the layout:

1. Notes stay where they are. A note that moves takes its hill with it.
2. A margin of about 1.5 kernel widths between a folder's contents and its wall, so hills fall to nothing before the wall.
3. A least spacing between siblings (already a setting); the kernel width is derived from it, so no extra setting is needed.
4. No randomness: the terrain is a pure function of positions and lens values.

Bake the terrain, do not draw it per frame: compute contours per top-level folder in layout units, in the worker, and cache them by that folder's positions and lens values. Zooming and panning only transform the cached paths. When one note's value changes, only its folder is recomputed. A 64 to 128 cell grid per folder is enough; stamp notes onto the grid and blur, so cost follows grid size, not note count.

**Markers.** Shape is the kind of note, as on the previous map: circle definition, diamond theorem, triangle example, square trick, barred circle reference. Understanding is fill and ring: faint outline not reached, outline opened, filled worked through, filled with a double green ring understood; a solid red ring is needs work. A landmark is drawn larger. Colour never stands alone: each state also differs in fill or ring.

**Height is normalised.** A note alone gives its own level; a crowd of notes gives the crowd's mean level, however many notes it holds. Unreached notes count as zero, so a half-understood folder sits at half height. Contours are at 0.4 (the frontier), 0.9, 1.6 and 2.3.

### Two modes, set per project

- A project is a **Learning** project or a **Project** (a codebase or other body of work). The mode is chosen when the project is made and shown as a tag beside its name in the top bar.
- Learning: Today, Library, Atlas, Practice, with Project as the quiet link. Project mode: Today, Library, Atlas, Project, with Practice as the quiet link. Same chrome, pens and Atlas drawing in both.
- The Atlas keeps its terrain in both modes and changes what height means. Learning: understanding, with north as later in the study order. Project mode: the Activity lens (recent work is high ground, 90 days untouched is fog) or the Health lens (tested, reviewed, documented). Direction means nothing on a project map, so there is no north arrow.
- The learning layer sits on top of a project: Your understanding and Tour are lenses on the project Atlas, the teacher's pin still attaches to the row it is about, and Today has a Get up to speed block.
- On the Activity lens the top state is a plain ring, not green: green means right, and recent is not right. Green and red keep their meanings on the Health lens (settled, failing).

### Decisions on record

- **Exercise status** has four values: passed (double green underline), missed (solid red underline), in progress (a plain bordered tag) and not tried (faint text). In progress means a draft exists that has not been marked. The draft, the hints used and the feedback so far are kept in persistent state, so half-done work survives a restart and shows on Today under Continue where you left off.
- **Phone workbench:** while an exercise is open, the marking actions replace the tab bar; the back arrow returns to the list.
- **Project lenses:** Activity is read from git (when each file last changed). Health is three facts per file: a test exists, a person has reviewed it, a note documents it. A file with no facts stays flat and faint, not zero.
- **Themes:** the terminal lean and the retro-futurist theme are user settings. The key hints and the status line are accepted as designed.

### Code and maths

- Code blocks and inline code are Ioskeley Mono (the `code` style). Syntax highlighting uses two hues that no pen uses: `syntax-keyword` (violet, also bold) and `syntax-literal` (amber, strings and numbers). Comments are italic in `text-soft`, the name being defined is bold, everything else is `text`. Any highlighter works if its token classes are mapped onto these five roles. Never use the syntax tokens outside code, and never use red, green or blue for syntax.
- Maths letters and digits are Charter, so they match the reading text. Symbols, Greek and big operators stay in the KaTeX fonts.

Use the direction tokens (`survey-*`, `instrument-*`) only inside their own direction's screens. The pens are shared by all three.

### The Atlas

- Reached ground is clear and the rest is fog (a dot stipple over unreached land). Contour lines are steps of understanding; the outermost line is the frontier, hachured on the side facing the fog.
- Note state is neutral shape plus pen where it means something: understood is a double green ring, needs-work a solid red ring, opened a hollow dot, worked through a filled dot, not reached a small dot in the fog. The study path is a dotted blue line, numbered.
- North is later in the study order, so the arrow says something. Grid references (`F5`) are the cell of the 12 by 7 graticule the note sits in.
- The folders, notes and links on the Atlas are placeholders around the DMFT material. Only Variance scaling, The cavity method, Self-consistent autocorrelation, Gaussian fields, Central limit theorem and Clark and Abbott come from the real content.
