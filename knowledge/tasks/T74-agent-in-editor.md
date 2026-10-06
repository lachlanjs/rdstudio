---
type: Task
title: "T74 — An agent in the editor: ask about a passage, or have text proposed"
description: While editing a note, ask the connected model about the selection, or for text at the
  cursor or in place of the selection; proposed text is a suggestion to accept or reject, drawn from
  the note, linked and found notes, and code; a saved note's stamp names the model.
tags: [task, m13, editor, agents, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-06T23:50:28Z}
---

# Prompt

From the developer, 2026-10-07: "I want to build the feature for co-editing
notes with the connected LLM." The idea is the second of
[two for project mode](/ideas/project-agent-features.md). Four choices were
put to the developer first; their answers are in
[the design](/design/assist.md).

# What was built

On the branch `feat/co-edit`, off `feat/atlas-flat`.

- **Server** (`packages/cli/src/assist.ts`): builds the request (the note
  with the place marked, linked notes, notes found by search, code by name
  from the index and from the repository's files), asks the model, and reads
  a fill's reply. `POST /api/notes/{id}/assist` streams it as server-sent
  events, guarded like any write (token and origin), and writes nothing.
- **A `write` job** for the model that proposes text (`[teacher.models]`);
  answers use `discuss`. Usage is logged as `note-ask` and `note-fill`,
  under the same weekly budget.
- **The stamp:** a save may carry `assist`, the models whose text was
  accepted; `saveNote` names them in `generated.by` and leaves the time
  alone on a small edit.
- **Editor** (`app/src/lib/editor/suggest.ts`): a suggestion as a CodeMirror
  field: the old text struck through, the new text as a widget with Accept
  and Reject, Ctrl+Enter and Esc, mapped through edits.
- **The bar and the reply** in `NoteEditor.svelte`, with Stop, the model,
  the cost and what was drawn on, each a link where there is a page for it.

# Checks

- Unit, server (6): the marks; names taken from a request; the request holds
  the note, linked notes (absolute, relative, rated), a found note, code
  from the index (Python) and from the files (Rust, which the index does not
  read); a fill's reply; streaming, cost by feature, nothing written; the
  stamp on a small and on a significant edit.
- Unit, editor (2): how a phrase and a block go into the text.
- Browser (`e2e/assist.py`, 14, on nanosim with a fake model): ask about a
  selection; rewrite and reject; write at the cursor with code found by
  name, accept with Ctrl+Enter, save, and the stamp; and the line shown with
  no account.
- All suites: CLI 112, core 205, app 48, Python 58; `e2e/edit.py` 26.

Not tried against a real model: every check uses a fake one.

# Not done

See "Not kept, not done" in [the design](/design/assist.md). Also: the first
of the two ideas, an agent's path through the base on the Atlas, is not
started.
