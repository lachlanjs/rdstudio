---
type: Task
title: T61 — The Station theme
description: "Station as a second theme beside Marginalia: the theme picker back, the station
  tokens, and all of its terminal chrome (status line, key legend, numbered spaces, framed panes,
  scan lines)."
tags: [task, m13, active]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-06T04:16:41Z}
---

# Prompt

Integrate the new "Station" theme from the redesign branch, which is inspired
by Alien: Isolation's user interface style and will continue to be refined.
All of the chrome (status line, key legend, numbered spaces). Light mode if
it is an easy task.

Sketches `StationToday`, `StationWorkbench`, `StationAtlas`; rules in
`design/tools/station.mjs`, on the terminal lean in `design/tools/terminal.mjs`.
[Decision](/decisions/station-theme.md).

# Plan

Approved by the developer on 2026-10-05, with both assumptions below. To be
built after [T62](/tasks/T62-grid-atlas.md), which the DAG layout waits on.

1. **The theme setting.**
   - `app/src/lib/settings.svelte.ts`: `THEMES` gains `station`, with
     `setTheme` stored as `rdstudio.theme`.
   - `app/src/app.html`: the script before first paint sets `data-theme`
     beside `data-mode`.
   - `app/static/report.js` follows the same choice.
   - Settings gets the theme picker back, beside "Light or dark".
2. **Tokens.** `app/static/themes/station.css`, generated from
   `design/tools/tokens.mjs` like Marginalia's: under
   `[data-theme="station"]` the base tokens (`--surface` to `--text-faint`)
   take the `station-*` values, `--line` is added, and the radii are 0. Always
   loaded and scoped by the attribute, so switching needs no reload. The
   service worker's cache list gains the file.
3. **Chrome by restyling,** in a Station section of `app/src/app.css`, each
   sketch rule re-pointed from the sketch's class names to the app's:
   - Departure Mono for headings, labels, buttons and the spaces;
   - upper case for short labels only;
   - reversed title bars, thin cyan frames, dotted row rules;
   - segmented streak counters, zero-padded row numbers, the block caret;
   - scan lines as one fixed overlay that takes no pointer events.
4. **Chrome that is new markup.**
   - `StatusLine.svelte` in the layout: the mode block, what the page
     reports (for example reviews due, draft saved, hints used), and the key
     legend with dotted leaders. Pages set their line through a small store.
   - Numbered spaces in the top bar, the current one reversed.
   - The keys the legend names: 1 to 4 for the spaces, `c` continue on
     Today, `h`, `f` and `d` on the workbench, `?` for the list. Never while
     typing in a field or the editor.
5. **Screens without a sketch** (Library and notes, Practice lists, Project,
   Settings, phone): the same rules by extension, listed in the outcome for
   review. On a phone the status line gives way to the tab bar.
6. **The Atlas:** the current Atlas takes the deck-plan colours through its
   CSS classes. The grid Atlas's Station skin belongs to
   [T63](/tasks/T63-grid-atlas-parity.md).
7. **Light mode:** the tokens have light values. Kept if the contrast audit
   passes on every surface without new rules; otherwise Station is dark only
   and the outcome says why.

Assumptions:

- The keys work in both themes; only Station shows the legend.
- Scan lines are on with Station, with a switch in Settings to turn them off.

# Acceptance

- Choosing Station in Settings restyles every screen without a reload, and
  the choice survives one.
- Today, the workbench and the Atlas match their sketches at 1440 wide.
- Text contrast is 4.5:1 or more on every Station surface, in each mode that
  ships.
- Marginalia is unchanged: every existing walkthrough passes untouched.
- A walkthrough covers switching themes, the status line and the keys.

# Outcome

Built on 2026-10-06 on the branch `grid-dag-view`. Left `active`: it has
been looked at on five screens of one bundle, the workbench has not been
seen in it, and the walkthroughs have not been run.

- **Choosing it:** Settings has Theme (Marginalia, Station) again, and so
  does the You menu. The choice is kept as `rdstudio.theme` and applied
  before first paint, with no reload. Reports follow it.
- **Tokens:** `app/static/themes/station.css`, written by hand from the
  `station-*` values in `design/tools/tokens.mjs` (not generated). It loads
  after Marginalia and changes the surfaces, rules and text, adds `--line`
  (the cyan drawing line), squares the corners, and makes prose mono at
  15px. The pens are Marginalia's.
- **Chrome by restyling,** a Station section at the end of `app.css`: pixel
  type for headings, labels, buttons and the spaces; upper case for short
  labels; reversed title bars; cyan frames; dotted rules between rows; the
  spaces numbered with the current one reversed; the palette as a prompt;
  scan lines.
- **The status line** (`StatusLine.svelte`): the space in a reversed block,
  the project, what waits (set for you, to review), then the keys with
  dotted leaders. It gives way to the tab bar on a phone.
- **Keys,** in either theme, never while typing: 1 to 4 for the spaces, `c`
  continue on Today, `h` hint, `f` feedback and `d` discuss on the
  workbench, `?` for the list. A page offers a key by marking a button or
  link with `data-key`; the line finds them, so a new one needs no wiring.
  In Station such a button shows its key in brackets.
- **Scan lines** are on with Station; Settings turns them off.
- **The Atlas** in Station: cyan walls, pixel type in the blocks and
  titles, the grid's dots in cyan.
- **Light mode ships:** the light tokens worked with no extra rules.
  Contrast was judged by eye, not measured.
- **Different from the sketches:**
  - Streaks have a frame but no reversed "Streaks" bar: the app's markup has
    no label there.
  - Rows are not numbered 001, 002.
  - The status line says what the layout knows (the project, counts), not
    each page's own words ("draft saved", "hints 2 of 3").
- **Screens without a sketch** (a note in the Library, Settings, Practice):
  they follow the same rules and have not been adjusted one by one.
- **Checked:** the app's 38 tests and type check; by eye at 1440 by 900 on
  the abstract algebra bundle: Today, a note, the Atlas, Settings, in dark,
  and the Atlas in light; the key 3 going to the Atlas and `?` opening the
  list.
- **Not checked:** the workbench and an exercise in Station; a phone; the
  contrast audit; the walkthroughs.
