---
type: Idea
title: Trial with two people building an agentic game design engine
description: A future test of rdstudio on a two-person project, an agentic game design system and engine, tracking the project, teaching its agents the procedures, and teaching the people what the agents use.
tags: [learning, evaluation, plan, team]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-01T05:00:00Z }
---

# Summary

Proposed by the user on 2026-10-01. The user plans to build an agentic game
design system and engine with a friend, and to use rdstudio on it for three
things:

- **Tracking the project:** tasks, milestones and decisions, as this
  repository tracks itself (`tasks/`, the [roadmap](/tasks/roadmap.md)).
- **Agent knowledge:** procedures and patterns for game design and
  engineering, written down so the agents that help can follow them
  (Procedure notes, skills, the MCP server).
- **Learning what the agents use:** the technology and practices the agents
  bring in that the two of them have not learned yet, the core scenario of
  the [motivation](/ideas/manifesto/motivation.md).

It would be a trial alongside the [alpha trials](/ideas/learning/alpha-trials.md),
once editing, sync and the understanding layer are far enough along.

# Why it is a good test

It tests what none of the other trials do:

| What | Why the other trials miss it |
|---|---|
| **Two people** on one bundle | Every other trial has one person. Here there are two people to attribute edits to, conflicts between their devices and agents, and two readers whose [discovery states](/ideas/learning/discovery.md) and learner records differ. |
| **Knowledge written for agents to act on** | The other trials mostly write knowledge for people to read. Here procedures and patterns guide agents doing real work, and whether those agents follow them can be checked. |
| **Code an agent wrote, in a field new to the readers** | The rdstudio trial has this, but rdstudio's author is not building the engine alone. The game trial adds a second learner and a creative field (design), alongside engineering. |
| **Design knowledge** | Game design is a craft without proofs or tests: mechanics, feel, balance, player experience. It has patterns and named practices, which suit the map, but much of it is judgement. It is a test of where the model stops, like music theory. |
| **A project that moves fast** | Engines change quickly. Notes about the code go stale, which tests staleness, verification and [catching up](/tasks/T29-catch-up.md) under real pressure. |

# What it would need

Things rdstudio does not have yet, roughly in the order the trial would hit
them:

- **Sharing the bundle between two people.** Git works today; editing from
  two devices at once needs [local-first sync](/tasks/T41-local-first-sync.md)
  (T41), and merging conflicting edits needs three-way merge (A6).
- **Per-person state.** `human:` attribution exists, from `rdstudio.toml`.
  Each person needs their own learner record, private by default and
  outside the repository.
- **Project tracking that stays light.** Task notes and a roadmap note work
  (this repository does it), but rdstudio is not an issue tracker and
  should not become one. The test is whether notes are enough, and where a
  link to an external tracker would be better.
- **Assets.** Games carry images, audio and levels, which are not notes.
  Notes can link to them (the move and delete paths refuse to remove
  non-note files without saying so). Whether they need more (previews, a
  place on the map) is an open question.
- **Agents that use the procedures.** The MCP server and skills export
  exist. The trial checks that the friends' agent harness can read them, and
  that an agent following a procedure records what it did.

# What to measure

As in the [alpha trials](/ideas/learning/alpha-trials.md), plus:

- Did each person learn what the agents introduced? Use explain-back
  ([T28](/tasks/T28-explain-back.md)) on technology neither of them chose.
- Did written procedures change what the agents did? Compare work on a task
  done with the procedure note and without it.
- Where did the two people's maps of the project differ, and did seeing
  that help them?
- What did they keep in rdstudio, and what did they move elsewhere (an
  issue tracker, a design document, chat)? That shows where its edges are.

# Open questions

- Does each person keep one bundle per project, with the engine's design
  knowledge and the game's in one place, or one bundle for the engine and
  others for each game made with it?
- When the product is itself agentic, should its agents read the same
  bundle at runtime (game design patterns as the engine's knowledge), or is
  the bundle only for building it? That would be a further, larger test of
  the format.
- How much of the trial can start before sync exists, by taking turns
  through git?
