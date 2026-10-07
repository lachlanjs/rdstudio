---
type: Task
title: "T88 — A measure of retrieval: questions with known answers"
description: A set of questions, each with the section that answers it, scored for keyword search
  alone and with search by meaning.
tags: [task, m14, retrieval, measure, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T04:13:19Z}
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

# Result

2026-10-07. 45 questions in `bench/retrieval/questions.json`, each with the
note that answers it and, for some, other notes that would also do. Scored
by note, not by section: is an answering note among the first k notes
returned. Search by meaning used the trial's vectors
([T87](/tasks/T87-embedding-runtime-trial.md "uses")): 607 sections, a
note's score being its best section's.

| Search | First | First 3 | First 5 | First 10 | Not in 20 |
|---|---|---|---|---|---|
| Keyword | 51% | 62% | 64% | 71% | 7 |
| By meaning | 60% | 73% | 76% | 84% | 5 |
| Merged (reciprocal rank) | 62% | 71% | 73% | 80% | 5 |
| Either, each asked separately | | | 80% | 87% | |

Counting only the one intended note, the first-five figures are 64%, 73%
and 73%.

## What it shows

- Search by meaning found the answer first or second for five questions
  where keyword search did not return it in twenty. Examples: "Is the point
  of project mode to visualise source files?", "How are directories shown
  on the visual overview?", "Can a note contain an interactive chart?".
- Keyword search was better on three, where a rare word in the question is
  in the note ("licence", "newcomer", "background").
- Merging the two lists is no better than search by meaning alone. Asking
  both and taking either is better than both.
- Four questions were found by neither in twenty, among them "How do I
  mark that one note depends on another?". Task notes crowd the top of
  both lists: 78 of the 164 notes are tasks.
- On the question in the prompt: for 16 of 45 questions keyword search
  returned five notes, none of which answers. The agent is not told so.

## Limits

- The questions were written by the agent, who knew the notes, to avoid the
  notes' words. That favours search by meaning. A set written by someone
  who did not know the notes would be fairer.
- 45 questions: a difference of one question is two points.
- Each search is one query. An agent rewords and searches again, which
  this does not measure.
- By note, not by section, though the plan said section.

## Recommendation

Build it as scoped: a second tool beside keyword search, not merged into
it. The gain here is 64% to 80% within five results. Recommended by the
agent; [T89](/tasks/T89-find-similar.md "see also") goes ahead on it,
and the developer can stop it.
