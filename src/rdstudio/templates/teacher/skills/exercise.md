---
name: exercise
description: Write exercises with solutions, of the kind that fits what is being checked, and mark answers. Use when a note or goal needs exercises, when the developer asks to practise or be tested, and when exercise answers are waiting for marking.
---

# Exercise

Exercises are how understanding becomes evidence. Read `teach` first.

## Writing one

An exercise is a note (`record`) with `type: Exercise`, in an `exercises/`
folder beside what it tests or in one for the goal, kept off the map:

```markdown
---
type: Exercise
title: Stationary autocorrelation at small gain
description: The fixed point of the self-consistent equation below the transition.
tests: [/dmft/autocorrelation.md]
goals: [/goals/clark-abbott.md]
answer: { kind: value, value: 0, tolerance: 1e-6 }
---

The problem: everything needed to start, nothing that gives it away.

# Solution

The worked solution: each step, and why. Cite the note or source for
anything taken from one.
```

Choose the kind for what is being checked:

| Checking | Kind | Settings |
|---|---|---|
| a definition, a distinction, a misconception | `choice` | `choices`, `correct` (the number of the right one, from 1; a list if several) |
| a calculation with one answer | `value` | `value`, `tolerance` (absolute, or relative with `relative: true`), `unit` |
| a derivation, an explanation, a design, code | `text` | none: marked against the solution |

- Maths is LaTeX between dollar signs, in the body, the choices and the
  solution: `$h = \sum_j J_j y_j$`, `$$\mathrm{Var}(h) = \frac{g^2}{N}\sum_j y_j^2$$`.
  The dashboard typesets it. Never write `sum_j J_j` or `g^2/N` as plain text.
  The title and description are plain text: say it in words, or use Unicode
  sparingly ("Variance of a sum of Gaussian-weighted inputs").
- Wrong choices are the mistakes people actually make, not fillers.
- A value exercise states the units and the precision wanted.
- A text exercise may say how much is wanted ("in a few sentences", "cover
  both parts"), never what the answer contains. What a full answer covers
  goes in the Solution section, as a list headed "A full answer covers",
  which is what you and the developer mark against. Make the solution
  complete.
- Settle what the exercise assumes. List, for yourself, the background and
  notation it relies on, and check each against what the developer can be
  expected to know: the notes it tests, what those require (`study_path`),
  the knowledge base's conventions note, and where the developer stands
  (`learner_state`).
  - **Covered there, and reached:** use it without comment.
  - **Covered there, but not reached yet:** link the note in the problem, or
    set the exercise later.
  - **Not in the knowledge base** (common in a diagnostic, before notes
    exist): define it in the problem, in words, such as "$\mathcal{N}(0,
    g^2/N)$, that is, mean $0$ and variance $g^2/N$". If it will recur, add
    it to the conventions note (the `map` skill).
  A convention the developer has to guess at tests the convention, not the
  idea.
- For code, the exercise names the file to write or change and how to run
  it; the solution says what a passing run shows.
- Each exercise tests a few notes at most (`tests`), and serves the goals it
  checks (`goals`). `record` warns when the answer settings are wrong or the
  Solution section is missing.

Before setting an exercise, read its problem as the developer will, with
the solution hidden, and check:
- it does not state, list or strongly hint at the answer: the answer could
  not be made by rephrasing the question;
- a choice exercise's right answer is not the longest, most qualified or
  only technical-sounding choice;
- every assumption it makes is settled, as above: nothing is left to
  guess, and nothing the developer already knows is explained again.

Write exercises at three depths for a goal: recognising (choice), doing
(value, short derivations), and transferring (a new situation, explained).

## Setting them

Set exercises through rdstudio: `exercise_assign` with the exercises and a
note saying what the set is for. They appear under "Set for you" at the top
of the Learn tab, one after another, and the dashboard checks choices and
values at once. Keep a set short (three to eight) and say in the
conversation that it is there.

Choose from `learner_state`: a goal's exercises not yet passed, starting
with those testing notes only opened, then misses due another go. Quiz in
the conversation only when the developer asks for it; record each answer
there with `exercise_record`, so it counts the same.

## Marking

`exercise_pending` lists answers the developer left for you; an answer given
in the conversation is recorded with `exercise_record` first.

1. Read the exercise, its Solution section, and the notes it tests; for code,
   run it.
2. `exercise_mark`: `got` (right in substance, whatever the route), `partly`
   (right but missing or wrong in something that matters), `missed`.
3. Feedback, two to four sentences: what was right, then what was missing or
   wrong and why it matters. Do not rewrite their answer or repeat the
   solution: point to the step.
4. `gaps`: the missing or mistaken points, a few words each. They feed the
   profile (the `assess` skill).
5. Tell the developer the results briefly, and offer to go through a miss.

A different correct route is `got`. An answer that reaches the right result by
a wrong argument is `partly` at best.

## By profile

- **topic:** derivations and calculations above all; one conceptual
  question per goal at least.
- **codebase:** predict the output of a snippet; find where something
  happens (a value: the line number; or a choice of files); fix a planted bug
  on a branch, checked by the tests (text, naming the branch); explain why a
  design choice was made.
- **project:** given a constraint, which option and why (text); estimate a
  quantity a decision rests on (value).
