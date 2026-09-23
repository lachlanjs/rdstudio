---
name: task
description: Create or work through a task concept (prompt, plan, approval, implementation, outcome). Use when the developer hands over a piece of work as a task, or points at a task concept.
---

# Tasks

Tasks are concepts in `tasks/` with `type: Task`. Their state is a tag:
`todo`, `active`, `done` or `dropped`.

## Creating a task

```markdown
---
type: Task
title: <imperative summary>
description: <one sentence>
tags: [task, todo]
---

# Prompt

What is wanted, in the developer's words.

# Plan

(Filled in by the agent before implementation.)

# Acceptance

How we will know it is done.

# Outcome

Not started.
```

## Working a task

1. Read the task. Search the knowledge base for related decisions and designs.
2. Write the `# Plan` section: files to change, approach, assumptions, and open
   questions. Set the tag to `active`. **Stop and wait for the developer's
   approval.**
3. Implement. Record decisions and findings as they arise (`/decision`,
   `/record-okf`).
4. Write `# Outcome`: what changed, deviations from the plan and why, follow-ups,
   and anything the developer should test. Link the report if you wrote one.
   Set the tag to `done`.
5. Write a report with `/report` for substantial tasks.

Never edit the `# Prompt` section.
