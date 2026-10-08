---
type: Task
title: T114 — Folders an agent makes are said and shown, in proposals, the trace and the Atlas
description: When a proposal or an outside agent's write makes a new folder, the card, the trace's
  step and the map say so; and, to settle, whether agents may move and rename folders.
tags: [task, m18, assist, agents, mcp, atlas, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T23:44:54Z}
---

# Prompt

The developer, 2026-10-09, of new notes proposed by Axis: "can the agent
add folders and is this tracked through the MCP and in Atlas? Would like
this".

# How it is today

Found on 2026-10-09 by reading the code:

- **A folder exists when a note is in it.** Nothing anywhere makes a folder
  on its own. The app's New folder writes an `overview` note into it
  (`ActionDialog.svelte`).
- **Through Axis's proposals:** a note proposed at `new-folder/name` makes
  the folder when accepted. The card does not say a folder is new.
- **Through MCP:** an outside agent's `record` at `new-folder/name` makes
  the folder as a side effect. The trace's step says "Wrote a new note"
  and not that a folder was made (`Tracer` in `trace.ts`).
- **On the Atlas:** the new folder appears once the note is written, with
  no reload.
- **Moving and renaming:** the app can move and rename a folder
  (`moveFolder` in `reshape.ts`, `POST /api/folders/move`). No MCP tool
  and no proposal can.

# What is wanted, as the agent reads it

- A proposal's card says when its note's folder is new.
- The trace's step says when a write made a folder, and the session's
  summary counts folders made.
- The map shows a folder as proposed
  ([T113](/tasks/T113-ghosts-for-proposed-notes.md) draws it).

# To settle before a plan

- **Whether an agent may move or rename a folder.** Asked of the developer
  on 2026-10-09 and not answered. For Axis it would be a proposal like a
  note's move; for an outside agent, an MCP tool. A folder's move rewrites
  every link into it, so it is the largest change an agent could make in
  one step.
- **Whether a folder made by an agent should get an overview note,** as
  one made in the app does. Without one the folder has no description.
- Whether an outside agent's new folder should be marked on the map in a
  session's path, as a note written is.

# Plan

(Filled in by the agent before implementation.)

# Acceptance

- A proposed note in a folder that does not exist says so on its card.
- An outside agent's write that makes a folder is a step that says so.
- What was settled about moving and renaming is recorded as a decision,
  and built if the answer is yes.

# Outcome

Not started.
