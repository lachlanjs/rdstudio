<!-- rdstudio:start (managed by rdstudio init; edits between these markers are replaced) -->
## Project knowledge (rdstudio)

This project keeps a knowledge base in `{knowledge}/`, in Open Knowledge Format
(markdown + YAML frontmatter). It records design, decisions, questions, tasks,
procedures, references and findings, authored jointly by the developer and
agents. A read-only dashboard shows it: `rdstudio serve`.

- **Look before re-deriving.** Search the knowledge base (`/search-okf`, or the
  `librarian` subagent) before reopening a question or redesigning something.
  Recorded decisions stand unless their stated assumption is shown false.
- **Record as you go.** Decisions (`/decision`), questions (`/question`),
  findings and procedures (`/record-okf`), tasks (`/task`). Write through the
  `rdstudio` MCP tools so provenance is stamped. Do not edit `index.md` files.
- **Report substantial work** as HTML in `{reports}/` (`/report`).
- **Close sessions** with `/handoff`.
- **Trust:** only the developer verifies concepts. Mark edits
  `significant: false` only when trivial or dictated.
- Your actor id for provenance is `{agent}`; the developer is `{human}`.
<!-- rdstudio:end -->
