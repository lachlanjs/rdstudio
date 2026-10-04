---
type: Task
title: "T49 — Drafts and history"
description: "Exercise drafts saved as they are typed, snapshots at each request to the teacher, restoring a draft as it was, and pins that follow edits."
tags: [task, m11, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-04T10:00:00Z }
---

# Prompt

See [work together](/design/tutor.md), section Drafts and history.

# Outcome (2026-10-04)

- **Drafts:** an exercise answer, and the working behind a choice or value,
  is saved as it is typed (0.7 s after a pause) to
  `teacher/drafts/<exercise>.json`. Saving does not commit. Coming back says
  "your draft from … is back".
- **Versions:** "Keep this version" under the answer, and later each request
  to the teacher (T51), keep the draft as `v1`, `v2`, … with a reason, and
  commit.
  - Keeping an unchanged draft again adds nothing.
  - Any version can be shown beside the draft, or restored. Restoring first
    keeps what was there ("before restoring"), so a restore can be undone.
- **Submitting:** the draft and its versions are filed under the attempt's id
  (`drafts/submitted/<attempt>.json`) for marking in context, and the next
  attempt starts fresh.
- **HTTP:** `GET` and `PUT /api/teacher/drafts/{id}`, plus `POST …/versions`,
  `…/restore` and `…/submitted`. Writes have the record's checks.
- **Moved to [T51](/tasks/T51-work-together.md):** pins that follow edits.
  They need the teacher's responses to pin.
- **Checked:** unit tests (versions, restoring, filing, bad ids) and an HTTP
  test; `e2e/teacher.py`, 4 more checks (67 in all).
