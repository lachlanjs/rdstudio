---
type: Task
title: "T87 — Trial: a small embedding model through WebAssembly"
description: Run the bundled embedding model in Node through WebAssembly on this base, and measure
  its speed and what it adds to the package, before anything is built on it.
tags: [task, m14, retrieval, trial, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:43:33Z}
---

# Prompt

Step 1 of the agreed scope for
[semantic retrieval](/ideas/semantic-retrieval.md "requires")
([decision](/decisions/semantic-search-local.md "requires")). Every size and
speed in the scope is an estimate; this replaces them with measurements.

# Plan

- `bge-small` through WebAssembly in Node, with no native binary.
- Time to embed this base's sections once, and one query.
- What the model and the runtime add to the installed package.
- Whether the same code loads in a browser, as the desktop and phone apps
  would run it.

# Acceptance

Numbers recorded here, and a yes or no on the scope's assumption that this
is fast and small enough on every platform.
