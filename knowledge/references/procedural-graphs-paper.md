---
type: Reference
title: "Procedural Graphs: Self-Evolving Execution Structures for LLM Agents"
description: Lu, Chen, Wu, Arık (Google, 2026); graphs of procedure triplets guiding agents via localized subgraphs.
resource: https://arxiv.org/abs/2609.09153
tags: [procedures, agents, paper]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

Local copy: `reference/papers/2609.09153.pdf` (git-ignored).

- Graph `G = (V, R, E, Φ)`; edges are (procedure, relation, procedure) triplets
  with attributes condition, guidance, pitfalls.
- Relations used: LEADS_TO, TRIGGERS, PROVIDES_INPUT_FOR, CONVERGES_TO.
- Graphs are small: 7–17 nodes for most benchmarks.
- Online: localize the active node by exact match, take the 2-hop neighbourhood,
  generate step guidance. Localized guidance beat full-graph injection and used
  fewer tokens (−71% on ALFWorld vs full-graph generative).
- Offline: an LLM refiner proposes add/delete edits from contrasting trajectories;
  kept only if validation score does not drop; rejected edits remembered.

Bears on: [procedural graphs decision](/decisions/procedural-graphs.md).
