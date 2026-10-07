---
type: Decision
title: "Reports are HTML outside the bundle"
description: "Agent-to-developer reports are self-contained HTML in reports/, linking one-way into knowledge."
tags: [decision]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T00:50:54Z}
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

# Revised

On 2026-10-07 the developer replaced reports with artifacts, which live in
the knowledge folders and are cited from notes:
[artifacts replace reports](/decisions/artifacts.md). The spec was checked
then and does not forbid other files in a bundle, so the assumption above
was stricter than it needed to be. This decision stands only until that one
is built.
