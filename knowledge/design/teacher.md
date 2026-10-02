---
type: Design
title: "Teacher"
description: "The agent's side of learning, kept apart from the knowledge base: skills served through MCP, goals, exercises with solutions, the sources log and an evidence-linked profile of the learner, in a private folder beside the learner record."
status: draft
tags: [design, learning]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-02T12:00:00Z }
---

# Purpose

The [understanding layer](/design/understanding-layer.md) gives the learner a
record and the dashboard exercises it can check. An agent working with the
learner still lacks four things:
- a way of working it can rely on, the same in every session;
- goals to teach towards;
- exercises worth more than recall;
- a memory of who it is teaching.

This design adds that side, called the teacher. It should support three kinds
of learning equally:
- a topic (the first trial is dynamical mean-field theory);
- an existing codebase;
- a project starting from scratch.

Nothing in it assumes a curriculum or mathematics.

# Three layers

| Layer | Holds | Where | Shared? |
|---|---|---|---|
| Knowledge base | notes, `requires` links, references, shared tours, goals and exercises | the repository | yes |
| Learner record | what you opened, marked, practised and answered | `learners/<project>/record.jsonl` | never |
| Teacher | skill overrides, private goals and exercises, the sources log, the profile | `learners/<project>/teacher/` | never |

The teacher folder sits beside the record, because what it holds is about the
learner, not about the subject. It never enters the project repository, so it
works on a shared team repository without anyone else seeing it.

The learner folder (record, tours and teacher) is made a git repository on
first use. Two things follow from that:
- **How the picture of you changed over time** is the history of
  `profile.md`.
- **Syncing between devices** works by pushing the folder to a private
  remote; rdstudio never adds one itself.

The server commits teacher files when an agent or the dashboard writes them,
one commit per write. The record is committed with them. If the learner folder
is already inside another repository (a learner path set in a private
knowledge base, say), its history is left to that repository.

# Skills served through MCP

The default skills ship with rdstudio, in `templates/teacher/skills/`. A
skill's override lives in `teacher/skills/<name>.md`, and wins over the
default.

The harness gets the skills in two parts:
- **one stub skill, `teach`,** installed by `rdstudio init`;
- **the MCP tools** `teacher_skills` (list them) and `teacher_skill` (read
  one, resolved).

Skills aren't installed into the harness directly, for three reasons:
- the overrides are private, but a harness's skills folder is often
  committed to the repository;
- a change to an override applies in the next session without reinstalling;
- the stub says nothing personal, so it is harmless in a shared repository.

Customising is possible but not the default:
- **The Teacher page** lists each skill as *default* or *changed*.
- **Customising** copies the default into an override, which you then edit.
- **Reset** deletes the override.
- **When rdstudio's default changes** under an override, the page shows the
  difference so you can merge it.

## Profiles

The profile belongs to the project, not the learner: a codebase is a codebase
for everyone who learns it. So it is kept in `rdstudio.toml`, as
`[teacher] profile`. It is set with `rdstudio init --profile
topic|codebase|project` or `rdstudio teacher profile`. When unset, it is
guessed: `codebase` when the repository holds code, `topic` otherwise.

The skills are the same for every profile; each has short sections per
profile, and the stub tells the agent which applies.

| Profile | Ground truth | Typical exercise | Goals come from |
|---|---|---|---|
| topic | texts and papers, cited to the page or equation | derivations, calculations, explanations | outcomes you state |
| codebase | the code; notes link to paths | predict what this does; fix a planted bug, checked by the tests | "be able to change X safely" |
| project | decisions still being made | "what do you need to know to decide D?" | the project's decisions and tasks |

## The default skills

| Skill | Does |
|---|---|
| `teach` | the stub: the profile, the other skills, the rules every skill keeps |
| `assess` | where you stand: a diagnostic at the start, checks against a goal, retests; updates the profile |
| `map` | the chain of dependencies: `requires` links, landmarks, gaps, prerequisites added afterwards with the gap that prompted them |
| `source` | finding and checking sources: textbooks, open courses, papers, documentation; logs what was searched, chosen and rejected; checks claims in notes against them |
| `exercise` | writing exercises with solutions, of the kind that fits, and marking answers; explain-back becomes one kind of exercise |
| `next` | what to study next, from goals, coverage, reviews due and the profile |
| `review-changes` | reviewing what you changed or added to the knowledge base: correctness, links, sources; says what it found and does not quietly rewrite |

These rules hold across all of them:
- **Evidence:** understanding is claimed only on evidence or your own mark.
- **Sources:** every claim taught is sourced.
- **Correcting the learner:** a mistake is said plainly, without flattery.
- **Workload:** one or two things are asked at a time.

# Goals

A goal is an outcome stated so it can be checked. For example: "Derive the
self-consistent equation for the autocorrelation in a random rate network,
and solve it numerically."

Goals follow tours:
- **Shared goals** are notes with `type: Goal`.
- **Private goals** are in `teacher/goals/`. These are not built yet:
  they wait for [mounts](/tasks/T47-mounts.md), as in a repository of your
  own a shared goal is already yours.

Both are kept off the map. Each goal has three parts:
- `requires`: the notes it needs. Its prerequisites are their closure,
  through the reading order of [T24](/tasks/T24-study-paths.md).
- **A body:** the outcome and how it will be checked.
- **Exercises:** the exercises that name it in their `goals`.

Coverage is shown per goal, using the same states as per folder. A goal is met
when its exercises are passed. Its notes being understood is not enough.

# Exercises

An exercise is a note with `type: Exercise`, kept off the map. It is shared
like a problem set; private exercises, set for your weak spots, go in
`teacher/exercises/`.

```yaml
type: Exercise
title: "Stationary autocorrelation below the transition"
tests: [/dynamics/self-consistent-autocorrelation.md]   # the notes it checks
goals: [/goals/understand-clark-abbott.md]
answer:
  kind: value          # choice | value | text
  value: 0
  tolerance: 1e-6
```

The body is the problem, then a `# Solution` section. The dashboard hides the
solution until you answer or give up.

| Kind | Answered with | Marked by |
|---|---|---|
| `choice` | one of `choices` (`correct` is its number, from 1; a list when several are right) | the dashboard |
| `value` | a number, within `tolerance` (relative when `relative: true`) | the dashboard |
| `text` | Markdown and maths, or a pointer to files in the repository (a script, a scan of working) | you, against the solution, or an agent |

For a `text` answer you choose how it's marked, each time:
- **Mark it yourself** against the written solution, which works without a
  model;
- **Ask an agent**, in which case the answer waits in the record, as
  explain-back answers do.

The record keeps who marked it in `by`: `dashboard`, `self` or an agent. All
three count as evidence. The `assess` skill weighs self-marks less, and retests
them sooner.

An answer is an `attempt` event:
- `exercise` is the exercise note's id;
- `tests` lists the notes it covers;
- `answer` is what you wrote;
- `result` and `by` are filled in when it is marked there and then.

An agent's marking comes later, as an `attempt_marked` event with the same
fields as `explain_marked`. Marking a waiting answer yourself is an
`attempt_marked` event too, with `by: self`. A `got` is evidence for every
note in `tests`.

Explain-back keeps its own events and tools for now. It is quicker than an
exercise (no note to write first), and folding it in can wait until the trial
shows whether it is worth doing.

# The profile

`teacher/profile.md` is the agent's picture of the learner, written only by the
`assess` skill:

- **Strong:** what comes easily.
- **Struggling:** what does not, and the likely reason (a missing
  prerequisite, a habit, a confusion between two notes).
- **How you learn:** for example, derivation before intuition, or examples
  first.
- **Retest:** notes and goals, with dates.
- **Changes:** a dated line for each revision.

Every claim cites events by id, such as `[e:3f9a…]`. The Teacher page turns
these into the answers and markings behind them. A claim with no evidence is
not written. You can dispute a claim by editing the file. The agent reads your
edits and answers them, and the git history keeps both versions.

# Sources

References cited by notes belong to the knowledge base (`references/`, with
papis where configured). `teacher/sources.md` is the research log:
- what was searched;
- which candidates were found;
- which were chosen or rejected, and why;
- how far each can be trusted;
- which notes were checked against what.

It answers "where did this come from" without cluttering the notes.

# Tools

New MCP tools, in the Node server only (like the learner tools):
- **Skills:** `teacher_skills`, `teacher_skill`.
- **Teacher files:** `teacher_read` and `teacher_write`, for `profile.md`
  and `sources.md`. They exist because the harness usually cannot write
  outside the repository. `teacher_read` also gives the developer's own
  latest edit as a diff.
- **Evidence:** `learner_events`, the record with event ids to cite.
- **Exercises:** `exercise_pending`, `exercise_record`, `exercise_mark`.
- **`learner_state`** gains goals and per-goal coverage.

New HTTP routes cover the same ground for the Teacher page and the Exercise
view.

# The Teacher page

The Teacher page (`#/teacher`) is reached from the foot of the Learn tab and
from Settings, not from the main navigation. It has four sections:
- **Goals:** each goal with its coverage and exercises.
- **About you:** the profile, with its evidence.
- **Sources:** the log.
- **Skills:** the list, viewing, customising, reset and the difference from
  the default.

# Where it runs

Today the teacher runs in a desktop harness through MCP. Running it from any
device (a home server, OpenRouter or a key in the app, the Claude or ChatGPT
apps as connectors) is in [where the teacher runs](/design/ai-providers.md).

# Order of work (milestone M10)

1. [T43 Teacher foundation](/tasks/T43-teacher-foundation.md): the folder as a
   git repository, skills served through MCP with profiles and overrides, and
   the Teacher page with its Skills section.
2. [T44 Goals and exercises](/tasks/T44-goals-and-exercises.md): Goal and
   Exercise notes, answer kinds and marking modes, coverage per goal.
3. [T45 Profile, sources and the default skills](/tasks/T45-profile-and-skills.md):
   the evidence-linked profile and sources log, and first versions of the
   skills, to be tuned in use.
4. [T46 Trial: dynamical mean-field theory](/tasks/T46-dmft-trial.md).
5. [T47 Mounting a shared knowledge base](/tasks/T47-mounts.md): a personal
   repository read on top of a team's.
