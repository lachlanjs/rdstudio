---
type: Idea
title: Zotero annotations into reference concepts
description: Pull highlights and notes made in Zotero into each Reference concept, so reading work becomes searchable knowledge.
tags: [references, zotero, papis, future]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T08:30:00Z
---

# Current setup (ramplib)

- papis is the source of truth for the bibliography (`~/papis/thesis`, 79
  entries, 31 with PDFs); `make refs` exports `references.bib`.
- Zotero is the capture tool on the phone. `make zotero-sync` pulls the whole
  Zotero library as BibTeX through the web API and imports new items into papis
  (duplicates matched on DOI, ISBN or URL).

# What rdstudio adds now

- `rdstudio refs sync`: a `type: Reference` concept per papis entry, never
  overwriting notes.
- MCP `ref_search` and `ref_text`: an agent can find a paper and read two
  relevant pages instead of the whole PDF.
- `/ingest-ref`, which defers to a project procedure when one exists (see the
  bibliography procedure in himode once recorded).

# The idea

Reading on the phone produces highlights and comments in Zotero, which never
reach papis or the thesis. The Zotero web API exposes annotations as child
items (`itemType: annotation`, with `annotationText`, `annotationComment`,
`annotationPageLabel`) of the PDF attachment, and the attachment is a child of
the parent item, which carries the DOI.

A `rdstudio refs annotations` command could:

1. Fetch items modified since the last run (`since=<library version>`), using
   the same credentials file as `make zotero-sync`.
2. Match each parent item to a papis entry by DOI (then ISBN, then URL).
3. Write the highlights into the Reference concept under `# Highlights`, one
   bullet per annotation with its page label and comment, replacing only that
   section on each run so repeated runs stay idempotent.

The highlights then become searchable with the rest of the knowledge base, and
the agent can quote them in reports with page references.

# Open points

- Needs a Zotero API key; untested here, so not implemented yet.
- Annotation sync requires the PDFs to be stored in Zotero, which is bounded by
  Zotero's free storage quota (300 MB). Highlights made on a PDF that only lives
  in papis would not be seen.
- Direction is one way (Zotero to knowledge). Writing back is out of scope.
