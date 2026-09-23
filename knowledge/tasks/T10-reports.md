---
type: Task
title: T10 — Reports
description: HTML reports with vendored charting, Reports tab, graph integration and the /report skill.
tags: [task, m4, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:21:52Z
---

# Prompt

Reports tab lists `reports/*.html` by date with metadata from meta tags; viewer in a sandboxed iframe. Vendored Vega-Lite available to reports. Links into knowledge extracted for the graph. `/report` skill with a template. See [reports decision](/decisions/reports-html.md).

# Acceptance

- A sample report with a chart and maths renders offline.

# Outcome

Reports tab and viewer (iframe; knowledge links inside reports navigate the dashboard), report metadata from meta tags, report nodes and edges in the graph, `/report` skill and template. Vendored vega 6.4.0, vega-lite 6.4.3, vega-embed 7.2.0 and KaTeX auto-render; `report.js` renders `script.vega-lite` specs themed to the dashboard palette; `report.css` shares fonts and tokens via `style-tokens.css`. Checked offline in a browser.
