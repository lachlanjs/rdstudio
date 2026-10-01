---
type: Task
title: "T30 — Editing in the app"
description: "Create, edit, move and delete notes from the dashboard, through the same write path as the MCP tools, ergonomic on desktop and phone."
tags: [task, m9, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T09:20:35Z }
---

# Prompt

The user should be able to create, delete and edit notes within the
application, and it should work and be ergonomic on every platform: a desktop
browser, a phone over a tunnel, and later the desktop and mobile apps (T40,
T42). See [editing from the dashboard](/ideas/learning/dashboard-editing.md)
for the original proposal. Moved from M8 into M9 on 2026-10-01, ahead of T39:
it is the first thing that makes the map malleable, and the platform tasks
after it (sync, mobile) build on its write path.

# Scope

- **Create** a note in a folder, or a new folder (a new bubble on the map),
  from the tree, a folder page or the map; the type, title and description in
  a short form, the body after.
- **Edit** a note's body and frontmatter: a Markdown editor with a live
  preview (maths, Mermaid and links rendered as the dashboard renders them),
  link completion from note titles, and a form for the frontmatter fields the
  bundle uses (type, title, description, tags, status), with raw YAML for the
  rest.
- **Move and rename** a note or a folder, rewriting the links that point to it,
  so reshaping the map does not break it.
- **Delete** a note or an empty folder, after showing what links to it; the
  links become broken links that lint reports, not silent removals. Git is the
  undo; the confirmation says so.
- **Ergonomic everywhere:** on a phone the editor is full screen with the
  preview a tab away, and a toolbar for what is awkward to type on a phone
  keyboard (links, headings, maths); on a desktop, side by side, with
  keyboard shortcuts. Touch targets and the on-screen keyboard are tested on
  the phone profile, not only at desktop widths.

# Design

- **One write path.** Server endpoints call the store (`record`, and new
  `move` and `remove`), as the MCP tools do, so attribution, significance and
  indexes are handled once. Edits are attributed to the human (`human:` from
  `rdstudio.toml`); editing is not verifying, which stays a separate act.
- **Conflicts.** Each edit carries the content hash it started from and is
  refused if the file changed since (an agent or another device wrote it); the
  editor then shows both versions to merge by hand. Three-way merging is A6,
  with sync (T41).
- **Security.** The same protection as the learner record's writes: the Origin
  must match the Host, and requests carry the per-run token. Exposing an
  editable server beyond localhost (a tunnel, a tailnet) is a conscious
  choice.
- **Static exports stay read-only,** and the editing controls are hidden there.
- **Editor:** CodeMirror 6 from npm (Markdown mode, about 150 KB compressed,
  loaded only when editing), not a plain text area: it handles phone
  keyboards and selection well and gives completion and a toolbar cheaply.
- **Typed end to end:** the endpoints are described in the OpenAPI schema and
  the app uses the client generated from it.

# Litmus test

Add a "Philosophy" folder on the map with a note on the project's
foundations and motivation, written and then edited from the dashboard, on the
desktop and on the phone, and see it appear on the map without leaving the app.
