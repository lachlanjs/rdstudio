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

## 2026-10-02: a question that gave its answer away

- **Finding:** a text exercise ended its problem with "A full answer
  covers: …", listing the points to be made (the central limit theorem, the
  variance $g^2 q$, the scalings). The answer was in the question. The
  `exercise` skill had said "a text exercise says what a full answer
  covers", and the agent read that as part of the problem.
  **Fixed in the skill:**
  - the problem may say how much is wanted, never what the answer contains;
  - the points go in the Solution as "A full answer covers";
  - a check before setting: no answer in the question, no telltale right
    choice, answerable without guessing at notation.
- **Finding:** the developer was unsure whether
  $\mathcal{N}(0, g^2/N)$ gives the variance or the standard deviation (it
  is the variance, as is conventional). **Fixed in the skill:** notation is
  defined in words on first use in each exercise.

## 2026-10-02: settling what an exercise assumes

- **The developer's refinement:** do not define notation in every exercise.
  Instead, question what each exercise assumes (background, notation) and
  explain only what the developer cannot be expected to know already.
- **Changed:**
  - **`exercise`:** list the exercise's assumptions and check each against
    the notes it tests, their prerequisites, the conventions note and
    `learner_state`. Something covered and reached is used without comment;
    something covered but not reached is linked, or the exercise waits;
    something not in the knowledge base (as in a diagnostic) is defined in
    the problem and added to the conventions note if it recurs.
  - **`map`:** the knowledge base keeps one conventions note, a landmark,
    that notes and exercises rely on.
- **Expect** a long run of refinements like these to the teaching skills.
  This log is where they are recorded, each with its reason.

## 2026-10-04: working behind a checked answer

- **The developer's idea:** choice and value exercises should also take
  written working. Ticking "have my working reviewed" always sends it for
  review. After a wrong answer, sending the working is offered again, so a
  small mistake can earn partial credit and the teacher can find where it
  went wrong.
- **Built:**
  - **The exercise view:** a folded "Show your working" box (Markdown and
    maths, with a preview) and the tick box. After a wrong answer, an offer
    to send the working, which reuses anything already written.
  - **Reviewing:** a waiting review can be done by yourself ("Review your
    working yourself", with the working beside the solution) or by an agent.
    Your attempts show the working, and what the check found when a review
    changed it.
  - **Events:** an attempt carries `working` and `review`, or a later
    `review_requested` adds them. The review's `attempt_marked` replaces the
    check, so a marked attempt counts once, as marked.
  - **Results:** a slip in a sound method is raised to partly. A right
    answer without a sound argument is lowered to partly, and the note is no
    longer understood on its strength.
  - **MCP:** `exercise_pending` lists reviews with `checked` and `working`;
    `exercise_mark` marks them; `exercise_record` takes working.
  - **The `exercise` skill** gains "Reviewing working": find the first wrong
    step, tell a slip from a misunderstanding, mark the whole, and name the
    misunderstood idea in `gaps`.
  - **Checked:** core tests (raising and lowering, requests after the fact,
    working kept without review), MCP tests, and `e2e/teacher.py`
    (7 more checks, 60 in all).
- **Later:** photos of working on paper, with the phone app and the home
  server.

## 2026-10-04: written answers in the live preview

- **The developer's stipulation:** a written answer should use the same live
  preview as the note editor, in a larger box.
- **Built:** `AnswerEditor`, the note editor (CodeMirror, live preview, maths
  typeset off the line being written, links to notes with `[[`) in a framed
  box.
  - It is used for written answers (14 lines tall), working (9 lines) and
    explain-back (9 lines, loaded only when that section is opened).
  - The editor's code is fetched when a box first appears, so reading pages
    stay light. If it cannot load, a plain box takes its place.
  - The preview buttons are gone.
  - **Checked:** at a wide desktop width and on a phone (no sideways
    scrolling); `e2e/teacher.py`, 60 checks; `learn.py` and `edit.py`.
- **Noticed again:** `e2e/learn.py` stopped once without a result and passed
  on the rerun. The flaky step needs finding.
- **Waiting on the developer:** three ideas, given in part.
  - **Work together:** a teacher that watches the developer's draft and
    answers in one of three modes: hint, feedback, discuss.
  - **Streaks,** which go against the "no scores or streaks" rule of the
    practice design.
  - **A third idea,** not given yet.

## Waiting, 2026-10-08

Moved from active to todo in [T104](/tasks/T104-tidy-board-server-root.md):
it is the developer's own trial in its own repository, and no agent is
working on it here.
