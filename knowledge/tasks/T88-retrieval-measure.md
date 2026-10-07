---
type: Task
title: "T88 — A measure of retrieval: questions with known answers"
description: A set of questions, each with the section that answers it, scored for keyword search
  alone and with search by meaning.
tags: [task, m14, retrieval, measure, todo]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:43:33Z}
---

# Prompt

Step 2 of the agreed scope for
[semantic retrieval](/ideas/semantic-retrieval.md "requires"). It answers
whether search by meaning is worth its weight here, and how often keyword
search returns plausible notes that do not hold the answer, which the agent
cannot tell from a failure. See also
[measuring the map](/ideas/measuring-the-map.md "see also").

# Plan

- Some tens of questions about this base, worded as a person would ask and
  not in the notes' own words, each with the section that answers it.
- Scored: is the section in the first five, the first ten.
- For keyword search, for search by meaning
  ([T87](/tasks/T87-embedding-runtime-trial.md "uses")), and for both
  merged.

# Acceptance

The scores recorded, and a recommendation: search by meaning as a second
tool, merged with keyword search, or not built.
