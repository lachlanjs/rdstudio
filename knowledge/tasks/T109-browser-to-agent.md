---
type: Task
title: T109 — From the browser to the terminal agent
description: "To explore: an MCP tool by which a terminal agent learns what the developer is looking
  at in the app, or what they have left for it."
tags: [task, m17, agents, mcp, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T22:24:46Z}
---

# Prompt

The developer, 2026-10-08: "I would also like to scope a connection between
the agentic terminal editor (be it opencode, Claude Code, or otherwise) and
rdstudio."

The developer's example was the agent's work seen in the browser
([T107](/tasks/T107-agent-path-live.md)). This is the other direction,
raised by the agent while scoping. It is to explore, and the weaker half.

# Scope, from the agent

- MCP gives the server no good way to interrupt an agent. The agent must
  ask: a tool that returns what the developer has open, what they have
  selected, or notes they have left for it.
- So it works only when the agent calls it. A skill or the session brief
  would have to tell it to.

# To settle before a plan

- What is worth passing: the note open, the selection, a marked region of
  the Atlas, a message typed in the app.
- Whether the developer sends it on purpose (a "send to the agent" action)
  or the app reports where they are at all times. The first is suggested:
  nothing is shared unasked.
- Which of several terminal sessions receives it.

# Plan

(Filled in by the agent before implementation.)

# Acceptance

- The developer marks something in the app, and a terminal agent that calls
  the tool receives it, with the note and passage named.
- Nothing about what the developer is doing reaches an agent unless they
  sent it.

# Outcome

Built on 2026-10-08, on the branch `feat/m16-leaner`; not committed.
Paused at the developer's word before the last checks were read, so left
active.

**What it does.** In the Axis panel on the Atlas, "Send to agent" sends
what is written there, with the note or folder selected on the map, to
whichever terminal agent asks next. It is listed as waiting, then as taken
and by whom. It can be taken back before it is taken.

**Choices made** (the agent's, for the developer to overrule):

- **Sent on purpose only.** Nothing of what the developer does in the app
  reaches an agent but what they send.
- **What is passed:** a message, the note or folder selected, and a marked
  passage where one is given (the panel on the Atlas gives none yet).
- **Which session receives it:** the first agent to ask. Each thing is
  given once.
- **How the agent comes to ask:** the session brief says when something
  waits, and names the tool. A session already running learns of it only
  if it calls the tool or the developer tells it.

**How.** `packages/cli/src/inbox.ts` (kept beside the learner record); the
MCP tool `from_developer`; a line in `brief`; `POST`, `GET` and `DELETE`
`/api/agents/inbox`; the button and the list in
`app/src/lib/views/ask.js`. The question box is now shown with no model
connected, since there is something to send without one.

**Checked.** A unit test through a real MCP client (given once, the brief's
line, taken back, nothing of the message in the trace), and five checks in
`e2e/agents.py` (24 of 24 passed): sent, listed as waiting with its note,
the brief saying so, the agent given it once, the app showing who took it.

**Still to do before closing.**

- Read the last run of the other browser suites (Ask Atlas, proposals, the
  editor's Axis) and the unit tests, started after the panel change and
  not read when work paused.
- Sending from beside a note, with the marked passage.
- A note in the scaffolded `AGENTS.md` section telling agents of the tool.

## The paused run, read afterwards (2026-10-08)

The run that was going when work paused finished: 172 unit tests pass and
the type checks are clean; the proposal suite passes 18 of 18. **The Ask
Atlas suite has one failure (44 pass, 1 fail)**, not yet looked at. The
likely cause is this task's change that shows the question box with no
model connected: that suite restarts the server without a key and checks
what the panel shows then. The editor suite reported 70 passes and no
failure, one fewer check than the 71 counted earlier; also not looked at.
Both are to be read before this task is closed.

## Closed (2026-10-08, later)

- The one failure in the Ask Atlas suite was its check that the question
  box is hidden with no model connected. That is now meant: the box stays,
  to write what is sent to the agent, and only Ask and the tier are
  hidden. The check says so now, with one more for the Send button. The
  suite passes, 46 of 46.
- The editor suite's count was misread: it passes 71 of 71, as before.
- The scaffolded `AGENTS.md` section, and this repository's, tell agents
  of `from_developer`.
- 172 unit tests pass.

**Not done:** sending from beside a note with the marked passage. The
server takes a passage; no page sends one yet.

**Not checked:** with a real terminal agent. Whether an agent calls the
tool when its brief tells it to is untried.
