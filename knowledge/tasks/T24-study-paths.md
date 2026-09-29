---
type: Task
title: T24 — Study paths and reading order
description: Use requires links to give each note its prerequisites in reading order, the whole bundle
  in reading order, and how advanced each note is.
tags: [task, m8, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-26T09:26:56Z
---

# Prompt

Needs no record. The prerequisite graph from [link ratings](/design/conventions.md)
gives a reading order (a topological sort that keeps folders together), the
study path to any note, and its depth (the longest chain of prerequisites).
Shown on the note page, in a Learn tab and on the map.

# Outcome

- `Bundle.prerequisite_order()` gives each note a place in a reading order (a topological sort of requires links, cycles taken as one step, preferring to stay in the folder just read) and a depth (the longest chain of prerequisites below it); `Bundle.prerequisites(id)` gives a note's study path. Both are exported per note, with its direct requirements.
- Learn tab: the whole reading order grouped by folder, with levels and a link to each path; the learner record's status and how to turn it on.
- Note pages: a Study path section listing what comes first, with Show on map.
- Map: `#/path/<id>` fades everything off the path, draws only requires links between its notes, numbers each note (and closed folders with the steps inside, such as 3–5), and lists the steps in a card; choosing a step zooms to it.
- `rdstudio path [id]` and the MCP tool `study_path`.

# Finding (differential geometry)

The order is only as good as the requires links. Tangent space never links to smooth manifold, so it counts as a starting point; exterior derivative comes before differential forms for the same reason. The path view makes such gaps visible, which suggests an agent pass (or an exercise) to find missing prerequisites.

Follow-up: an agent pass added the missing prerequisites (21 notes, each new
link with a one-line reason under a Builds on heading); the longest path is now
12 levels deep, from differentiability in Rⁿ up to the hyperbolic plane.
