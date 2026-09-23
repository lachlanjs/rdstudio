---
type: Task
title: "T11 — Procedural graphs"
description: "Procedure concepts with graphs; MCP neighbourhood lookup; Procedures tab."
tags: [task, m4, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Prompt

Parse `nodes`/`edges` from `type: Procedure` concepts ([conventions](/design/conventions.md)). MCP `procedure_next(procedure, step)` returns the 2-hop neighbourhood with edge attributes; `procedure_propose` records proposed edits for human approval, keeping rejected ones. Procedures tab draws each graph with inspectable nodes and edges. See [decision](/decisions/procedural-graphs.md).

# Acceptance

- Validation catches edges to unknown nodes.
- Graph renders and edges show their attributes on click.

# Outcome

Not started.
