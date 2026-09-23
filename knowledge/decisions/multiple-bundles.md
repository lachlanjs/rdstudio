---
type: Decision
title: "Support a global bundle alongside project bundles"
description: "A private ~/knowledge bundle holds cross-project knowledge; no links between bundles; promote moves concepts up."
tags: [decision]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Decision

The core handles several bundles. Project bundle first; a global bundle at
`~/knowledge` (private git repo) second. Bundles do not link to each other.
`/promote` moves a generalisable concept from project to global. Search defaults
to the project; static export never includes the global bundle. Skills and
procedures are scoped global or project.

# Assumption

Some knowledge (tooling, preferences, studies, the paper library) is not
project-specific and is re-explained in every project otherwise.

# Reopen if

Keeping the two in sync proves more costly than duplicating.
