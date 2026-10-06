---
name: decision
description: Record a decision with its assumption and the conditions for reopening it. Use when the developer settles a design or research choice, or asks to log a decision.
---

# Record a decision

Decisions are recorded so they are not relitigated. Each one states what was
decided, the assumption it rests on, and what would justify reopening it. A
decision is reopened only when its assumption is shown false or the goal it
serves changes; an interesting alternative is not enough.

## Steps

1. Search `type: Decision` for an existing decision on the topic. If one
   exists, update it (and say whether you are revising or reopening it).
2. Record at `decisions/<short-slug>` with the rdstudio `record` tool:

```markdown
---
type: Decision
title: <the decision, as a statement>
description: <one sentence>
tags: [<area>]
---

# Decision

What was decided, concretely.

# Assumption

What must be true for this to be right, and the evidence for it.

# Alternatives considered

Briefly, and why they lost.

# Reopen if

The specific observations that would justify revisiting it.
```

3. Link the decision from the concepts it governs (design, tasks) and link to
   the evidence (references, experiments).
4. Decisions are the developer's. Record what they decided in their terms; if
   you are proposing a decision, record it with `status: draft` and say so.
