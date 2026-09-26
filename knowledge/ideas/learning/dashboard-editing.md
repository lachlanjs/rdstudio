---
type: Idea
title: Editing from the dashboard
description: What it takes to let the dashboard write, which the manifesto's malleable map needs; moderate work and no new dependencies.
tags: [learning, dashboard, architecture, proposal]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T03:11:24Z }
---

# Summary

A malleable map needs the dashboard to write, which supersedes the read-only
dashboard of the original design once decided. The editor is where much of the
client-side quality lives.

- **Server:** endpoints in the standard-library server calling the existing
  `store.record` and `verify`, the same path the MCP tools use, so attribution
  and significance handling are shared. Roughly 150 lines. The watcher already
  rebuilds after writes.
- **Client:** a text area and a frontmatter form first; a vendored editor
  (CodeMirror, about 400 KB) later if needed.
- **Static export** stays read-only.

# Work that matters

- **Security:** a per-run token and an Origin check, since any page in the
  browser could otherwise post to the local server; tailnet exposure becomes a
  conscious choice.
- **Conflicts:** each edit carries the version it started from and is refused
  if the file changed.
- **Editing is not verifying:** edits are attributed to the human; verification
  stays a separate act.
- **Move and rename with link rewriting,** the most important map-reshaping
  operation, does not exist yet.
