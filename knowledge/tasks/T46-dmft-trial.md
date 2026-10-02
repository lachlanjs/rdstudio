---
type: Task
title: "T46 — Trial: dynamical mean-field theory"
description: "Learn the DMFT of random neural networks from first principles to Clark and Abbott's theory of coupled neuronal-synaptic dynamics, in a separate repository, using the teacher throughout."
tags: [task, m10, todo]
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
