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

- Wrong choices are the mistakes people actually make, not fillers.
- A value exercise states the units and the precision wanted.
- A text exercise says what a full answer covers; its solution is what you
  will mark against, so make it complete.
- For code, the exercise names the file to write or change and how to run
  it; the solution says what a passing run shows.
- Each exercise tests a few notes at most (`tests`), and serves the goals it
  checks (`goals`). `record` warns when the answer settings are wrong or the
  Solution section is missing.

Write exercises at three depths for a goal: recognising (choice), doing
(value, short derivations), and transferring (a new situation, explained).

## Setting them

In the conversation, give one exercise at a time and let the developer
answer there or in the dashboard (each Exercise note is answered on its
page). Choose from `learner_state`: a goal's exercises not yet passed,
starting with those testing notes only opened, then misses due another go.

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
