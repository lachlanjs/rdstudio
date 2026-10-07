---
type: Decision
title: "Artifacts replace reports: HTML in the knowledge folders, cited from notes, never citing back"
description: Reports are renamed artifacts and move into the knowledge folders; notes link to or
  embed them, and whatever an artifact links to is not read by the rest of the app. Revises the
  decision that reports are HTML outside the bundle.
tags: [artifacts, atlas, okf]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T00:50:54Z}
---

# Decision

Decided by the developer on 2026-10-07. This **revises**
[reports are HTML outside the bundle](/decisions/reports-html.md), and turns
its one-way rule round.

- Reports are called **artifacts**: pure HTML documents that do what a
  Markdown note cannot.
- They live **inside the knowledge folders**, beside the notes, "as long as
  this does not conflict heavily with the OKF spec".
- They **appear on the Atlas** and are **linkable from notes**.
- **An artifact does not link back.** In the developer's words: "technically
  they could href back, but this just won't be acknowledged in the rest of
  the app." Its links are not read for search, the graph, the lint or the
  Atlas.
- Everything that was a report becomes an artifact. None exist in this
  repository.
- They **work offline**. One that needs the network by necessity is tagged
  as such.
- They may be **embedded** in a note as well as linked.

What follows is scoped in [the design](/design/artifacts.md).

# Assumption

- A file that is not Markdown, sitting in the bundle, does not make the
  bundle non-conformant: the spec ([OKF](/references/okf-spec.md)) describes
  a bundle as a tree of Markdown files and says nothing against others, and
  other tools will ignore them. Checked against the local copy of the spec
  on 2026-10-07; the earlier decision assumed the opposite ("keeping them
  out of the bundle keeps the bundle conformant") without that check.
- A sandboxed, offline HTML page does enough beyond Markdown to be worth a
  second kind of document. Tested the same day: scripts, canvas, WebGL and
  input all work in the sandbox; in a note every script and handler is
  stripped ([what it can do](/design/artifacts.md)).

# Alternatives considered

- **A folder of their own outside the notes** (as `reports/` was): keeps the
  base pure Markdown, but an artifact then has no folder on the Atlas. The
  agent's first suggestion; the developer chose the folders.
- **Enforcing the one-way rule** (a lint error, links blocked): not wanted.
  Ignoring an artifact's links is simpler and cannot be got wrong.
- **Keeping reports as a separate kind:** two kinds of HTML document with
  opposite link rules.

# Reopen if

- A later OKF version says what a bundle may hold besides Markdown, or
  gives rich documents a convention of their own.
- Artifacts in the folders confuse another OKF tool in practice.
