---
type: Decision
title: "Optional structured classifier (Jev-style)"
description: "Small classification steps go through a pluggable interface, off by default, with deterministic fallback."
tags: [decision]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Decision

Classification points (edit significance, procedure-step localisation, search
re-ranking) call a pluggable classifier. Default: deterministic rules. Optional
backend: a structured-output model such as [Jev](/references/jev.md).

# Assumption

Such models are cloud-only and early-access today; the tool must work offline.

# Reopen if

A local or widely available model of this kind appears.
