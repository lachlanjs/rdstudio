---
type: Task
title: "T14 — Pluggable classifier interface"
description: "Interface for edit-significance and step localisation with deterministic default."
tags: [task, m4, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Prompt

Define a small classifier protocol used by `record` (significance) and `procedure_next` (localisation). Default rules-based; stub backend for Jev-style models behind an optional extra. See [decision](/decisions/classifier-optional.md).

# Acceptance

- Default works offline; backend selectable in config.

# Outcome

Not started.
