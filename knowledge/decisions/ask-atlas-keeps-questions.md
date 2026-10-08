---
type: Decision
title: Ask Atlas keeps its questions, in the learner record
description: Questions asked on the Atlas and their answers are kept, privately, in the asker's
  learner record; the first version kept nothing.
tags: [decision, atlas, assist, learner]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T22:53:05Z}
---

# Decision

Each question asked on the Atlas is kept with its answer, the lookups made
and the usage, in the asker's private learner record. This replaces the
first version's rule in [Ask Atlas](/design/ask-atlas.md "see also"):
"Questions and answers are not kept."

Decided by the developer on 2026-10-07, choosing the learner record over
the knowledge base.

# Why

- A list of past questions and a replay of how each was answered need the
  record ([T94](/tasks/T94-ask-history.md "see also")).
- The learner record is one person's, on their machine, never in the
  repository. The knowledge base is shared and versioned, so every question
  would be committed and seen by everyone.

# Assumption

The questions are the asker's own working, not knowledge of the project.

# Reopen if

- Answers turn out worth sharing: then a kept answer could be promoted to a
  note by hand, which this does not rule out.
- The learner record is off for most people who ask: nothing is kept then.
