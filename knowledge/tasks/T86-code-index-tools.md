---
type: Task
title: "T86 — Axis reads the code index: outlines and symbols"
description: "Two more lookup tools for Axis from the code index: the outline of a directory or
  file, and a search of symbols and their comments, so code can be found without knowing its name."
tags: [task, m14, assist, code, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:43:33Z}
---

# Prompt

Proposed by the agent and agreed by the developer, 2026-10-07 ("Agree with
the suggestion"), to follow [Ask Atlas](/tasks/T85-ask-atlas.md "see also").

Axis's code tools ([T84](/tasks/T84-assist-lookup.md "requires")) are an
exact text search and a read of lines: both need a name or a phrase. The
[code index](/design/code-map.md "requires") is not used by them, only by
the fallback for models that cannot call tools.

# Plan

- `outline_code`: for a directory, its files and folders; for a file, its
  classes, functions and constants with their signatures and the first line
  of their comments.
- `search_symbols`: keyword search over names, signatures and comments.
- Optionally, from the index's links: what calls an item and what it calls,
  marked as by name only.
- Where there is no index (a language it does not read, or the code map
  off), the tools say so and point to `search_code`.

# Acceptance

- Asked where something is done, without its name, Axis finds it by its
  comment in a codebase the index reads.
- Unit tests, and a step of the walkthrough.

# Found on the way

The index is made again whole when any code file changes
(`codeIndexSync`), not only for the files that changed. Fine for a small
repository; slow for a large one.
