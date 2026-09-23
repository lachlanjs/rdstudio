---
name: handoff
description: Close out a working session so the next session (human or agent) can pick up without re-deriving anything. Use at the end of a session or before a long break.
---

# Hand off

1. **Decisions** made this session: record each with `/decision`.
2. **Questions** raised and not answered: record with `/question`. Mark any
   answered ones.
3. **Tasks**: update the `# Outcome` and state tag of every task touched.
4. **Findings and procedures**: record anything learned the hard way with
   `/record-okf`. If a repeated process emerged, record or update a
   `type: Procedure` concept.
5. **Report**: if substantial work was done, write one with `/report`.
6. Summarise to the developer in chat: what was recorded (concept ids), what is
   waiting for their review (`mcp__rdstudio__review_queue`), and the suggested
   next step.
