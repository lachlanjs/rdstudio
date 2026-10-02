---
type: Task
title: "T46 — Trial: dynamical mean-field theory"
description: "Learn the DMFT of random neural networks from first principles to Clark and Abbott's theory of coupled neuronal-synaptic dynamics, in a separate repository, using the teacher throughout."
tags: [task, m10, active]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-02T12:00:00Z }
---

# Prompt

A learning project of its own, separate from himode, in its own repository
with `rdstudio init --profile topic`. It ends when the developer can:

1. explain from first principles how DMFT works;
2. solve problems with it;
3. understand Clark and Abbott, *Theory of coupled neuronal-synaptic
   dynamics* ([arXiv:2302.08985](https://arxiv.org/abs/2302.08985)), which
   rests on it.

This is the dynamical mean-field theory of statistical physics, applied to
random recurrent networks. It is not the DMFT of correlated electrons, with
its impurity solvers.

# How it runs

- **Goals:** the three outcomes, written as Goal notes with exercises.
- **Diagnostic:** `assess` probes the prerequisites first. What is missing
  is added afterwards by `map`, each prerequisite noting the gap that
  prompted it.
- **Notes:** `source` grounds every note in a cited source, to the
  equation where it matters.
- **Exercises:** a mix of the three kinds:
  - choice and value exercises for definitions and calculations;
  - text exercises for derivations and explanations, marked by yourself or
    an agent;
  - code (simulating a network and solving the self-consistent equation
    numerically), pointed to from text answers.

# Likely ground

Each item is to be checked by `source`; none is assumed.

- **Prerequisites:**
  - stochastic and random differential equations;
  - Gaussian processes and their correlation functions;
  - the Martin–Siggia–Rose–Janssen–De Dominicis path integral;
  - saddle-point methods;
  - random matrices (the circular law);
  - Lyapunov exponents;
  - rate networks;
  - Hebbian plasticity.
- **Core:**
  - the self-averaging argument;
  - the effective single-unit process;
  - the self-consistent autocorrelation;
  - its solution as a particle in a potential;
  - the transition to chaos at gain 1.
- **Candidate sources:**
  - Sompolinsky, Crisanti and Sommers, *Chaos in random neural networks*
    (PRL, 1988);
  - Crisanti and Sompolinsky, *Path integral approach to random neural
    networks* (PRE, 2018);
  - Helias and Dahmen, *Statistical Field Theory for Neural Networks*
    (Springer, 2020; on arXiv);
  - Sompolinsky and Zippelius (1982) on spin-glass dynamics;
  - Martin, Siggia and Rose (1973);
  - the later papers by Clark and Abbott's group that the target paper
    cites.

# What the trial is for

Tuning the skills, and finding what the platform lacks. Problems found are
written to the task, as they are met.

# Log

## 2026-10-02: set up

- The repository is `~/Repositories/dmft`, made with `rdstudio init --profile
  topic` and committed once, so its project id (`88c75507cf417b7f`) is fixed
  from the start.
- The learner record is on in the user config.
- The teacher answers through MCP in that repository, with the seven
  default skills.
- **Finding:** `init` writes the same bootstrap task for every profile, and
  that task is written for a code repository ("read the README, propose
  directories"). For a topic, the teach skill's goals and diagnostic replace
  it. Make the bootstrap depend on the profile.

## 2026-10-02: the diagnostic ran in the chat

- **Finding:** the agent quizzed the developer in the terminal to gauge
  their level. That is what `assess` said ("ask in the conversation"), but
  the developer expected the questions in rdstudio, where they are checked,
  kept and seen again. Agents also had no way to put exercises in front of
  the developer.
- **Fixed:**
  - **Rule:** `teach` gains "Deliver through rdstudio". `assess` writes
    diagnostic questions as Exercise notes in `exercises/diagnostic/`
    (choice or value where possible) and sets them; `exercise` sets
    exercises the same way. The chat is for explaining, and for quizzing
    only when asked.
  - **MCP:** `exercise_assign` sets Exercise notes with a note saying what
    the set is for (an `assigned` event). `learner_state` shows open sets
    and their progress.
  - **The dashboard:** "Set for you" at the top of the Learn tab, with a
    count on the tab. Each exercise leads to the next in its set, and a set
    can be put aside (`assigned_closed`). A set is done when every exercise
    has been attempted since it was set.
  - **Checked:** core, MCP and `e2e/teacher.py` (4 more checks, 53 in all).
- **Noticed:** `e2e/learn.py` failed once on a map-filter step and passed on
  the rerun. That step is flaky.

## 2026-10-02: an exercise out of line, and maths as plain text

- **Finding:** on a wide screen, an exercise's problem and answer box ran
  from the left edge of the page while its heading was centred on the
  reading width. Exercises and goal panels were not held to the measure as
  the prose is. **Fixed:** both are now held to the measure, and the number
  field sits under its label.
- **Finding:** the agent wrote the exercises' maths as plain text
  (`sum_j J_j y_j`, `g^2/N`), so nothing was typeset. **Fixed in the
  skills:** `teach` gains "Write maths as maths" (LaTeX between dollar
  signs; plain words in titles and descriptions), and `exercise` gives
  examples.
