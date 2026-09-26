---
type: Idea
title: Private learner record, landmarks and team use
description: Keep what a person knows separate from what is true about the project, private by default, tied to note versions, with AI-assisted choice of landmarks.
tags: [learning, privacy, proposal]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T03:11:24Z }
---

# Summary

Understanding belongs to a person, not to a note. OKF `verified` means a note
was checked; it should not be stretched to mean "I understand this".

- **Project bundle** (shared): what is true about the project.
- **Learner record** (private): exercise attempts, mastered landmarks, coverage.
  Stored in the person's private repository (for example beside `~/knowledge`),
  never in the shared project.
- Records are keyed by concept id **and** a hash of its content, so a
  significant change marks mastery of the old version as out of date, as
  verification does.
- A project is identified by its root commit hash, which is the same in every
  clone, so teammates share a bundle while each keeps their own record without
  configuration.

# Choosing landmarks

Which notes are worth knowing by heart is a judgement. Three layers:

1. **Structural candidates:** PageRank, betweenness, number of cross-scale
   links ([nested links](/ideas/learning/nested-links.md)). Hubs such as tables
   of contents are excluded by declaration.
2. **AI judgement:** re-rank by how much of the picture collapses without the
   note.
3. **Human override:** `landmark: true` in frontmatter (OKF preserves unknown
   keys).

# Measurement stance

Formative assessment (for learning, private, low-stakes) is the default.
Summative demonstration is separate and deliberate. Assessment that becomes a
target stops measuring (Goodhart's, and Campbell's, law); see
[measuring understanding](/ideas/manifesto/measuring-auditing-demonstrating-understanding.md).
