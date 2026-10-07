---
type: Idea
title: Measuring whether a mapped codebase helps agents, and people
description: The developer's question of how much more efficient an agent is after a codebase is
  mapped into OKF (with LSP as well), how much it helps a person working with one, and whether
  either can be measured in a standard way; with an outline of how.
tags: [idea, evaluation, agents, code, learning]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-06T22:34:57Z}
---

# The idea

From the developer, 2026-10-07:

- "I do wonder how much more efficient LLMs could be after they undergo a
  thorough initial mapping of a large codebase into OKF and utilise LSP
  capabilities as well."
- "I also wonder how much more efficient/effective human-LLM interaction
  could be with a tool like this and how much it would aid human
  understanding."
- "I wonder if either of these things could be measured in a standard way."

# Notes from the agent

Not the developer's words. None of the expectations here has been measured.

## What each layer is for

- **A parser (tree-sitter)** gives a fast, offline skeleton: what is
  defined where. It is what [the code map](/design/code-map.md) uses now.
- **A language server (LSP)** answers "where is this defined, what uses
  it" exactly, for any language with a server, at the cost of a project
  that builds and a slow start on a large one.
- **The knowledge base (OKF)** holds what neither can derive: what a module
  is for, why it is shaped as it is, what to read first. The symbol graph
  can be remade at any time; the explanation cannot.

## Expectations

- A map should help most with orientation: on a large repository an agent
  spends its first calls finding where things are.
- It should help little on a small repository or a task inside one file.
- The risk is staleness: a note describing the code as it was sends an
  agent the wrong way with confidence. The staleness tracking
  ([decision](/decisions/verification-staleness.md)) is what would make a
  map safe to trust.
- For people, the worry is feeling oriented without understanding more.
  The learning layer (explain-back, exercises, understanding states) is an
  instrument for telling the two apart.

## Measuring the agent's side

This can be done in a fairly standard way.

- **Tasks:** a repository-level benchmark of real issues decided by tests
  (SWE-bench, or its Verified subset).
- **Conditions:** the same agent and model on the same tasks with the bare
  repository; with LSP; with the OKF map; with both.
- **Measures:** tasks resolved, tokens, tool calls, wall time, and files
  read that turned out not to matter.
- **Cautions:** count the cost of making the map and say how many tasks it
  takes to pay back; and make the map from the repository as it stood
  before each issue's fix, or the map leaks the answer.

## Measuring the person's side

There are standard methods but no standard benchmark.

- Program-comprehension studies: answer questions about unfamiliar code,
  find a feature, fix a seeded bug, with and without the tool, for time and
  correctness.
- Studies of AI assistants: time to finish a task, in randomised trials.
- For one person: the single-case designs already proposed
  ([autoethnography](/ideas/learning/autoethnography.md),
  [alpha trials](/ideas/learning/alpha-trials.md)): alternate conditions
  over comparable tasks, measured with questions the tool did not set.
- "A person, an agent and a map together" has no accepted benchmark; that
  study would have to be designed.

## Where to start

The agent experiment: it is automated, repeatable and gives a number. Before
it, the indexer would need trying on a real repository, since it has only
seen a generated one ([limits](/design/code-map.md)).
