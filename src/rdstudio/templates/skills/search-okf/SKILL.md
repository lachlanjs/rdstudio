---
name: search-okf
description: Look something up in the project knowledge base (OKF) before re-deriving it. Use when a question may already be answered, a decision may already be recorded, or you need project context.
---

# Search the knowledge base

The knowledge base in `{knowledge}/` records what this project has already
settled: design, decisions, answered questions, procedures, references and
findings. Check it before re-deriving anything or reopening a settled question.

## Steps

1. The rdstudio `search` tool with a few specific keywords. Filter with `type`
   (e.g. `Decision`, `Question`, `Procedure`), `tags` or `under` (a directory)
   when you know them.
2. For promising hits, the rdstudio `outline` tool to see the headings.
3. The rdstudio `read` tool with `section_heading` to read only the part you need.
   Read a whole concept only when it is short or all of it is relevant.
4. Follow `links_to` / `linked_from` from the outline when the answer spans
   concepts.

For lookups that need several searches, delegate to the **librarian** subagent
so the intermediate results stay out of your context; it returns a short answer
with concept ids.

## Reporting what you found

- Cite concept ids (e.g. `decisions/activation-function`) so the developer can
  open them in the dashboard.
- Say how much to trust each source: `human-reviewed`, `machine-confirmed` or
  `unverified`, and whether it has changed since review.
- If a recorded decision applies, follow it. If you believe its stated
  assumption no longer holds, say so explicitly instead of silently diverging.
- If nothing is recorded, say so. If the answer you then work out is worth
  keeping, record it with the `record-okf` skill.
