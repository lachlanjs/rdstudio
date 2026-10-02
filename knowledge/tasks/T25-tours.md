---
type: Task
title: "T25 — Tours"
description: "Ordered walks through notes with narration; your own tours private, shared tours as Tour notes kept off the map; following one highlights its route."
tags: [task, m8, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T09:20:35Z }
---

# Prompt

See [tours](/design/understanding-layer.md). Writing a tour is an autodidactic
task; following one is interactive.

# Outcome (2026-10-02)

- **Format.** A tour is Markdown: the items of its outermost lists, each
  starting with a link to a stop and followed by that stop's narration
  (`1. [Smooth manifold](/manifolds/smooth-manifold.md): where it starts.`).
  Text before the list is an introduction. `tourStops` and `tourBody` in
  `packages/core/src/learning.ts` read and write it, so the dashboard and
  agents agree.
- **Shared tours** are notes with `type: Tour`. The map and graph leave them
  out (and the map's legend); the tree keeps them, and the Learn tab lists
  them. A Tour note's page has Follow this tour.
- **Following** (`#/tour/<id>`): the map in the study path's mode, the stops
  numbered, a route drawn from each stop to the next whether or not the notes
  link, the stop you are at marked, and a card with the narration, Previous
  and Next (or the arrow keys), Open the note, and the list of stops. Each
  stop reached is a `tour_step` event (interactive), at most once per stop
  per half hour.
- **Your own tours** (`#/tours/new`, `#/tours/<name>`): a title, a
  description, and stops chosen from the notes by title, each with a sentence
  of narration, reordered with arrows. Kept in the learner record's folder
  under `tours/` (`GET`, `PUT` and `DELETE /api/learner/tours`, with the
  record's protection), never in the project. Writing one is a
  `tour_written` event (autodidactic). Publish to the project (when editing
  is allowed) makes it a Tour note in `tours/` and removes the private copy.
  Followed as `#/tour/~name`.
- Checked: unit tests for the format, server tests for the private tours,
  and `e2e/learn.py` (19 checks, desktop and phone).
