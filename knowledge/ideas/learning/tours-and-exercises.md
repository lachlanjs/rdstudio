---
type: Idea
title: Tours, exercises and catch-up views
description: Concrete dashboard features for journeying, pathfinding, reciting landmarks and filling gaps, plus views for catching up on change.
tags: [learning, dashboard, proposal]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T03:11:24Z }
---

# Summary

Features that turn the interventions in
[building understanding](/ideas/manifesto/building-understanding.md) into
dashboard features. Most need no AI; AI marks free-form answers and sets harder
questions.

# Tours

An ordered path through notes with one sentence of narration per stop, written
by the developer or an agent and stored as a concept. The dashboard steps
through it and pans the graph. Covers journeying, touring a colleague
(demonstration), and onboarding.

# Exercises

- **Fill the gap:** hide a node; its links and folder are the clues.
- **Recite landmarks:** from a title, recall the description or key decision.
- **Pathfinding:** build a route between two distant notes, then compare it
  with the shortest paths.
- **Placement:** which folder does this note belong in?
- **Explain-back:** answer in your own words; the critic checks the answer
  against the note and the resource, pointing out gaps without rewriting.

Retrieval practice (the testing effect), cloze deletion and the generation
effect, self-explanation and elaborative interrogation support these; Bjork's
"desirable difficulties" is the umbrella.

# Landmarks as a lesson

- Name the landmarks from memory, with the map showing only folders.
- Place each landmark in its folder.
- Explain why each is central, checked against how many concepts depend on
  it, directly or through chains of `requires` links ("you called X central;
  23 concepts depend on it").

The prerequisite graph from [link ratings](/design/conventions.md) also gives
a reading order (a topological sort), the prerequisites of any concept (a study
path), and how advanced a concept is (its longest prerequisite chain).

# Catch-up views

- **Changed since you looked:** a note verified earlier shows its diff since
  verification, from git history.
- **Progressive disclosure:** title and description, then headings, then text.
- **Open questions** marked on the map as a pull, following
  [professional mode](/ideas/learning/professional-mode.md).
