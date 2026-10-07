---
type: Task
title: T79 — Link controls in the editor
description: "With the cursor in a link, a button in the margin, joined to it by a dotted leader,
  says what the link is and changes it: its rating, and for an artifact or a picture whether it is
  shown in place and on which side; by click or keyboard."
tags: [task, m13, editor, links, artifacts, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T01:22:37Z}
---

# Prompt

Step 5 of [the artifacts scope](/design/artifacts.md), scoped in
[link controls](/design/link-controls.md). The developer: "easily change the
status of an existing link (see also, requires, etc) and for artifacts,
whether they are embedded or not. Some form of button in the margin which
connects to the link with an animated dotted line and can be either clicked
or keyboard driven."

# What was built

On `feat/artifacts` (`app/src/lib/editor/linkControl.ts`).

- **Which link:** the one the cursor is in or at the end of, else the one
  under the pointer. Links to the web have no control.
- **The button** says what the link is now: Requires, Uses, See also or
  Unrated for a note; Link (with its rating) or Shown here for an artifact;
  Link, or Shown with its side, for a picture. It sits in the right margin
  level with the link where there is a margin, else at the text's right edge
  a line below.
- **The leader:** a dotted line in the blue pen from the link's end to the
  button, its dots running while the button has the pointer or the focus or
  its menu is open; still under reduced motion.
- **The menu,** on a click: each choice with a line on what it means, the
  present one marked.
  - A note: Requires, Uses, See also, Unrated.
  - An artifact: Shown here or Link; and, as a link, its rating.
  - A picture: Shown here or Link; and, shown, Centre or Left.
- **Keyboard:** Alt+L opens the menu at what is set; arrows, Home, End or a
  first letter move; Enter chooses; Esc closes; the cursor returns to the
  text. Alt+1, 2, 3 and 0 set requires, uses, see also and unrated at once;
  Alt+E turns a link into an embed and back.
- **What it writes:** the link's title, or the `!` before it, as one undo
  step. Turning a rated link into an embed, or a sided picture into a link,
  drops the title, since a rating is not a side.
- In the live preview and in the source view.

# Checks

- Unit (5): what an address points at; the link under the cursor; a rating
  set, changed and removed with nothing else moved; link to embed and back;
  what is offered for each kind and what the button says.
- Browser (`e2e/artifacts.py`, now 26): the button and leader for a link to
  an artifact; the menu's choices; Shown here; Alt+E and Alt+1; Alt+L with
  arrows and Enter, and the focus back in the text; a picture's side.

# Not done

- No control on a phone (the scope's row above the keyboard).
- The pointer's link is only used when nothing is selected, and only one
  control shows at a time; there is no pass over all of a note's links.
- Alt+L and Alt+digit may be taken by the browser or the system on some
  machines; they are not yet settable.

# Found after

The walkthrough failed one run in three. Opening the menu straight after an
edit (Alt+1, then Alt+L) found the control still holding the link as last
measured; the measurement that followed saw a changed link and rebuilt the
menu, which lost the keyboard's place (and, as first built, the focus).
Now the menu holds the focus itself and keeps which choice is current, a
rebuild keeps that place, and opening reads the link as it is. Six runs in
a row pass.

`e2e/signin.py` also fails about one run in three, with or without this
work: it waits ten seconds for the app to notice a sign-in wall. Not looked
into.
