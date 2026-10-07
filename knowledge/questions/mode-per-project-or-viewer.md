---
type: Question
title: Is the mode (Learning or Project) the project's, or the viewer's?
description: Today one setting decides the mode for everyone who opens a project, so a newcomer
  learning a codebase and its author see the same app; several features wait on which it should be.
tags: [open, project-mode, learning]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-06T22:34:35Z}
---

# Question

Should Learning or Project be a property of the project, as now, or of the
person looking at it (or both: a project default that a person can change)?

How it is decided today ([T59](/tasks/T59-project-mode.md)): from the
teacher's profile, `[teacher] profile` in `rdstudio.toml`. `topic` is
Learning; `codebase` and `project` are both Project. Unset, it is guessed: a
repository with `package.json`, `pyproject.toml`, `CMakeLists.txt`, `src` or
the like is a codebase. A static export has no mode.

What the mode changes in the app, as of 2026-10-07: the tag beside the
project's name; the fourth space (Practice or Project); the Today page
(streaks and study, or the week's counters and what needs you); the Atlas's
default lens (Understanding or Activity); and whether the code is indexed.
Library, the note page, the Atlas's drawing and the learning features are
the same in both.

Weak points noticed when this was written up for the developer:

- **One setting for everyone.** The same repository cannot be "learning" for
  a newcomer and "project" for its author.
- **Tied to the teacher.** The mode is derived from a teaching setting; the
  code says "until projects say so themselves".
- **`codebase` and `project` look the same** in the app; only agents are
  told the difference.
- **Mostly defaults.** Apart from Today and one space, Project mode is
  Learning mode with different starting choices.

What depends on it: [a half-way student test bed](/ideas/learning/halfway-student.md),
which would show both workflows on one project; and where the project-mode
features ([scope](/decisions/project-mode-scope.md),
[ideas](/ideas/project-agent-features.md)) appear for someone who is also
learning the project.

# Leads

- The learner record is already per person and private
  ([learner record](/ideas/learning/learner-record.md)); a viewer's mode
  could live beside it.
- [Professional mode](/ideas/learning/professional-mode.md) describes the
  learning features presented for a work context, which is the "learning
  layer on top of a project" that Project mode already claims.
- Try it: the half-way student on the differential geometry bundle, opened
  once as the student and once as the author.
- Since [T75](/tasks/T75-mode-switch.md) the project's mode can be switched
  from the app (the tag in the bar, or Settings). It is still the project's:
  the switch writes `rdstudio.toml`. That makes trying both modes on one
  project cheap, which may be enough, or may show that it needs to be the
  viewer's.
