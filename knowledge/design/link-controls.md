---
type: Design
status: draft
title: Link controls in the editor
description: "Scope for changing what a link is without editing its Markdown: a control in the
  margin, joined to the link by a dotted leader, that sets its rating (requires, uses, see also)
  and, for an artifact, whether it is a link or an embed; by click or by keyboard."
tags: [design, editor, links, scope]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T00:50:54Z}
---

# What the developer asked for

On 2026-10-07: "I would like links to be treated more ergonomically in the
editor. It would be nice to be able to easily change the status of an
existing link (see also, requires, etc) and for artifacts, whether they are
embedded or not. Some form of button in the margin which connects to the
link with an animated dotted line and can be either clicked or keyboard
driven would be ideal at a first approximation."

A scope, not yet built.

# What is being changed

Both are already plain Markdown; the control only edits it.

- **A link's rating** is its title: `[text](/a/b.md "requires")`, `"uses"`,
  `"see also"`, or none ([conventions](/design/conventions.md),
  [T21](/tasks/T21-link-ratings.md)). The rating decides how the link shapes
  the Atlas.
- **Link or embed**, for an [artifact](/design/artifacts.md): the `!` before
  it. `[caption](figure.html)` is a link, `![caption](figure.html)` an embed.

# First approximation

- **Where:** in the right margin of the editor, level with the link's line:
  a small button showing the link's present state (Requires, Uses, See also,
  Unrated; Link or Embed for an artifact).
- **Which link:** the one the cursor is in, and the one the pointer is over.
  Not every link at once: a paragraph with six links would fill the margin.
  (Open: a setting to show all of a note's links, as a review pass.)
- **The leader:** a dotted line from the link's last character to the
  button, in the blue pen, its dots moving along it while the button has the
  focus or the pointer; still under `prefers-reduced-motion`.
- **Clicking** opens a short menu beside the button: the ratings, each with
  a line on what it means for the Atlas; for an artifact, Link or Embed; and
  Open, to go to the target.
- **Keyboard:** with the cursor in a link, one key (to settle: `Alt+L`)
  opens the menu; arrows or the first letter choose; Enter sets; Esc closes
  and returns to the text. `Alt+1`, `2`, `3`, `0` set requires, uses, see
  also and unrated at once, without the menu.
- **What it writes:** only the title, or the `!`. One undo step. Nothing
  else on the line moves.
- **Both views:** the live preview and the source view.

# Notes on building it

- Links are found from the editor's syntax tree (the Markdown parser's Link
  and Image nodes with their URL and title), so the control knows exactly
  what to replace.
- The button and leader are drawn in a layer over the editor, placed from
  the link's position on screen, and moved as the text scrolls or wraps.
- On a phone there is no margin: the control is a row above the keyboard
  when the cursor is in a link.

# Open

- Whether an unrated link to a note should prompt for a rating (a faint
  button even when the cursor is elsewhere).
- Whether the same control belongs on the note page when reading, for
  someone who can edit.
