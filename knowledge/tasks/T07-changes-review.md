---
type: Task
title: T07 — Changes and Review tabs
description: Commit-by-commit changes by category; review queue of unverified, stale and open items.
tags: [task, m2, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:16:10Z
---

# Prompt

Changes: commits newest first, each with its files grouped as knowledge / code / reports / other; no diffs. Review: unverified concepts, stale verifications (significant edit after human verification), open questions, draft concepts, broken links.

# Acceptance

- Categories configurable in `rdstudio.toml`.
- Review counts shown on the tab.

# Outcome

Changes: commits newest first with files grouped by category (knowledge, code, reports, agent setup, other), category toggles, links from files to concepts and reports. Review: changed-since-review, open questions, unverified, drafts, past `stale_after`, format errors, links to unwritten knowledge; count on the tab.
