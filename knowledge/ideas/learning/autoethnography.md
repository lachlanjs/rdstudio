---
type: Idea
title: Autoethnography of learning with the tool
description: The developer studies their own learning with the tool as a more rigorous test of it, using single-case designs and measures the tool did not set, with its bias acknowledged.
tags: [learning, evaluation, research, proposal]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-29T01:14:28Z }
---

# Idea

The developer learns TypeScript while the core is rewritten in it (see
[platform](/design/platform.md)), alongside the other
[alpha trials](/ideas/learning/alpha-trials.md), and writes it up as an
autoethnography: a first-person study of their own learning. It also tests the
central scenario of the [motivation](/ideas/manifesto/motivation.md), since the
core will be written largely by an agent and the developer must come to
understand it.

# Making it rigorous

Investment in the tool is a bias that cannot be removed, only declared and
worked around.

- **Single-case experimental designs,** the standard method when n = 1:
  - *Multiple baseline across subjects:* start using the tool on differential
    geometry, TypeScript and music theory (and later Rust) at staggered times; if progress
    changes when the tool is introduced to each subject, and only then, that is
    evidence for the tool rather than for time passing.
  - *Alternating treatments:* comparable topics within one subject, alternately
    learned with and without the tool.
- **Pre-registration:** before each trial, write down what you expect to be
  able to explain and do, dated and committed, so the goalposts cannot move.
- **Measures the tool did not set:** programming languages are good here because
  outside measures exist: Exercism's TypeScript track, type-challenges, building a small
  program unaided, explaining code written by someone else. For mathematics,
  problems from a textbook's exercise sets.
- **Blind rating:** explain-back answers rated by someone else (or a model not
  told which condition produced them).
- **Traces:** the [learner record](/ideas/learning/learner-record.md) gives
  dated, quantitative data to set beside the reflective journal.
- **Reflexive journal:** feelings, frustrations and doubts, including
  moments the tool got in the way.

# Caution

The tool changes during the study. Freeze a version per trial, or record
which version was used for each session.
