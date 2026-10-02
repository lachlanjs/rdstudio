---
type: Task
title: "T45 — Profile, sources and the default skills"
description: "The evidence-linked learner profile and the sources log, shown on the Teacher page, and first versions of the assess, map, source, exercise, next and review-changes skills."
tags: [task, m10, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-02T12:00:00Z }
---

# Prompt

See the [teacher design](/design/teacher.md), sections The profile, Sources
and The default skills.

- **Teacher files:** `teacher_read` and `teacher_write` for the profile,
  the sources log and private goals and exercises.
- **The Teacher page:** About you (the profile, with event references
  resolved to the answers behind them) and Sources.
- **The skills:** first versions of all seven, with sections per profile.
  They are to be tuned during [the trial](/tasks/T46-dmft-trial.md), not
  polished first.

# Outcome (2026-10-02)

- **The teacher's files:** `profile.md` and `sources.md` in the teacher
  folder.
  - Agents write them whole through `teacher_write`, with a message. Each
    write is a commit.
  - The developer edits them in the dashboard; the commit says "edited by the
    developer".
  - `teacher_read` gives a file with its recent history, says when the
    developer edited it, and with `developer_edit=true` returns that edit as
    a diff, so the agent can answer a disputed claim.
- **Evidence:**
  - `learner_events` lists the record newest first, with ids, filtered by
    note or exercise (an attempt counts for every note it tests), by event
    name and by time.
  - `learner_state` for one note now gives the ids of its recent events.
  - The profile cites events as `[e:<id>]`.
- **The Teacher page:**
  - **About you** shows the profile, each citation a link labelled with
    what it was ("Why an atlas: Partly"), coloured by the result.
  - A citation opens the evidence: the answer, who marked it, the feedback
    and the gaps.
  - `#/teacher/profile` and `#/teacher/sources` are for reading and editing,
    with their history. Your edits are said as yours.
  - **Sources** shows the research log, folded.
- **The default skills**, first versions to be tuned in the trial:
  - `teach`: the rules, a table of the skills, and the profiles.
  - `assess`: a diagnostic first, probing prerequisites one question at a
    time and recording each answer as evidence; checks against goals;
    self-marked passes retested sooner; the profile's form, with every claim
    cited and struggles given a likely cause.
  - `map`: goals as Goal notes; one idea per note; requires links;
    landmarks; filling a gap found later; folders.
  - `source`: an order of preference, judging, two sources for claims that
    matter, the sources log, checking notes against sources, and suggesting
    reading.
  - `exercise`: the format, choosing the kind for what is being checked,
    three depths per goal, setting, and marking.
  - `next`: an order of priority, one step with a reason.
  - `review-changes`: the developer's edits checked for correctness, sources
    and structure, used as evidence, and never rewritten silently.
  
  Each has a section per profile.
- **Not done: private goals and exercises** in the teacher folder. In a
  learning repository of your own they work as shared notes. They matter
  when learning on top of someone else's repository, so they wait for
  [mounts](/tasks/T47-mounts.md).
- **Checked:** unit tests for the files, the developer's edits and
  `learner_events`; `e2e/teacher.py`, 7 more checks (49 in all); every other
  suite and `mise run agree`.
