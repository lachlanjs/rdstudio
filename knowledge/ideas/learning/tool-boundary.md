---
type: Idea
title: Where the understanding layer lives
description: Recommendation to build the understanding features in rdstudio on a branch as a separable, switchable layer, rather than as a new tool; name candidate par.
tags: [learning, architecture, proposal]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T03:11:24Z }
---

# Recommendation

Build it in rdstudio on a branch, as a distinct module with its own private
data ([learner record](/ideas/learning/learner-record.md)), switchable per user
and off by default in shared settings.

- Everything it needs exists: OKF, build and serve, MCP, provenance, the graph.
- The separation the developer wants (work context, team and individual,
  optional gamified features) is better served by a switchable layer than by a
  second tool.
- The manifesto describes rdstudio's fundamental purpose, so this is the tool
  growing into its purpose rather than scope creep.

**When to split:** when the learning client's needs diverge from the
dashboard's; the [editor](/ideas/learning/dashboard-editing.md) is the likely
trigger. At that point the whole tool may be renamed.

# Name

`par` (keeping understanding on par with output) is the developer's candidate
to bear in mind. `ken` ("range of understanding") was also suggested. `pid`
collides with process ids.
