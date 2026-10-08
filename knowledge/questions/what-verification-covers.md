---
type: Question
title: Which notes should count as needing a person's check?
description: Every note counts as unverified until a person checks it, so this project's brief
  reports 187 unverified, 110 of them task records; should verification apply to every kind of note,
  or only to those that can be wrong?
tags: [open, trust, review]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T22:39:37Z}
---

# Question

Should "unverified" be counted for every note, as now, or only for the
kinds that state something which can be wrong?

Raised by [T105](/tasks/T105-verification-in-use.md), 2026-10-09. Until
then no note in this project had been verified. Part of the reason was
cost, which T105 removed: a note can now be marked as checked from the
app. The other part is this.

# What is so today

- Every note is `unverified` until a person verifies it, whatever its
  type. The session brief reports the count ("187 unverified"), the Review
  page lists them all, and "reviewed" is one of the three things the
  Atlas's Health lens draws a note by.
- In this project, 110 of 187 notes are tasks. A task's note is a record
  of what was asked and what was done. Reading it over is worth doing;
  "checking it is right" means little.
- The notes that can be wrong, and that agents and people rely on, are
  decisions (21), designs (19), procedures (4) and references (3): 47.

# Ways to answer

1. **Leave it.** Every note counts. The number is large and mostly
   noise in a project run by tasks, as here.
2. **By type, with a default.** A setting names the types that need a
   check (say Decision, Design, Procedure, Reference, and in a learning
   project the study notes). The rest are not counted and not listed.
   The agent's suggestion.
3. **By the note.** A field in a note's frontmatter says it needs no
   check. Exact, and one more thing to write on every note.
4. **Let explain-back stand for it** on study notes: a note the developer
   has explained back and passed is taken as checked. This joins the two
   targets, and makes "verified" mean the developer understood it, which
   is more than that they clicked.

# What it touches

The brief's line, the Review page's lists, the Health lens, the MCP
`review_queue` tool, and the meaning of the trust badge on a note.
Whatever is chosen should be the same in all of them.
