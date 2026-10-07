---
type: Idea
title: "Project mode: watching an agent's path through the base, and an agent in the editor"
description: "Two ideas from the developer for project mode: show which notes an agent reads and writes as it works, as a path on the Atlas; and let the person editing a note ask an agent about a passage or have it fill one in."
tags: [idea, project-mode, agents, atlas, editor]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-06T23:50:32Z}
---

# The ideas

From the developer, 2026-10-07, when deciding that project mode should be
about the knowledge base and agents' workflows, not a map of the code:

1. **The agent's path.** "When interacting with the Agent (whether in the
   command line or in the application) visualise the traversal of the
   agent's thought process through the OKF."
2. **An agent in the editor.** "When editing/adding notes to the OKF, having
   some agent involvement in that process": highlight text in a new or
   existing note and ask the agent for insight on it, or ask it to fill in
   text, for example "find relevant code and insert it in the document in a
   specified location". This would mirror the feedback in learning mode.

# Notes from the agent

Not the developer's words; what exists to build on, and what to decide.

## The agent's path

- **What can be seen.** Not thought, but what the agent touches: each call
  to the MCP server (`search`, `outline`, `read`, `list_concepts`,
  `backlinks`, and the writes) names notes. The server does not log them
  today. Agents that read files directly (no MCP) leave only what git sees.
- **Shape.** The server appends each call to a log in the record's folder
  (session, time, tool, the notes named, the query); `rdstudio serve`
  streams it (it already streams the tutor over server-sent events); the
  Atlas draws a session as a path, the way it draws a study path or a tour:
  numbered steps, read and written told apart, searches as a fan to their
  hits. Live while the agent works, and replayable after.
- **To decide.** Whose sessions are shown (every agent on the machine, or
  one chosen); whether the log is private like the learner record; how long
  it is kept; and whether a session without the MCP server should be
  reconstructed from git.

## An agent in the editor

- **What exists.** The tutor (`packages/cli/src/tutor.ts`) already takes a
  highlighted passage and a question (its "discuss" turn), answers with pins
  on the text, streams, and logs cost. The editor already has a selection
  and a toolbar. The code index ([T66](/tasks/T66-code-map.md)) can find
  code by name, and which notes a file is attached to.
- **Shape.** Two actions on a selection or the caret: **Ask** (an answer in
  the margin, pinned to the passage, nothing changed) and **Fill** (a
  proposed insertion or replacement shown as a suggestion to accept, edit or
  reject, never written unasked). The agent is given the note, the
  selection, the notes it links to, and search over the base and the code.
- **To decide.** Which model account pays (the tutor's OpenRouter account,
  or a local agent through MCP); how a suggestion is marked in the note's
  `generated` field and trust, since OKF records who wrote what; and whether
  Fill may add links and files, or text only.

# Where each stands

- **An agent in the editor** is built ([T74](/tasks/T74-agent-in-editor.md),
  [design](/design/assist.md)), 2026-10-07. The three things to decide were
  decided by the developer: the tutor's OpenRouter account pays; the note's
  stamp names the model; and proposed text is a suggestion in the note, which
  may hold links and code.
- **The agent's path** is not started.
