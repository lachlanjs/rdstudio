---
type: Task
title: "T09 — Scaffolding, skills and agents"
description: "rdstudio init plus the skill and agent set."
tags: [task, m3, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Prompt

`rdstudio init` writes the bundle skeleton with placeholders and a BOOTSTRAP concept directing an agent to tailor it, `reports/`, `rdstudio.toml`, `.mcp.json`, `.gitignore` entries, a CLAUDE.md section, skills (`/search-okf`, `/record-okf`, `/report`, `/decision`, `/question`, `/task`, `/handoff`, `/lint-okf`, `/promote`) and agents (Librarian, Critic, Searcher). Idempotent; never overwrites edited files.

# Acceptance

- Running init twice changes nothing.
- A fresh Claude Code session in an initialised repo can find and use the skills.

# Outcome

Not started.
