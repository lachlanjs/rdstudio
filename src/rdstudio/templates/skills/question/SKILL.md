---
name: question
description: Record an open question, or record the answer to one. Use when an unresolved question comes up that should not be forgotten, or when a recorded question gets answered.
---

# Questions

## Opening a question

Search `type: Question` first. Then record at `questions/<short-slug>`:

```markdown
---
type: Question
title: <the question, ending with ?>
description: <why it matters, one sentence>
tags: [open]
---

# Question

The question in full, with context and what depends on it.

# Leads

What might answer it (references, experiments, people).
```

## Answering a question

Update the concept: add an `# Answer` section (with sources or the experiment
that settled it), change the `open` tag to `answered`, and link any decision
that followed. Keep the question text unchanged so the history reads clearly.
