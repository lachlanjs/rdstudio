---
name: ingest-ref
description: Add a paper or book to the bibliography (papis) and the knowledge base. Use when the developer names a paper, DOI, arXiv id or ISBN to add, or after syncing items captured in Zotero.
---

# Ingest a reference

Requires `[references] backend = "papis"` in `rdstudio.toml`. If a procedure
concept for adding references exists (search `type: Procedure`), follow it
with `mcp__rdstudio__procedure_next` instead of these generic steps; it holds
this project's conventions and known pitfalls.

1. **Check it is not already there:** `mcp__rdstudio__ref_search`.
2. **Add it to papis:** `papis add --from doi <doi>` (or `--from isbn`,
   `--from arxiv`). Run non-interactively with `--batch` where the project's
   procedure says so.
3. **Fix the citekey** to the project's convention if papis generated a
   different one: `papis update --batch --set ref <key> <current-ref>`.
4. **Check the metadata:** authors split correctly into family and given names,
   year, venue. Fix `author_list`, not the flat `author` field.
5. **Create the knowledge stub:** `rdstudio refs sync`.
6. **Summarise, if asked:** read only the pages you need with
   `mcp__rdstudio__ref_text` (by page range or query), then fill the stub's
   `# Summary` and `# Relevance` sections with `/record-okf`. Link the
   decisions, questions or designs it bears on.
7. Regenerate any exported bibliography the project uses (for example
   `make refs`).

## Items captured in Zotero

If the project pulls phone captures from Zotero (for example `make zotero-sync`),
run that first; the imported items then go through steps 3 to 6.
