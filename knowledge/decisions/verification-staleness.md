---
type: Decision
title: "Verification goes stale only on significant edits"
description: "Significant edits bump generated.at; human verification older than that is stale."
tags: [decision]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Decision

Agents declare each edit as minor or significant. Significant edits update
`generated`; minor edits do not. A human verification older than
`generated.at` is shown as stale in the Review tab, never removed.

# Assumption

Dictated or trivial edits should not cost the developer a re-review; OKF defines
`generated.at` as the last meaningful change, so this is native OKF.

# Reopen if

Agents misjudge significance often enough to hide real changes (then: a
classifier or a stricter rule).
