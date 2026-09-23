---
type: Task
title: T14 — Pluggable classifier interface
description: Interface for edit-significance and step localisation with deterministic default.
tags: [task, m4, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:32:21Z
---

# Prompt

Define a small classifier protocol used by `record` (significance) and `procedure_next` (localisation). Default rules-based; stub backend for Jev-style models behind an optional extra. See [decision](/decisions/classifier-optional.md).

# Acceptance

- Default works offline; backend selectable in config.

# Outcome

`rdstudio.classify`: `RulesClassifier` (token-diff significance; inflection-tolerant step matching) and `CommandClassifier` (JSON over stdin/stdout to any program; falls back to rules below `min_confidence` or on failure). `record` decides significance when `significant` is omitted and reports `decided_by`; `procedure_next` matches loosely described steps and reports `matched_by`. A Jev adapter would be a small script speaking this protocol once API access exists.
