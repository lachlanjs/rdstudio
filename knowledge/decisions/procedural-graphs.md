---
type: Decision
title: "Adopt procedural graphs, without automatic self-evolution"
description: "Procedures carry a small typed graph; MCP returns the 2-hop neighbourhood; edits are human-approved."
tags: [decision]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Decision

Adopt the representation from [Procedural Graphs](/references/procedural-graphs-paper.md):
nodes, typed relations, edge attributes (condition, guidance, pitfalls). The
MCP tool returns the local neighbourhood of the current step. Replace the
validation-gated self-evolution loop with agent-proposed, human-approved edits
and a record of rejected edits.

# Assumption

The paper's ablation shows localized subgraphs beat full-graph injection and use
fewer tokens; we lack scored benchmarks for automatic evolution.

# Reopen if

A project develops repeatable scored tasks where validation gating is possible.
