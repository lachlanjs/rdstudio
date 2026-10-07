---
type: Task
title: T77 — Artifacts on the Atlas
description: An artifact is an item of its folder on the Atlas, drawn apart from notes, placed after
  the notes that cite it and joined to them, with a card that opens it.
tags: [task, m13, artifacts, atlas, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T01:09:26Z}
---

# Prompt

Step 2 of [the artifacts scope](/design/artifacts.md): "They should appear
in the Atlas and be linkable from regular nodes."

# What was built

On `feat/artifacts`.

- **In the model** (`views/map.js` `buildModel`): each artifact is an item of
  its folder. A link runs from the artifact to each note that cites it, as
  if it required them, so it is laid out after them: it shows what they
  say. A citation rated "see also" does not shape the layout. Nothing leads
  out of an artifact, since its own links are not read.
- **Drawn** as a lighter plate with a broken edge, its title in italics and
  a square of line for its glyph; "Artifact" is in the key when there are
  any.
- **Its card** says it is an artifact, gives its description, how many notes
  cite it and whether it needs the network, and has Open and the first two
  citing notes. Clicking it twice, or Enter, opens its page.
- **Hiding what is not reached** leaves an artifact shown while a note that
  cites it is shown: it is not something to reach in itself.
- It is in the folderless view too, with its folder's colour.

# Checks

`e2e/artifacts.py` (now 19): on the Atlas the artifact is in its folder,
joined to exactly the two notes that cite it, with no link out; its card;
the key.

# Not done

- An artifact cited by no note sits loose in its folder. That is right, but
  nothing says it is uncited except its card.
- Whether an artifact embedded in only one note should be left off the
  Atlas is still open in the scope.
