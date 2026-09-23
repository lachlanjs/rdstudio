---
type: Decision
title: "Reports are HTML outside the bundle"
description: "Agent-to-developer reports are self-contained HTML in reports/, linking one-way into knowledge."
tags: [decision]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Decision

Reports are HTML in `reports/`, using vendored libraries (KaTeX, Vega-Lite)
served by the dashboard. They are not OKF concepts, not listed in the Knowledge
tab, may link into knowledge (never the reverse), and optionally appear in the
graph as rounded squares.

# Assumption

Reports need media and charts beyond markdown; keeping them out of the bundle
keeps the bundle conformant.

# Reopen if

OKF gains a convention for rich non-markdown documents.
