import fs from 'node:fs';

const U = '/root/.claude/uploads/e879b4f0-04e0-5527-95bd-9d6b24bf3eaf/';
const rd = (f) => fs.readFileSync(U + f, 'utf8');

export const README = `A knowledge base for learning hard subjects: notes, a map of how they connect, exercises, and an AI teacher that marks and tutors. Dark first, light second. Calm enough to think in for hours, with one or two things nobody else does.

The wordmark is the word \`rdstudio\` in lowercase, set in Ioskeley Mono Bold (\`label-strong\`). No logo was supplied; do not draw one.

## Principles

- Reading comes first: the note and the answer are the brightest things on the screen (\`text\` on \`surface\`).
- Colour is meaning, never decoration. Three pens: red is critical, green is right, blue is discussion and links. Nothing else is coloured.
- Every mark from the teacher points at the words it is about.
- Structure is information: a rule, a number or a border says something, or it goes.
- Phone and desktop are the same product, not one squeezed into the other.

## Content fundamentals

- Plain sentence case, second person, no exclamation marks, no emoji. The teacher is "the teacher", the person is "you".
- Buttons name the action: "Mark it yourself", "Ask an agent to mark it", "Continue writing". Counts read in words: "Hint (2 of 3)", "2 of 3 answered", "3 of 4 days".
- State is a short phrase, not a badge: "not yet today", "done today", "nothing due today", "passed", "missed", "not tried".
- Labels are sentence case in \`label\`; never tracked capitals above a heading.
- Teacher feedback starts with the verdict and quotes the words it is about: "Right, and it is why the variances add."

## Using tokens

- **Surfaces:** \`surface\` is the page; \`surface-1\`, \`surface-2\`, \`surface-3\` are three steps up for panels, teacher cards and selected rows. Never pure black. Divide with \`rule\`; give controls a \`rule-strong\` border.
- **Text:** \`text\` for anything you read, \`text-soft\` for labels and nav, \`text-faint\` for metadata only. All three hold 4.5:1 on every surface in both themes.
- **Pens:** \`pen-red\`, \`pen-green\`, \`pen-blue\` at full strength for lines and text; \`pen-red-soft\`, \`pen-green-soft\`, \`pen-blue-soft\` as the highlight behind marked words. Put \`text\`, not the pen colour, on a soft fill. Only the pens carry hue.
- **Never meaning by colour alone.** Red is a solid line, green a double line, blue a dotted line. A hint is neutral: a thin overline in \`text-soft\` and a hollow leader dot.
- **Type:** \`body\` (Charter 18/1.65) for reading, about 70 characters a line in the Library; the workbench columns are narrower. \`label\`, \`caption\`, \`code\` and \`number-lg\` (Ioskeley Mono) for interface labels, numbers and code. \`map-label\` (Martian Mono, set the width axis with \`font-variation-settings: "wdth" …\`) for map labels only. \`pixel-number\` (Departure Mono) for big numbers only.
- **Spacing:** a 4px base (\`space-1\` to \`space-16\`); 16px phone gutters (\`space-4\`); 48px desktop page margin (\`space-12\`).
- **Shape:** \`radius-md\` (4px) for buttons and cards, \`radius-sm\` for highlights. No shadows, no blur, no gradients.

## Using components

- **The workbench** (problem, answer, teacher) is the reference layout: problem left, answer in the middle, the teacher's margin on the right. Other screens borrow its columns.
- **Pins, not bubbles.** A teacher card quotes the words it is about (underlined in its pen's line style) and a leader line of the same style joins it to those words in the answer. Cards sit level with their words and stack down when they collide. Order the cards by where their words sit, so leader lines never cross.
- **Streak counters** are numbers first (\`number-lg\`), labels second, and never shout. Done and not done are a filled and an empty square, not colour.
- **Primary buttons are inverted neutral** (\`text\` fill, \`surface\` text). There is no accent colour.
- **Easy to misuse:** the pens. A red that only decorates teaches people to ignore red.

## Accessibility

- WCAG AA for all text on every surface, in both themes. Pen text is for \`surface\` to \`surface-2\`; on \`surface-3\` use \`text\`.
- A visible focus ring (\`focus-ring\`, blue): 2px, offset 2px, 3:1 or more on every surface.
- Red pins are solid underlines, green pins double, blue dotted.
- Touch targets of 44px or more on phones. Little motion, only in answer to an action; respect \`prefers-reduced-motion\`.

## Fonts

- Charter (Bitstream), Ioskeley Mono, Martian Mono (variable: weight 100 to 800, width 75 to 112.5) and Departure Mono ship in \`fonts/\`. Licences are in \`assets/Licences/\`; keep them with the fonts.
- The Charter files here have the descender metric corrected: the supplied files carried it with the wrong sign (+236 instead of -236), which makes browsers draw underlines and borders through the middle of the letters. Nothing else in them changed.
- Maths is KaTeX. Its own fonts (\`KaTeX_*\`, SIL OFL) are bundled in \`fonts/\` because maths needs glyphs the four brand fonts do not have.
- None of the four fonts has the command key glyph or a check mark; draw the command key as an SVG icon and use line styles for state.

## Sketches

The components are sketches of the redesign, not production components, grouped by direction. Desktop screens are 1440 by 900 and phone screens 390 by 844, dark unless it says light, set in the real content.

- **A · Marginalia** is the base. Colour is meaning: the three pens, each with its own line style. Ioskeley Mono for labels and numbers, Charter for reading.
- **B · Survey** keeps the pens and puts the knowledge base on a survey sheet: a teal-slate ground (\`survey-surface\` to \`survey-surface-3\`), Martian Mono labels with the width axis narrowed, a measured rule, grid references beside the streak counters (\`A2\`, \`C2\`, \`E2\`, \`F2\` are the counters' squares on the sheet's graticule), and the Atlas drawn as terrain.
- **C · Instrument** is a rack of panels with Departure Mono readouts and lamps on a cool ground (\`instrument-surface\`, \`instrument-panel\`). The reading surface (\`instrument-paper\`, \`instrument-ink\`) is warm graphite and the only warm thing on the screen.
- **A + B** is Marginalia with the Survey Atlas, the recommended combination: Survey's contours, hachures, grid references and north arrow used only on the Atlas.
- **A, terminal lean** is a user setting on top of A, not a fourth direction; its key hints and status line are accepted as designed: square corners, numbered spaces with the current one in reverse video, the palette as a prompt, framed panes with the title set into the border, key hints in brackets on every action, a block caret and a status line. It adds no tokens. The pens, Charter for reading and the leader lines are unchanged.
- **Retro-futurist** is a theme option, not a direction: the terminal lean pushed to an pale phosphor display (\`retro-*\` tokens), with Departure Mono for names, headings and numbers, reversed title blocks, 2px frames and scan lines. Prose and maths stay in Charter. The pens keep their colours and line styles, so the phosphor tone is never a meaning. It has no glow, because blur and large shadows are ruled out. It breaks one rule of the base on purpose: uppercase labels. It is a user setting, like the terminal lean.
- **Station terminal** is a second theme option, made for fun: a late-1970s film computer (\`station-*\` tokens). Cold white phosphor on blue-black, Departure Mono for labels and headings and Ioskeley Mono for the rest, upper case for short labels only, reversed header bars, thin cyan frames (\`station-line\`), segmented counters, a key legend with dotted leaders, scan lines, and the Atlas as a deck plan on a grid. Prose is mono in mixed case. The pens are unchanged. A chooseable user setting, alongside the terminal lean and the retro theme.
- **Phone** is A with the Survey Atlas at 390 wide: a bottom tab bar (Today, Library, Practice, Atlas, More), 16px gutters, 44px targets. There is no margin on a phone, so a pin hangs under the row or paragraph it is about by a short stem in its pen's line and quotes the words it pins.

### The Atlas: structure first, terrain on top

The two sketches under "Atlas · structure and routes" are drawn by the previous app's own \`layout.js\` and \`makeRouter\`, so they show what the engine does today plus what the redesign asks of it.

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

**Both strategies stay, as options.** Neither replaces the other. They are two settings, per project, alongside the existing \`[map]\` settings:

| Setting | Values | Sketches |
|---|---|---|
| Folder shape | \`circle\` (the packing's own circles, names on the arc) or \`contour\` (outline follows the contents, names above) | "one question at a time" or "exploration" |
| Routing | \`gates\` (the previous router: gates, corridors, bundling) or \`downhill\` (crosses contours at right angles, gathers in the flats) | same |

Positions, the four states, the lenses and the terrain are identical under both. **\`contour\` with \`downhill\` is the default** for a new project; \`circle\` with \`gates\` is the option, and the fallback until downhill routing has been timed above 63 notes. The mixed pairings are not sketched.

**A calmer default (proposal).** The two sketches under "Atlas · calmer" remove ink without removing information:

- Reached ground is a lighter tone. There is no stipple for fog and no hachures; the frontier is a thin line.
- Folder outlines are solid and thin. Subfolders are dashed.
- Unreached notes are not drawn at overview. Each folder's label says how many are reached (14/18). They appear when the folder is zoomed.
- The key is closed by default and opens from one button. The lens buttons stay.
- Pointing at a folder keeps its trunks, quiets the others, and shows one card: progress, what needs work, what it builds on and what builds on it.

**The grid Atlas (prototype).** A third folder shape, \`grid\`, beside \`circle\` and \`contour\`. Everything sits on a coarse square grid.

- *Layout.* Positions come from the smooth layout (the packing and forces of the previous app, later study further north) and are then snapped to cells. Inside each folder the children keep their relative places; the folder is scaled down as far as it will go, and anything left overlapping is nudged apart until every pair of notes has 2 clear cells between them and every pair of folders has 3. A note is a block of 8 by 2 cells, larger when it has many links so they have more edge to leave from. A folder has a title row, a free row under it and 2 cells of margin inside its wall; folders nest.
- *Kind of note.* The glyph in each block is the kind of note (circle definition, diamond theorem, triangle example, square trick, barred circle reference). It is an option: a per-project setting, on in these sketches.
- *Which links.* Every requires and uses link counts, implied ones included; nothing is hidden. Overview merges them into one trunk per pair of folders. A folder in focus shows each of its own links singly and keeps the other trunks quiet. \`GridAtlasAll\` draws all of them singly as a stress test, not as a proposed default.
- *Height is nesting.* 0 between folders, 1 inside a folder, 2 inside a subfolder. The only contours are folder walls, on grid lines with the corners cut. Each level is one tone lighter.
- *Understanding is tone and fill, not height.* Ground within one cell of a reached note is lighter, with a dotted edge. A note block is faint (not reached), outlined (opened), filled (worked through) or filled with a double green rule (understood); a red frame is needs work.
- *Titles sit in their own cells.* A folder's title row and a note's block are reserved, so labels never collide and nothing is routed through them.
- *Routes are A\* over cells* with 45 degree steps. A step costs its length, plus 5 for each change of height, a little for each turn, 2.5 for each cell of a folder the route has no business in, and 0.45 for each route already in the cell. Each route is re-routed twice after the others are down. A route ends on the edge of the block it joins.
- *Lanes.* Routes that share a cell edge take different offsets and run side by side. A later route is drawn over an earlier one with a gap, so a crossing reads as over and under.

**Layout and routes searched together (experiment, \`tools/gridopt.mjs\`).** \`GridExperiment\` compares six layouts of the same 63 notes with all 98 links drawn singly and measured. "Beside" is the share of route cells that have another route in the same cell or one touching it.

| Layout | Crossings | Cells of route | Beside another route | Cell size at overview | North kept |
|---|---|---|---|---|---|
| As published (rectangles, from the smooth layout) | 211 | 2360 | 75% | 6.7px | 91% |
| Spread only (twice the gaps, no search) | 230 | 3164 | 68% | 5.4px | 91% |
| Searched, tight (2 clear cells between notes) | 71 | 1570 | 54% | 8.6px | 78% |
| Searched, loose (4 clear cells) | 105 | 2405 | 54% | 6.0px | 87% |
| Loose, routes kept apart | 86 | 2175 | 27% | 5.8px | 81% |
| Loose, routes apart, north kept | 89 | 2509 | 23% | 5.6px | 92% |

- *Free-form folders.* A folder is every cell within reach of one of its notes (reach grows with the gap between notes, and by 2 for each level of folders inside it), with narrow notches filled. Its wall is the outline of that set; its title takes the top row above its topmost note.
- *Hard rules.* Sibling notes keep the chosen number of clear cells (2 tight, 4 loose). Notes of different folders keep enough distance that the regions cannot touch and 2 cells stay free between them. Each folder's notes stay close enough to form one region.
- *Search.* Simulated annealing over note positions (move a note, swap two siblings, move or mirror a folder), 200,000 moves judged on a stand-in for the routes: straight-line length and crossings, lines passing over other notes, how far each folder sprawls, and how small the cells get when the map is fitted to the screen. Then 160 to 220 moves judged on the real routes; a move is kept only if the measured score improves.
- *Routes kept apart.* Two parts. The router charges 0.3 per route already in a touching cell (\`near\`), on top of 0.45 per route in the same cell, so a route prefers an empty corridor to running alongside another. The search is charged for straight lines that pass through the same 8 by 8 block of cells, and the real-route pass for the measured crowding.
- *North is optional.* It is a weight in the search: 0.3 for each pair of notes whose vertical order disagrees with the study order. Off in the first four rows, on in the last. "North kept" is the share of pairs that agree.
- Spreading alone does not help: routes get longer and cross as often. Position matters more than room. Room does help once the router is told to use it: the share of route beside another falls from 54% to about 25%.
- Keeping north cost almost nothing here: 3 more crossings and 15% more route for 92% agreement against 81%.

Not yet in the prototype: stability (the layout is recomputed from scratch, so adding a note can move others); dragging a block to a new place and pinning it there; over and under at crossings between routes in different cells; a hex grid.

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

- Code blocks and inline code are Ioskeley Mono (the \`code\` style). Syntax highlighting uses two hues that no pen uses: \`syntax-keyword\` (violet, also bold) and \`syntax-literal\` (amber, strings and numbers). Comments are italic in \`text-soft\`, the name being defined is bold, everything else is \`text\`. Any highlighter works if its token classes are mapped onto these five roles. Never use the syntax tokens outside code, and never use red, green or blue for syntax.
- Maths letters and digits are Charter, so they match the reading text. Symbols, Greek and big operators stay in the KaTeX fonts. The Maths fonts sheet sets seven other serif maths fonts beside Charter (STIX Two, Termes, Pagella, Schola, Bonum, New Computer Modern, Latin Modern); each of those needs MathJax 4 in place of KaTeX.

Use the direction tokens (\`survey-*\`, \`instrument-*\`) only inside their own direction's screens. The pens are shared by all three.

### The Atlas

- Reached ground is clear and the rest is fog (a dot stipple over unreached land). Contour lines are steps of understanding; the outermost line is the frontier, hachured on the side facing the fog.
- Note state is neutral shape plus pen where it means something: understood is a double green ring, needs-work a solid red ring, opened a hollow dot, worked through a filled dot, not reached a small dot in the fog. The study path is a dotted blue line, numbered.
- North is later in the study order, so the arrow says something. Grid references (\`F5\`) are the cell of the 12 by 7 graticule the note sits in.
- The folders, notes and links on the Atlas are placeholders around the DMFT material. Only Variance scaling, The cavity method, Self-consistent autocorrelation, Gaussian fields, Central limit theorem and Clark and Abbott come from the real content.
`;

export const COMP_READMES = {
  MarginaliaToday: `Today answers "what should I do now?". Streak strip first, then what the teacher set, then where you left off; the right margin holds reviews, what changed and the teacher's next step.

The teacher's next step is a pin: it sits level with the row it is about (the missed exercise) and a red leader joins them. Do not move it to the top for emphasis.

The consumer provides the streak counts, the set exercises with their results, the reviews due and the changed notes.`,
  MarginaliaWorkbench: `The exercise workbench, dark: problem on the left, a live-preview editor in the middle, the teacher's pins on the right.

Marked words use the pen's line style; each pin quotes the same words and is joined by a leader line of the same style. Hints are neutral (overline, hollow dot). The line being written shows source; every other line shows typeset maths.

The consumer provides the problem, the draft, and each reply with the words it pins.`,
  MarginaliaWorkbenchLight: `The same workbench in light. Pens darken (\`pen-red\`, \`pen-green\`, \`pen-blue\` change value, not meaning) and the double-line leader is cut with \`surface\`, so keep the answer and margin on one ground.`,
};

COMP_READMES.SurveyToday = `Today on a survey sheet. Grid references sit beside the streak counters (their cell on the graticule whose ticks run along the page edges); rules are measured, with ticks. The pen meanings and the pinned next step are unchanged from Marginalia.`;
COMP_READMES.SurveyWorkbench = `The workbench on a survey sheet: the same problem, answer and pins as Marginalia, labels in Martian Mono (width axis narrowed), a measured rule above the answer. Direction tokens: \`survey-*\`. The pens do not change.`;
COMP_READMES.SurveyAtlas = `The Atlas as terrain, on the survey sheet: graticule with edge grid references, contours of understanding, frontier hachures, fog, a numbered study path and a north arrow (north is later in the study order). The lens switcher holds Links, Understanding, Study path, Tour and Goal; Understanding and Study path are on.

Folders, notes and links are placeholders; the Atlas must stay smooth with 1,000 notes, so draw contours from a coarse height field and label only landmarks and the path.`;
COMP_READMES.MarginaliaAtlas = `The recommended combination: Marginalia chrome (Ioskeley Mono interface, pens as meaning) around Survey's terrain, with no graticule. Martian Mono appears only in map labels. Same lenses, legend and north arrow as the Survey Atlas; folders, notes and links are placeholders.`;
COMP_READMES.InstrumentToday = `Today as a rack of panels: Departure Mono numerals for the streaks, lamps for done and not done, a four-segment week readout. The draft you left half written sits on the warm reading surface (\`instrument-paper\`); the teacher's next step is still a pin level with the row it is about. Direction tokens: \`instrument-*\`.`;
COMP_READMES.InstrumentWorkbench = `The workbench as three tight panels. Problem and answer sit on the warm reading surface, the teacher is a cool panel of readouts, and the hint budget is a three-segment readout on the Hint button. Leader lines cross the gap exactly as in Marginalia; the double green line is cut in \`instrument-paper\`.`;

export const LICENCE_README = `Licences for the fonts in \`fonts/\`. Keep these files with the fonts.

- \`Bitstream-Charter.txt\`: Bitstream Charter. The notice must stay intact on all copies. The Charter files here have the descender metric corrected (a modified copy, noted in the README).
- \`Ioskeley-Mono-OFL.txt\`, \`Martian-Mono-OFL.txt\`, \`Departure-Mono-OFL.txt\`: SIL Open Font License 1.1.
- \`KaTeX_*\` fonts (maths): SIL Open Font License 1.1, Copyright (c) 2009-2010 Design Science, Inc. and 2014-2018 Khan Academy, Reserved Font Name KaTeX_Main. KaTeX itself is MIT. Unmodified.
`;

export const licences = () => ({
  'Bitstream-Charter.txt': rd('a9cbd899-charter-bitstream.txt'),
  'Ioskeley-Mono-OFL.txt': rd('9f7555d4-ioskeley-mono-OFL.txt'),
  'Martian-Mono-OFL.txt': rd('91df04d9-martian-mono-OFL.txt'),
  'Departure-Mono-OFL.txt': rd('7eee6fdd-departure-mono-OFL.txt'),
  'README.md': LICENCE_README,
});

export const COVER = `<!-- @dsCard height=288 -->
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=960">
<style>
html,body{margin:0;background:var(--surface)}
.cv{position:relative;width:960px;height:288px;overflow:hidden;background:var(--surface)}
svg{position:absolute;left:0;top:0}
.red{fill:var(--pen-red)}.green{fill:var(--pen-green)}.blue{fill:var(--pen-blue)}.tint{fill:var(--surface-3)}
.cut{stroke:var(--surface);fill:none}
.name{position:absolute;left:48px;bottom:56px;margin:0;font-family:var(--font-reading);font-weight:700;font-size:96px;line-height:.95;color:var(--text);white-space:nowrap}
.tag{position:absolute;left:48px;bottom:28px;margin:0;font-family:var(--font-ui);font-size:13px;line-height:16px;color:var(--text-soft);width:440px;white-space:nowrap}
</style></head><body>
<div class="cv">
<!-- derivation
 blocks: pen-red 200x168 at (480,0); pen-green 152x240 at (680,48) bleeding off the bottom; pen-blue 128x120 at (832,0) bleeding off top and right; surface-3 200x120 at (480,168) as the relief tint.
 arrangement: a staggered stack of unequal slabs, as the margin and the page stack on the workbench.
 pattern: editorial, "structure is information" -> three hairline rules, one per pen, cut out of the blocks in the ground colour and drawn in that pen's line style (solid, double, dotted). The sentence: the line styles ARE the pens' meaning, so they are the pattern.
 steps and radii: sides are multiples of space-4 (8, 16, 24); corners square (radius 0); cuts are 2px.
-->
<svg width="960" height="288" viewBox="0 0 960 288" aria-hidden="true">
  <rect class="red" x="480" y="0" width="200" height="168"/>
  <rect class="tint" x="480" y="168" width="200" height="120"/>
  <rect class="green" x="680" y="48" width="152" height="240"/>
  <rect class="blue" x="832" y="0" width="128" height="120"/>
  <path class="cut" stroke-width="2" d="M480 96H680"/>
  <path class="cut" stroke-width="2" d="M680 120H832M680 126H832"/>
  <path class="cut" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="0.1 6" d="M832 72H960"/>
</svg>
<h1 class="name">rdstudio</h1>
<p class="tag">Notes, exercises, a teacher’s pen in the margin.</p>
</div>
</body></html>
`;

COMP_READMES.TerminalToday = `Today with the terminal lean. Every block is a framed pane with its title set into the top border; the spaces are numbered and the current one is in reverse video; the status line names the space, the project and what is waiting. The teacher's next step is still a pin level with the row it is about.

The key hints and the status line's contents are proposals, not existing shortcuts. Use reverse video only for the current space and the primary action.`;
COMP_READMES.TerminalWorkbench = `The workbench with the terminal lean: three titled panes, key hints in brackets on Hint, Feedback, Discuss and the two marking actions, a block caret, and a status line carrying the exercise, the draft state and the hint budget. Marked words, pins and leader lines are exactly Marginalia's.

Reading text stays in Charter. Setting the prose in Ioskeley Mono as well is a further step this sketch does not take.`;
COMP_READMES.PhoneToday = `Today on a phone, shown at three scroll positions of one stack. Streaks are a two by two grid; exercise rows are whole-row targets of at least 44px; the teacher's next step hangs directly under the missed exercise by a red stem, so it stays attached to the row it is about. Reviews, changes and goals follow.

The tab bar icons are plain line drawings made for this sketch, not an icon set.`;
COMP_READMES.PhoneWorkbench = `The workbench on a phone, at three scroll positions. The problem comes first, then the answer; the teacher's cards sit inline under the paragraph they pin, in the order of the words they quote, each with a stem and a quote in its pen's line style. The marking actions replace the tab bar while an exercise is open; the back arrow returns to Diagnostic 1.

With no leader lines, the quote is what ties a card to its words, so never drop it on a phone.`;
COMP_READMES.PhoneAtlas = `The Atlas on a phone: the same terrain, panned and pinched. The lenses collapse to one bar naming the active ones; Change opens a sheet with the lens buttons and the legend. Labels fall below or to the left of a marker where the screen edge would cut them. Folders, notes and links are placeholders.`;

COMP_READMES.MarginaliaNote = `A Library note with its companion panel: the folder tree on the left, the note in a 660px measure, the companion on the right (your understanding in three steps, explain it back, trust, prerequisites in reading order, ask the teacher).

Code blocks are Ioskeley Mono on \`surface-1\` with a language label, highlighted with \`syntax-keyword\` and \`syntax-literal\`. The note text here was written for the sketch around the real exercise.`;
COMP_READMES.ProjectAtlasActivity = `Project mode, the Atlas with the Activity lens, now drawn by the same engine as the learning Atlas (contour outlines, downhill routes, links on by default). Modules are regions, files are places, dependencies are routes. Height is recent work: changed this week, this month, this quarter; fog is 90 days untouched. The dotted blue line is the change in review, numbered in dependency order; the red ring is the file whose checks fail.

No north arrow: direction means nothing on a project map. The files, activity and review are placeholders for ramplib.`;
COMP_READMES.ProjectAtlasHealth = `The same map with the Health lens. Height is how settled a file is: one step each for tested, reviewed and documented. A double green ring is all three; fog is none. Compare it with the Activity lens: the busiest ground (plasticity) is the least settled. Placeholder data.`;
COMP_READMES.ProjectToday = `Today in project mode: counters for the week in place of streaks, then what needs you (changes in review, failing checks), then where you left off. The margin holds what changed, agents, and Get up to speed, the learning layer on a project. The teacher's pin attaches to the failing change. Placeholder content.`;
COMP_READMES.ProjectSpace = `The Project space, which is a main space in project mode: Changes from git grouped by day, with the review queue, agents and reports in the margin. Review queue, Reports, Procedures, Skills and Agents are the other pages. Status uses the pen line styles only where it means critical or right; everything else is plain. Placeholder content.`;

COMP_READMES.CodeBlocks = `Code blocks in eight common languages: Python, C++, TypeScript, shell, Rust, JSON, YAML and SQL. Five roles only: keyword (\`syntax-keyword\`, bold), literal (\`syntax-literal\`), comment (italic, \`text-soft\`), the name being defined (bold) and everything else (\`text\`).

The sketch is highlighted with highlight.js at build time; the consumer may use any highlighter and map its classes onto the five roles. The snippets are placeholders.`;
COMP_READMES.CodeBlocksLight = `The same code blocks in light. Both syntax tokens darken; both stay 4.5:1 or more on every surface.`;

COMP_READMES.AtlasStructure = `The whole field at overview, positioned and routed by the previous app's own layout and router, with the terrain of understanding drawn on top. Top-level folders are open, subfolders closed; 98 links are drawn as 61 routes. North is later in the study order (one force added to the layout).

Labelled names come from the previous app's screenshots. The links, the understanding levels, the unlabelled notes and Foundations' subfolders are invented for the sketch.`;
COMP_READMES.AtlasStructureOpen = `Zoomed into Manifolds: its subfolders open, routes split to the notes they reach, and Vector fields selected. Other routes go quiet and the selected note's own links are drawn in the blue dotted pen, out through the gates of Tangent and Manifolds. The teacher's card is pinned to the note by a red leader.

Labels try the right then the left of their marker and are dropped when both collide; landmarks and the selected note always keep theirs.`;

COMP_READMES.AtlasResting = `State 1 of 4, the default: where have I got to? Links are off. Folders, walls, note markers and the terrain, reduced at overview to the frontier and one contour.`;
COMP_READMES.AtlasLinks = `State 2 of 4, Links on: what depends on what? Every requires-link between two top-level folders merges into one trunk with its count (9 trunks here), leaving by gates. Links inside a folder are not drawn at this scale. Terrain steps back to fog and a thin frontier line so the trunks carry the detail.`;
COMP_READMES.AtlasFolder = `State 3 of 4, a folder in focus: how does this part fit together? Zoomed into Manifolds with Links on: the links inside it are drawn at the shown scale, its trunks to other folders keep their counts, and trunks between other folders fade.`;
COMP_READMES.AtlasNote = `State 4 of 4, a note selected: what does this one need, and what needs it? Only Vector fields' own links are drawn, in the blue dotted pen: large dots for what it requires or uses, small dots for what builds on it. The Links lens is off, so the terrain is shown in full.`;

COMP_READMES.OrganicResting = `Exploration, state 1. Folder outlines are contours of where their contents sit, in place of circles. Positions are unchanged from the circle map; understanding contours nest inside the outlines. Folder names sit above the outline, since there is no arc to follow.`;
COMP_READMES.OrganicLinks = `Exploration, state 2. Trunks are solved to run straight down each folder's slope, so they cross its outline at a right angle, then travel on the flat ground between folders. The legend panel reports the measured deviation from a right angle.`;
COMP_READMES.OrganicFolder = `Exploration, state 3. Inside Manifolds the same solver gathers routes into a few shared lines that branch near their ends, like streams, in place of one curve per pair.`;
COMP_READMES.OrganicNote = `Exploration, state 4. The selected note's links leave it downhill across the understanding contours and the folder outlines.`;

COMP_READMES.RetroToday = `Today in the retro-futurist option: an pale phosphor display with pixel headings, reversed title blocks, 2px panel frames, scan lines and a status line. Layout and content are the terminal lean's. The pens are unchanged, so passed, missed and links read exactly as in Marginalia.`;
COMP_READMES.RetroWorkbench = `The workbench in the retro-futurist option. The problem, the answer and the maths stay in Charter for reading; labels, buttons and card heads are pixel or mono type in the phosphor tone. Pins and leader lines are Marginalia's.`;
COMP_READMES.RetroAtlas = `The Atlas as a vector display: contour folders and downhill routes, drawn in pale phosphor lines on a grid of registration marks, with a note selected. The only change from the exploration sketch is the theme.`;

COMP_READMES.StationToday = `Today in the station terminal option: pixel and mono type on blue-black, upper case for labels only, reversed title bars, thin cyan frames, segmented counters and a key legend with dotted leaders. Layout and content are the terminal lean's; the pens are unchanged.`;
COMP_READMES.StationWorkbench = `The workbench in the station terminal option. Prose is mono in mixed case; maths keeps its own letters. Pins, marked words and leader lines are Marginalia's.`;
COMP_READMES.StationAtlas = `The Atlas in the station terminal option, on the calmer default: contour folders drawn as a deck plan on a grid, trunks with counts, cyan drawing lines. Only the theme differs.`;

COMP_READMES.MathFonts = `Eight serif maths fonts set beside Charter reading text, with the same sentence and two display equations in each. The first card is the current setup (KaTeX, with Charter for letters and digits). The other seven are MathJax 4 fonts, rendered to SVG at build time, so the sheet itself needs no extra font files.

KaTeX has one maths font. Choosing any of the others means moving the app from KaTeX to MathJax 4.`;
COMP_READMES.AtlasCalm = `A proposal for a calmer default Atlas. Reached ground is a lighter tone, with no stipple and no hachures; outlines are solid and thin; unreached notes are not drawn at overview and each folder's label carries its progress; the key opens on demand. Links, trunks, counts and contours are unchanged.`;
COMP_READMES.AtlasCalmHover = `The calmer Atlas with the pointer on a folder: its trunks stay, other trunks go quiet, and one card gives its progress, what needs work, what it builds on and what builds on it.`;

COMP_READMES.GridAtlas = `Prototype of the Atlas on a square grid, at overview. Folders are nested blocks placed as in the smooth layout, with 3 clear cells between folders and 2 between notes. Height is nesting; ground near a reached note is lighter with a dotted edge. The glyph in each block is the kind of note. Every link counts, merged into one trunk per pair of folders with its count. Content is placeholder.`;
COMP_READMES.GridAtlasAll = `Stress test of the grid Atlas: every link drawn on its own from note to note, nothing merged or hidden. It shows what the router does under load, and is not proposed as a default view.`;
COMP_READMES.GridAtlasFolder = `The grid Atlas zoomed into Manifolds. Every link that touches the folder is drawn singly: links inside it, and each note's links out to the edge of another folder. Note titles sit inside their blocks with the kind of note at the right; long titles are cut short. Blocks with no title are placeholder notes.`;
COMP_READMES.StationGridAtlas = `The grid Atlas at overview in the station terminal theme. Only the theme differs.`;
COMP_READMES.StationGridAtlasFolder = `The zoomed grid Atlas in the station terminal theme, with pixel type in the title rows and note blocks.`;

COMP_READMES.GridExperiment = `Six layouts of the same notes and links side by side, every link drawn singly, with measured crossings, route length, share of route beside another route, cell size and how much of the north-is-later order survives. The evidence for searching positions and routes together.`;
COMP_READMES.GridFreeAtlas = `The tight searched layout at overview. Folders are free-form regions of cells around their notes; one trunk per pair of folders. North is not enforced, so the north arrow is hidden.`;
COMP_READMES.GridFreeAtlasAll = `The tight searched layout with all 98 links drawn singly. Compare with GridAtlasAll, which has about three times the crossings.`;
COMP_READMES.GridFreeAtlasFolder = `The tight searched layout zoomed into Manifolds with every link that touches it.`;
COMP_READMES.GridLooseAtlas = `The loose searched layout at overview: 4 clear cells between notes, routes charged for running side by side, later study pulled north. One trunk per pair of folders.`;
COMP_READMES.GridLooseAtlasAll = `The loose searched layout with all 98 links drawn singly. About a quarter of the route runs beside another route, against three quarters in GridAtlasAll.`;
COMP_READMES.GridLooseAtlasFolder = `The loose searched layout zoomed into Manifolds with every link that touches it.`;
