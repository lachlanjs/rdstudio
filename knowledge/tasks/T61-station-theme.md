---
type: Task
title: T61 — The Station theme
description: "Station as a second theme beside Marginalia: the theme picker back, the station
  tokens, and all of its terminal chrome (status line, key legend, numbered spaces, framed panes,
  scan lines)."
tags: [task, m13, active]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-05T23:44:09Z}
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

Not started.
