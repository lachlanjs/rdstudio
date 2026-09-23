<!-- rdstudio:start (managed by rdstudio init; edits between these markers are replaced) -->
## Project knowledge (rdstudio)

This project keeps a knowledge base in `{knowledge}/`, in Open Knowledge Format
(markdown + YAML frontmatter). It records design, decisions, questions, tasks,
procedures, references and findings, authored jointly by the developer and
agents. A read-only dashboard shows it: `rdstudio serve`.

The `rdstudio` MCP server gives access to it, and the skills named below
(`search-okf`, `record-okf`, ...) describe how to use it; in Claude Code they
are also slash commands.

- **Start oriented.** If this session did not open with a knowledge-base brief,
  call the rdstudio `brief` tool first.
- **Look before re-deriving.** Search the knowledge base (the `search-okf`
  skill, or the `librarian` subagent) before reopening a question or
  redesigning something. Recorded decisions stand unless their stated
  assumption is shown false.
- **Record as you go.** Decisions (`decision`), questions (`question`),
  findings and procedures (`record-okf`), tasks (`task`). Write through the
  rdstudio MCP tools so provenance is stamped. Do not edit `index.md` files.
- **Report substantial work** as HTML in `{reports}/` (the `report` skill).
- **Close sessions** with the `handoff` skill.
- **Global knowledge:** if the developer has a cross-project knowledge base,
  search it with `scope: "global"` (or `"all"`); suggest the `promote` skill
  for knowledge that is not specific to this project.
- **Trust:** only the developer verifies concepts. Mark edits
  `significant: false` only when trivial or dictated.
- The developer's actor id for provenance is `{human}`; the rdstudio tools
  stamp yours.
<!-- rdstudio:end -->
