---
name: assess
description: Find out where the developer stands, against their goals or a part of the knowledge base, and keep the teacher's profile of them. Use at the start of learning something (a diagnostic), when they ask how they are doing, before planning what is next, and when retests fall due.
---

# Assess

You find out what the developer knows and can do, from evidence, and keep
`profile.md` (through `teacher_read` and `teacher_write`) as the record of
it. Read `teach` first.

## A diagnostic, at the start

Before teaching something new, find what it rests on and probe that, so gaps
are filled first rather than discovered halfway.

1. Read the goals (`learner_state` lists them, with what each needs) or, with
   none yet, ask the developer what they want to be able to do, and propose
   goals (the `map` skill writes them).
2. List what the goal needs (`study_path` on each note it requires), and the
   prerequisites that are not in the knowledge base yet: what a textbook on
   the subject would assume. Ask the developer which they believe they know.
   A belief is not evidence; it decides where to probe first.
3. Probe each prerequisite with one or two questions that need the idea, not
   its name: a short calculation, a "what happens if", a definition used.
   **Deliver them through rdstudio, not the chat:** write each as an Exercise
   note in `exercises/diagnostic/` (the `exercise` skill; `tags:
   [diagnostic]`), choice or value wherever the answer allows, so the
   dashboard checks it at once, and text for explanations. Set them with
   `exercise_assign` and a note saying what the set is for. Tell the
   developer they are under "Set for you" in the Learn tab, and wait.
   Ask in the conversation only when the developer prefers it; then record
   each answer (`exercise_record`) and mark it, so it is evidence all the same.
4. When they are done (`learner_state` shows the set's progress), mark the
   text answers (`exercise_pending`, `exercise_mark`) and read the rest
   (`learner_events`). Probe further where the results are unclear: a second,
   smaller set. Stop probing an area at the first clear miss, or after two
   clear passes.
5. Report in a few lines: solid, shaky, missing. For each missing
   prerequisite, propose filling it (the `map` skill adds the note, saying
   which gap prompted it) before going on.

## Checking against a goal

A goal is met when its exercises are passed (`learner_state`). Between
diagnostics, check progress by setting the goal's exercises the developer
has not passed, starting from those testing notes they have only opened.
Self-marked passes are weaker evidence than checked or agent-marked ones:
retest them sooner, with a different exercise where there is one.

## The profile

Update `profile.md` after a diagnostic, after a session with several marked
answers, and when the developer asks. Read it first: keep what still holds,
revise what the evidence has moved, and answer the developer's own edits
(`teacher_read` tells you of one; read it with `developer_edit=true`). If
they disputed a claim, either drop it or say what evidence keeps it, and ask.

```markdown
# Strong
- Linear stability of fixed points: 3 calculations right first time [e:…] [e:…] [e:…].

# Struggling
- Gaussian integrals with sources: completes the square but loses the
  normalisation [e:…] [e:…]. Likely cause: the determinant factor was never
  derived. Fill: the note on Gaussian integrals, then exercise X.

# How they learn
- Asks for the derivation before the intuition, and retains it better that
  way (recall after a week: derivation-first notes 4/5, others 1/3) [e:…].

# Retest
- 2026-10-14: the cavity argument (passed once, self-marked [e:…]).

# Changes
- 2026-10-07: first picture, from the diagnostic.
```

- Every claim cites the events behind it (`learner_events` gives their ids).
  No evidence, no claim.
- "Struggling" says the likely reason and what would fix it. The reason is
  a hypothesis: say so, and test it.
- "How they learn" needs a pattern across several pieces of evidence, not
  one.
- "Retest" holds dates. The spaced review schedules notes by itself; this
  list is for what the review does not catch: goals, self-marked passes,
  skills used rarely.
- Add one dated line to "Changes" per revision, saying what moved.

## By profile

- **topic:** probe with calculations and derivations as well as definitions.
- **codebase:** probe by asking what a piece of code does, where something
  happens, what would break if a line changed; check answers against the
  code, not the notes.
- **project:** probe the knowledge the open decisions need; a gap here is a
  risk to the project as well as to the developer, so say which decision it
  affects.
