---
type: Task
title: T09 — Scaffolding, skills and agents
description: rdstudio init plus the skill and agent set.
tags: [task, m3, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:21:52Z
---

# Prompt

`rdstudio init` writes the bundle skeleton with placeholders and a BOOTSTRAP concept directing an agent to tailor it, `reports/`, `rdstudio.toml`, `.mcp.json`, `.gitignore` entries, a CLAUDE.md section, skills (`/search-okf`, `/record-okf`, `/report`, `/decision`, `/question`, `/task`, `/handoff`, `/lint-okf`, `/promote`) and agents (Librarian, Critic, Searcher). Idempotent; never overwrites edited files.

# Acceptance

- Running init twice changes nothing.
- A fresh Claude Code session in an initialised repo can find and use the skills.

# Outcome

`rdstudio init` writes `rdstudio.toml`, knowledge placeholders (overview and a bootstrap task telling an agent to tailor the bundle with the developer), `reports/`, eight skills (search-okf, record-okf, report with an HTML template, decision, question, task, handoff, lint-okf), three agents (librarian, critic, searcher), merges `.mcp.json` and `.claude/settings.json` (enables the server, allows its tools, adds a SessionStart hook running `rdstudio brief`), maintains a marked section in CLAUDE.md (and AGENTS.md if present), and ignores `.rdstudio/`. Idempotent; `--force` refreshes managed skills and agents only. `/promote` and `/ingest-ref` arrive with T13 and T12.
