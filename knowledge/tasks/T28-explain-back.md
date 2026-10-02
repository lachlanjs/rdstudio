---
type: Task
title: "T28 — Explain-back and AI marking"
description: "AI-driven tasks: a skill and MCP tools to set and mark explain-back questions, answered in the harness or queued from the dashboard."
tags: [task, m8, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T09:20:35Z }
---

# Prompt

The dashboard never calls a model; answers written there wait in the record
until the skill marks them.

# Outcome (2026-10-02)

- **In the dashboard:** Explain it back, under each note (with the learner
  record on): a question set by an agent, or "In your own words: what is …,
  and why does it matter here?", and a box to answer without looking. Saved
  as an `explain` event (ai), it waits; earlier answers are listed with their
  marking (result, feedback, gaps). The Learn tab lists questions waiting for
  you and the latest marked answers. The dashboard never calls a model; it
  reloads the record when you come back to the tab, so a marking made in the
  harness meanwhile appears.
- **MCP tools** (Node server only; the Python server is kept as it was until
  it is retired, and `mcp:agree` allows these five):
  - `learner_state`: where the developer stands, overall (coverage per
    top-level folder, reviews due, answers waiting) or for one note (state,
    whether it changed since, review, recent events);
  - `explain_question`: set a question on a note, answered later in the
    dashboard;
  - `explain_pending`: answers waiting, with whether the note changed since;
  - `explain_record`: record an answer given in the conversation, unedited;
  - `explain_mark`: got, partly or missed, with feedback (required) and gaps,
    as an `explain_marked` event (ai, by the agent). A "got" is evidence: the
    note becomes understood and its review is scheduled.
  All say the record is off, and do nothing, until it is on.
- **The `explain-back` skill** (scaffolded with the others): mark against the
  note and its sources, say what was right and what was missing without
  rewriting the answer or praising beyond what is earned; ask about meaning,
  reasons and connections, aimed at reviews due, notes changed since and
  landmarks; one or two at a time. The agents' instructions mention it.
- Checked: unit tests for the tools through an MCP client (`mcp-learner.test.ts`),
  `mise run agree`, and `e2e/learn.py` (5 more checks).
