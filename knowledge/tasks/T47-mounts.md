---
type: Task
title: "T47 — Mounting a shared knowledge base"
description: "A personal repository that reads a team's knowledge base read-only underneath its own notes, links into it, follows its history, and promotes notes up to it as proposals."
tags: [task, m10, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-02T12:00:00Z }
---

# Prompt

For a team sharing an rdstudio repository without learning features, where
each person learns in a repository of their own.

- **Declaring the mount:** `[[mounts]] name = "himode" path = "..."` in
  the personal repository's `rdstudio.toml`.
- **Links:** written as `himode:/path/note.md`, resolved in the dashboard,
  map and search. Mounted notes are marked as shared and read-only.
- **The learner record** covers both repositories, keyed by repository and
  note.
- **Catching up** follows the mounted repository's git history.
- **Promoting a note** to the shared repository goes through `promote` and
  the propose and resolve procedures, as a proposal for the team to review.
- **The bundles decision:** this reopens [the multiple-bundles
  decision](/decisions/multiple-bundles.md) ("bundles do not link to each
  other"). Check the OKF spec on references between bundles before choosing
  the syntax.

Nothing about learning goes into the shared repository. Showing a team which
notes nobody understands would be opt-in, and is not part of this task.
