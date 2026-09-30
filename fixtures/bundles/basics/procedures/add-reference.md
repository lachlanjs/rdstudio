---
type: Procedure
title: Add a reference
description: How a new paper gets into the knowledge base.
start: find
nodes:
  - {id: find, label: Find the source}
  - {id: add, label: Add it to papis, description: With the DOI when there is one.}
  - {id: stub, label: Write the reference stub}
  - done
edges:
  - {from: find, to: add, relation: LEADS_TO}
  - {from: add, to: stub, relation: LEADS_TO, guidance: Run rdstudio refs sync.}
  - {from: stub, to: done, relation: CONVERGES_TO}
proposals:
  - {id: 1, by: agent/x, at: "2026-01-01T00:00:00Z", state: pending, rationale: Check for duplicates first.,
     edits: [{op: add_node, id: dedupe, label: Check for duplicates}, {op: add_edge, from: find, to: dedupe}]}
---

# Notes

A procedure's steps live in its frontmatter.
