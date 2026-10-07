---
type: Task
title: "T89 — Search by meaning: the cache, the tool, and edits"
description: Embed each note's sections locally into a cache, give Axis and outside agents a
  find_similar tool, and embed again only what an edit changed.
tags: [task, m14, retrieval, assist, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T04:24:15Z}
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

# Done

2026-10-07. Described in
[Search by meaning](/design/search-by-meaning.md "see also").

Against the acceptance:

- A question in other words finds the section: a test with the real model
  ("what stops things overheating as the simulation runs?" finds the
  thermostat note), and the measure run again on the built code: an
  answering note in the first five for 64% by keyword, 76% by meaning, 80%
  by either (`mise run bench:retrieval`).
- Editing one section embeds one; moving a note embeds none: unit tests
  with a stand-in model that counts its calls.
- A walkthrough step in `e2e/ask.py`, skipped where the model is not
  installed.
- Nothing leaves the device: the only network use is fetching the model
  into a checkout.
- Code is searched and read without git: a walk of the files, leaving out
  hidden, installed and built folders.

Also done: the tool on the MCP server; a first pass shared among
processes; the model packed into the npm package (the bundled command line
was tried with the model beside it).

Not done:

- The Python wheel carries no model.
- `rdstudio mcp` alone does not start a pass until `find_similar` is first
  called.
- Tried once with a real model on a question keyword search missed in the
  measure ("How are directories shown on the visual overview?"). It found
  the answer by rewording its keyword searches and did not call
  `find_similar`. So the tool being second holds, and the measure's
  one-query figures understate what keyword search does in an agent's
  hands. Cost 4.7 US cents.
