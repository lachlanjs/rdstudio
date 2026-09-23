---
type: Task
title: T11 — Procedural graphs
description: Procedure concepts with graphs; MCP neighbourhood lookup; Procedures tab.
tags: [task, m4, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:32:21Z
---

# Prompt

Parse `nodes`/`edges` from `type: Procedure` concepts ([conventions](/design/conventions.md)). MCP `procedure_next(procedure, step)` returns the 2-hop neighbourhood with edge attributes; `procedure_propose` records proposed edits for human approval, keeping rejected ones. Procedures tab draws each graph with inspectable nodes and edges. See [decision](/decisions/procedural-graphs.md).

# Acceptance

- Validation catches edges to unknown nodes.
- Graph renders and edges show their attributes on click.

# Outcome

`rdstudio.procedures`: graph parsing and validation (unknown nodes and relations are lint errors), `start` node, k-hop neighbourhood, proposals stored on the concept (`proposals` with state pending, applied or rejected; rejections kept). MCP `procedure_next` and `procedure_propose`; CLI `rdstudio procedure list|show|apply|reject`. Procedures tab: longest-path layered flow (left to right when it fits, otherwise top to bottom), layer-skipping and back edges routed around nodes, dots mark transitions with notes (red for pitfalls), inspector for steps and transitions, proposal history. Pending proposals appear in Review. Tests: `tests/test_procedures.py`.
