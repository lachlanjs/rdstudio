---
type: Task
title: T18 — Mermaid diagrams in concepts and reports
description: Render Mermaid diagrams offline in the dashboard and in reports, themed, with agent guidance.
tags: [task, m6, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T11:40:00Z
---

# Prompt

The developer wants diagrams they and the agent can both read and modify;
Mermaid should be a feature, working offline, and the question was whether it
belongs in the knowledge base as well as reports. Excalidraw is under
consideration separately.

# Outcome

- Both: ` ```mermaid ` fences in concepts, `<pre class="mermaid">` in reports.
  See [conventions](/design/conventions.md).
- Vendored Mermaid 12.0.0 ESM build (entry plus 104 chunks, 5.5 MB, no source
  maps). It is imported only when a page has a diagram and fetches only the
  chunks that diagram type needs.
- `web/js/diagrams.js` maps theme tokens to Mermaid's `base` theme variables,
  renders one diagram at a time (Mermaid's render is not re-entrant; a live
  refresh mid-render had raised an uncaught error), suppresses Mermaid's own
  error graphic and shows the parse error with the source instead.
- Code blocks no longer use font ligatures, so `-->` is shown as typed.
- `/record-okf` and `/report` skills and the report template describe diagrams.
- Checked in a browser: flowchart and state diagram in Notebook light and
  Terminal dark, in a concept and a report; rapid navigation raised no errors.
