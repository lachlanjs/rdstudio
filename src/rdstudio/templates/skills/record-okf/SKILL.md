---
name: record-okf
description: Record knowledge in the project knowledge base (OKF) — findings, designs, references, procedures, research notes. Use whenever something worth remembering was learned or settled.
---

# Record knowledge

Write to the knowledge base through the rdstudio `record` tool, which stamps
provenance and regenerates indexes. Do not hand-edit `index.md` files; they are
generated.

## Before writing

1. Search first (the `search-okf` skill). Update an existing concept rather than creating
   a near-duplicate.
2. Pick the directory that fits; list the root with
   the rdstudio `list_concepts` tool if unsure. Create a new directory only when no
   existing one fits, and mention it to the developer.

## A good concept

- **One idea per concept.** Split long material into linked concepts.
- **Frontmatter:** `type` (required; e.g. `Design`, `Decision`, `Question`,
  `Task`, `Procedure`, `Reference`, `Research`, `Experiment`), `title`, and a
  one-sentence `description` (it appears in indexes and search results). Add
  `tags` sparingly.
- **Links** use bundle-absolute paths: `[model](/design/model.md)`. Linking to a
  concept that does not exist yet is fine; it marks knowledge worth writing.
- **Sources:** list external material under `sources` with a stable `id`, and
  attribute claims with footnotes keyed by that id: `...text.[^tao-vu]`.
- Prefer structure (headings, lists, tables) over long prose. Maths in `$...$`
  and `$$...$$` renders in the dashboard.
- **Diagrams** go in ` ```mermaid ` fences (flowchart, sequenceDiagram,
  stateDiagram-v2, classDiagram, erDiagram, timeline, mindmap). The text is the
  source of truth: anyone can read and edit it, and the dashboard draws it
  offline. Keep each diagram small and focused; split rather than sprawl. If
  the developer sketches something (a photo or screenshot), transcribe it into
  Mermaid rather than storing only the image.

## Significance

A significant edit updates `generated` and, if a human had reviewed the
concept, flags it as changed since review. Set `significant: false` for trivial
edits (typos, formatting) or content the developer dictated verbatim, `true` for
anything that changes meaning, or leave it out to let rdstudio judge from the
size of the change. Never add `verified` entries yourself; only the developer verifies
(`rdstudio verify <id>`).

## Updating part of a concept

Use `section_heading` with `body` to replace one section, or `append` to add to
the end, instead of resending the whole body.
