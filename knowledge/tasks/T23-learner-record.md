---
type: Task
title: T23 — Learner record and landmarks
description: A private, append-only record of learning events per project, written by the dashboard, the
  CLI and later agents; landmarks from frontmatter.
tags: [task, m8, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-26T09:26:56Z
---

# Prompt

The groundwork for everything in the [understanding layer](/design/understanding-layer.md)
that measures: where the record lives, its format, how the dashboard writes to
it safely, and a first event (a note was opened).

# Outcome

- `learner.py`: the record lives in `~/.local/share/rdstudio/learners/<project>/record.jsonl` (or under `[learner] path`), keyed by the repository's root commit; events are only appended, stamped with the time by the writer, and checked (`event` name required, `kind` one of autodidactic, interactive, ai). Off until `[learner] enabled = true` in the user config.
- The server answers `GET /api/learner` (state, a per-run token, events) and `POST /api/learner` (append), refusing other origins, missing or wrong tokens, non-JSON bodies, and non-localhost host names when bound to localhost.
- The build gives every note a content `hash`, so events say which version they were about. The dashboard records `seen` when a note is opened (once per version per half hour); nothing displays it yet, since opening a note is not evidence of understanding.
- `rdstudio learner` shows whether the record is on and where it is; `rdstudio learner log` lists recent events.
- Landmarks: `landmark: true` in frontmatter already rings a note on the map; structural suggestions wait for the landmarks exercise in [T26](/tasks/T26-exercises.md).
