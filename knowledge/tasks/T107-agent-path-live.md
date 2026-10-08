---
type: Task
title: T107 — A terminal agent's path through the base, shown live in the browser
description: The MCP server logs each call with the notes it names, rdstudio serve streams the log,
  and the Atlas draws a session as a path, live and replayable.
tags: [task, m17, agents, mcp, atlas, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T12:44:30Z}
---

# Prompt

The developer, 2026-10-08: "I would also like to scope a connection between
the agentic terminal editor (be it opencode, Claude Code, or otherwise) and
rdstudio. For instance, if the terminal based agent is reading from the
knowledge base, or editing the OKF in some way, it would be cool to see it
in the browser live. Do you think that is feasible through the MCP?"

The first of the two ideas in
[project mode: the agent's path](/ideas/project-agent-features.md), which
lists more to decide.

# Scope, from the agent

Feasible. What was found on 2026-10-08:

- **One place to log.** Every tool in `packages/cli/src/mcp.ts` is
  registered through one `tool()` wrapper. Logging each call (session,
  time, tool, the notes named, the query) is one change there.
- **The two programs share a disk, not a connection.** The MCP server is a
  separate process on stdio that the terminal agent starts; the browser
  talks to `rdstudio serve`. So the MCP process appends to a log file, and
  the server follows it and streams it.
- **A standing stream is new.** The server streams only during one request
  today (the tutor, Axis, Ask Atlas). Edits from outside are found by a
  check of the files every second and a rebuild, and the page learns of
  them on its next request. One long-lived event stream is needed; it would
  also make outside edits show at once.
- **The drawing exists.** Ask Atlas shows where an answer came from, step
  by step on the map. A session is the same kind of data.
- **Sessions can be told apart.** Each terminal session starts its own MCP
  process, and the client names itself on connecting.

**The limit:** only calls through MCP are seen. Reads and edits of the
files with the agent's own tools are
[a separate task](/tasks/T108-agent-path-file-hooks.md). And it shows what
the agent touched, not what it thought.

# To settle before a plan

- Whose sessions are shown: every agent on the machine, or one chosen.
- Whether the log is private like the learner record, and how long it is
  kept.
- What a search looks like on the map: a fan to its hits, or only the notes
  then read.
- What happens when `rdstudio serve` is not running: the log is still
  written, for replay later.

# Plan

(Filled in by the agent before implementation.)

Suggested order: the log; the stream; the live path; replay.

# Acceptance

- With `rdstudio serve` open on the Atlas and a terminal agent calling the
  MCP tools, each note read or written is marked within a second or two,
  with no reload.
- Read and written are told apart, and the session is labelled with the
  client's name.
- A finished session can be replayed.
- A note changed from outside appears changed in the browser with no
  reload.

# Outcome

Done on 2026-10-08, on the branch `feat/m16-leaner`; not committed.
Approved with the rest ("Go ahead with things").

**What it does.** With the Atlas open and the Axis panel open, a terminal
agent that calls the MCP server is followed as it works: the panel opens
its session by itself and lists each step as it is made, and the map marks
the notes searched, opened and written. A note it writes appears on the
map, marked as written. Afterwards the session is listed under "Agents at
work", to open again or delete. No model need be connected to watch.

**Choices made** (the agent's, for the developer to overrule; they answer
"To settle before a plan"):

- **Whose sessions:** every agent's on this machine, for this project.
  Each run of the MCP server is a session, named as the client names
  itself (`claude-code 2.1`).
- **Private, like the learner record:** the log is `agents.jsonl` beside
  it, outside the repository, never in a build. It is kept whether or not
  the learner record is on. `[agents] trace = false` in the user config or
  `rdstudio.toml` turns it off.
- **What is kept:** what was touched. A search's words, the notes named
  and opened, the section's heading. Never the text read or written.
- **How long:** to 4 MB, when the older half goes. A session can be
  deleted from the panel.
- **A search** marks the notes it found; a note opened that one in hand
  links to is drawn as reached by that link, as in Ask Atlas.
- **With `rdstudio serve` not running**, the log is still written, and the
  session is there to open later.

**How.**

- `packages/cli/src/trace.ts`: the log, the sessions in it, following it
  as it grows, and `Tracer`, which works out what a call touched from its
  name, arguments and reply. The tools themselves are unchanged.
- `mcp.ts`: the one `tool()` wrapper calls the tracer. A trace that fails
  never fails the call.
- `serve.ts`: `GET /api/agents/sessions`, `…/{id}`, `DELETE …/{id}`, and
  `GET /api/agents/live`, the server's first standing stream.
- `app/src/lib/views/ask.js`: the sessions, the session's view, and the
  marks, drawn by the code that draws Ask Atlas.

**Checked.**

- Four unit tests (`test/trace.test.ts`), through a real MCP client: each
  kind of step, the link a note was reached by, failures, two agents as
  two sessions, nothing of a body in the log, following, and turning it
  off.
- In a browser (`e2e/agents.py`, now in `mise run e2e`), against a real
  `rdstudio mcp` process: 19 checks. A step shows within two seconds with
  no reload; the note read is marked; the note written appears and is
  marked as written; the session is listed, opened again and deleted.
- 166 command line tests, 56 app tests and the type checks pass. The Ask
  Atlas and proposal browser checks still pass.

**Corrected from the scope above:** the page already learns of an outside
edit by itself. It asks the server for its version on a timer and reloads
its notes when it changes, so the fourth acceptance point held before this
task. The standing stream carries agents' steps only.

**Not checked.**

- With a real Claude Code or opencode session. The stand-in speaks the
  same protocol and names itself the same way, but no real harness was
  run against it.
- Behind `tailscale serve` or another proxy: a standing stream may be
  buffered or closed there. A line is sent every 25 seconds against that.
- Two agents at work at once in the browser.

**Not done.**

- A session is not played again step by step, as a kept question is: it
  is shown whole.
- Steps on the global knowledge base are not kept.
- Other pages do not show it: only the Atlas.
