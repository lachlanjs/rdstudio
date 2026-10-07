---
type: Task
title: "T78 — Make a figure from the editor: an artifact written, checked, shown, and saved only
  when accepted"
description: "A third action in the editor's bar: the model writes an artifact for the selection; it
  is loaded out of sight and checked for errors, weight, speed and idleness, sent back to be put
  right up to twice, previewed, and written beside the note with its embed only when accepted."
tags: [task, m13, artifacts, editor, agents, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T01:17:52Z}
---

# Prompt

Step 4 of [the artifacts scope](/design/artifacts.md). The developer's
scenario: "highlight the text the visualisation should be about and ask the
agent to produce an artifact for it and link it in the document below", and
their requirement: "the agent ensures that embedded artifacts do not error
and are lightweight enough that they do not slow down the experience too
much."

Also here: the scope's step 3 remainder, embeds and pictures shown in the
editor's live preview.

# What was built

On `feat/artifacts`.

- **Figure**, beside Ask and Write here ([the bar](/design/assist.md)), with
  a passage selected or a request typed.
- **The request** (`assist.ts`, mode `figure`): what a text request is given
  (the note with the place marked, linked and found notes, code by name),
  plus the rules an artifact must keep: one file, no network, only
  rdstudio's own libraries, no errors, light, no work until asked, the
  app's colours, sized by its content, labelled controls. The reply is a
  title, a one-line caption, the file, and why.
- **Checked before it is offered** (`app/src/lib/figure.ts`): the server
  holds the unsaved file and serves it as it would a saved one
  (`/p/<id>/…`, sandboxed, with the policy). The editor loads it in a frame
  that is in the window but not seen, and the bridge reports:
  - any error (uncaught, a rejected promise, `console.error`);
  - how long it took to be ready (limit 500 ms);
  - its size (limit 200 kB);
  - how many animation frames it asked for in a second while untouched
    (limit 3).
- **Put right:** a failed check goes back to the model with the file and
  what was wrong, up to twice. If it still fails it is not offered, and the
  problems are listed.
- **Shown:** one that passes is previewed in the reply, working, with
  "Put it in the note" and Discard. Nothing has been written.
- **Accepted:** the file is written beside the note under a name from its
  title (a number added if taken), with the model and the date put in its
  head; its embed goes on a line of its own below the passage; the note's
  stamp will name the model when the note is saved.
- **In the editor's preview**, a line that is one picture or one embed is
  shown as on the page (`editor/blocks.ts`).

# Found on the way

A frame placed off the screen is not animated by the browser, so an artifact
that animated without end looked idle there. The checking frame is in the
window, invisible.

# Checks

- Unit: the reply read; the head stamped; the file written, refused where
  one is, refused outside the base; a held preview served with the policy.
- Browser (`e2e/assist.py`, now 21, with a fake model): a first figure that
  raises an error is sent back with the error and comes back right; the
  preview works (its slider redraws); nothing is saved until accepted; then
  the file is there, stamped, and its embed is in the note and shown in the
  preview; and a figure that never stops animating is sent back twice, then
  not offered, with the reason.
- All suites: core 207, CLI 117, app 48, Python 58; artifacts 20, edit 26,
  code 23.

Not tried with a real model.

# Not done

- The limits are first guesses.
- An accepted figure cannot be changed by asking again; a new one is made.
- A discarded or failed figure's preview stays held by the server until it
  ages out (half an hour, twelve at most).
