---
type: Task
title: "T65 — Bake the grid Atlas into the repository"
description: "An rdstudio atlas command that searches the grid layout for as long as it likes and writes the positions into the repository, so everyone sees the same, stable map; the app starts from it."
tags: [task, m13, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T18:00:00Z }
---

# Prompt

The developer's choice on 2026-10-05 ("Both"): the background search of
[T63](/tasks/T63-grid-atlas.md) for everyday use, and a command to bake and
commit a polished layout that the background search then starts from.

- `rdstudio atlas [--budget S]` runs the full search (with the design's
  real-route pass) and writes `.rdstudio/atlas.json` (positions per note
  ref, and the layout key they were made for).
- The site build ships it; the app uses it as the starting point and snaps
  anything new.
- The grid code moves where the CLI can import it (packages/core), with the
  smooth layout it starts from.
