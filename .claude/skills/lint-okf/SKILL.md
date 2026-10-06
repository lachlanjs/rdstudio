---
name: lint-okf
description: Check the knowledge base for OKF format errors and broken links, and fix what can be fixed. Use after bulk edits or when the dashboard's Review tab shows format errors.
---

# Lint the knowledge base

1. Run `rdstudio check -w`.
2. Fix **errors** (missing frontmatter, missing `type`, frontmatter in a
   non-root `index.md`) with the rdstudio `record` tool or by editing the file.
3. **Broken links** point at knowledge that does not exist yet. Do not delete
   them by reflex: list them for the developer as candidate concepts, and fix
   only the ones that are typos or moved files.
4. Run `rdstudio index` if indexes are out of date (the MCP server and the
   dashboard server regenerate them automatically).
