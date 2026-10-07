---
type: Task
title: "T89 — Search by meaning: the cache, the tool, and edits"
description: Embed each note's sections locally into a cache, give Axis and outside agents a
  find_similar tool, and embed again only what an edit changed.
tags: [task, m14, retrieval, assist, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:43:33Z}
---

# Prompt

Step 3 of the agreed scope for
[semantic retrieval](/ideas/semantic-retrieval.md "requires"), if
[the measure](/tasks/T88-retrieval-measure.md "requires") supports it.

# Plan

As the scope sets out:

- the model shipped in the package, run as
  [the trial](/tasks/T87-embedding-runtime-trial.md "requires") found best;
- a cache in `.rdstudio/`, each section keyed by a fingerprint of its text,
  with the model that made it recorded;
- `find_similar` for Axis ([T84](/tasks/T84-assist-lookup.md "requires"))
  and through the MCP server, to be used after keyword search and links;
  its steps marked as found by meaning;
- on save, only changed sections embedded again, in the background; edits
  made outside the app caught before a search;
- text search of code that does not need git.

# Acceptance

- A question in other words than the note's finds the section.
- Editing one section embeds one section; moving a note embeds none.
- Unit tests and a walkthrough step. Nothing leaves the device.
