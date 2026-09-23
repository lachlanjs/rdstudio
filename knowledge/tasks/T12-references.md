---
type: Task
title: T12 — papis and Zotero references
description: 'Optional papis backend: reference stubs, MCP reference tools, /ingest-ref.'
tags: [task, m4, done]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-09-23T05:32:21Z
---

# Prompt

Optional `[references] backend = "papis"`. `rdstudio refs sync` creates `type: Reference` stubs for papis entries (never overwriting bodies). MCP `ref_search`, `ref_get`, `ref_text` (cached PDF text by page or section). `/ingest-ref` skill and procedure. Explore Zotero annotations import.

# Acceptance

- Works against a scratch papis library in tests.

# Outcome

`[references] backend = "papis"`. `rdstudio refs sync` creates Reference stubs (citation as description, DOI as resource, `papis.ref`, `generated.by: process:rdstudio-refs`) and never touches existing concepts. MCP `ref_search` and `ref_text` (pages or best-matching pages, via cached pdftotext). `/ingest-ref` skill defers to a project procedure when one exists. Checked read-only against the real `~/papis/thesis` library. Zotero annotation import is written up as an [idea](/ideas/zotero-annotations.md), not implemented (needs API credentials to test).
