---
type: Design
title: "Understanding layer"
description: "How the understanding features are built: three kinds of task, a private learner record, tours kept off the map, and the order of work."
status: draft
tags: [design, learning]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T09:20:35Z }
---

# Purpose

The features proposed in [the learning ideas](/ideas/learning/index.md), made
concrete enough to build. The layer is part of rdstudio but separable, per
[where it lives](/ideas/learning/tool-boundary.md), and presented as in
[professional mode](/ideas/learning/professional-mode.md).

# Three kinds of task

Every learning activity is one of three kinds, which differ in who sets it and
who judges it. The dashboard labels them, and the record stores the kind.

| Kind | Set and judged by | Needs | Examples |
|---|---|---|---|
| **Autodidactic** | you; the tool supplies materials and keeps what you make | nothing | writing a tour, drawing your own route between two notes before seeing the shortest, summarising a folder from memory |
| **Interactive** | the dashboard, deterministically | the dashboard, offline | fill the gap, placement, naming and placing landmarks, recall with a self-grade, following a tour |
| **AI-driven** | an agent sets or marks it | a harness | explain-back, harder questions, critique of something you made |

Autodidactic work is not graded; the record notes that it was done and keeps
the product. Interactive tasks are checked by the dashboard or self-graded
(missed, partly, got it), which is honest enough for formative use. AI-driven
tasks are answered either in the harness chat or in the dashboard, where the
answer waits in the record until a skill marks it next time you are in the
harness; the dashboard itself never calls a model.

# Learner record

What you know is kept apart from what is true about the project.

- **Where:** `~/.local/share/rdstudio/learners/<project>/` by default, or
  under `[learner] path` in the user config (`~/.config/rdstudio/config.toml`),
  for example a folder in a private knowledge repository so it is versioned
  and synced. Never in the project repository, and never in a static export.
- **Project id:** the repository's root commit, which is the same in every
  clone, so teammates share a bundle and each keeps their own record without
  configuration. Outside git, a hash of the project path.
- **Format:** `record.jsonl`, one event per line, only ever appended:
  `{"at", "event", "concept", "hash", "kind", ...}`. The `hash` is of the
  note's body when the event happened, so a later significant change shows
  that what you knew was about an older version.
- **Switch:** `[learner] enabled = true` in the user config. Off by default;
  nothing is recorded until you turn it on, and the study-path features that
  need no record work either way.
- **Writing from the dashboard:** the server accepts appends at `/api/learner`
  only from its own pages (Origin must match Host, JSON only, a per-run token),
  and when bound to localhost only for localhost host names.

# Tours

A tour is an ordered list of links with a sentence of narration per stop. It
is kept **off the map and graph**: many tours would clutter them. Following a
tour highlights its route on the map, one stop at a time.

- **Your own tours** (autodidactic) live in the learner record folder, under
  `tours/`, private.
- **Shared tours** (onboarding, a colleague's walk-through) are notes with
  `type: Tour`, so they are versioned and linkable, but the map and graph leave
  them out and they are listed in the Learn tab.

Both use the same Markdown format, so a private tour can be published by
moving the file.

# Order of work (milestone M8)

1. **Learner record and landmarks** ([T23](/tasks/T23-learner-record.md)).
2. **Study paths** from `requires` links ([T24](/tasks/T24-study-paths.md)).
3. **Tours** ([T25](/tasks/T25-tours.md)).
4. **Interactive exercises** on the map ([T26](/tasks/T26-exercises.md)).
5. **Coverage and review**: the sensor made visible ([T27](/tasks/T27-coverage-review.md)).
6. **AI-driven tasks**: explain-back and marking ([T28](/tasks/T28-explain-back.md)).
7. **Catching up on change** ([T29](/tasks/T29-catch-up.md)).
8. **Editing from the dashboard** ([T30](/tasks/T30-dashboard-editing.md)),
   which may move earlier for the himode trial.

The [alpha trials](/ideas/learning/alpha-trials.md) exercise these in turn:
differential geometry needs 1 to 6, papis 7, himode 8.
