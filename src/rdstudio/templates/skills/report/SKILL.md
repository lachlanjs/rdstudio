---
name: report
description: Write an HTML report for the developer after substantial work — a task, an experiment, an investigation or a long session. Reports appear in the dashboard's Reports tab.
---

# Write a report

Reports are the agent's channel to the developer: richer than chat, kept
permanently, and browsable in the dashboard. They are HTML, not markdown, so
they can hold charts, maths, figures and tables.

## When

After completing a task, running an experiment, finishing an investigation, or
when the developer asks. One report per piece of work.

## Where and how

1. Copy `.claude/skills/report/template.html` to
   `{reports}/YYYY-MM-DD-<short-slug>.html`.
2. Fill in the `<meta name="rdstudio:...">` tags (title, date, author as your
   actor id, activity) and the description.
3. Write the body. Structure it for a reader who was not watching:
   - **Summary**: two to four sentences on what was done and the result.
   - **What changed**: files, concepts, decisions (link them).
   - **Results**: figures, tables, charts, with honest caveats.
   - **Deviations and issues**: anything that did not go to plan.
   - **For you to do**: what the developer should check, test or decide.
4. Link knowledge with `<a href="/{knowledge}/<id>.md">`. Those links open in the
   dashboard and draw the report into the graph. Reports link to knowledge, never
   the reverse.

## Rich content

The template loads the dashboard's bundled libraries (no internet needed):

- Maths: `\( ... \)` inline and `\[ ... \]` display, rendered by KaTeX.
- Charts: a Vega-Lite spec in `<script type="application/json" class="vega-lite">`
  is rendered in place. Inline data under `data.values`, or reference a CSV/JSON
  file saved next to the report.
- Diagrams: Mermaid source in `<pre class="mermaid">...</pre>` is drawn in
  place, in the dashboard's theme.
- Figures: save images next to the report (e.g. `{reports}/media/`) and use
  relative paths.

Keep reports factual. State what was measured, not what you hoped.
