---
name: promote
description: Move knowledge that is not specific to this project into the developer's global knowledge base. Use when a finding, procedure or practice would help in other projects, or when the developer asks to keep something globally.
---

# Promote to the global knowledge base

The developer keeps a private, cross-project knowledge base (search it with
`scope: "global"`). Project and global knowledge never link to each other, so
a promoted concept must make sense on its own.

1. **Propose, don't act.** Name the concept and say why it is general. Promote
   only after the developer agrees.
2. **Make it self-contained.** If it links to project concepts, either inline
   the essential facts or accept that those links will not resolve in the
   global base.
3. **Promote:** `mcp__rdstudio__promote` with the concept id. Use `keep: true`
   to copy rather than move when the project still needs its own copy (the tool
   refuses to move a concept other project concepts link to).
4. Report the new global id to the developer.

Material that is general from the start (tooling habits, reading notes outside
this project) can be recorded straight into the global base with
`mcp__rdstudio__record` and `scope: "global"`, again only when the developer
asked for it.
