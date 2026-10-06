---
type: Decision
status: draft
title: Project mode is for the knowledge base and agents' workflows, not a map of the code
description: Project mode's features stay with managing the OKF base and working with agents; the
  code map is kept as an option on the Atlas, not its default or its direction.
tags: [project-mode, atlas, code]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-06T22:34:26Z}
---

# Decision

Draft: recorded by the agent from what the developer said on 2026-10-07; the
wording was tentative ("perhaps it is best"), so it is theirs to confirm.

"I think the idea of visualising a codebase in the Atlas is somewhat shaky.
Originally this was meant to be for managing OKF and Agent workflows - so
perhaps it is best to stick to that for the Project features."

What follows from it, and was done ([T71](/tasks/T71-atlas-flat-and-room.md)):

- The Atlas maps the knowledge base by default in project mode too.
- The code map ([design](/design/code-map.md), [T66](/tasks/T66-code-map.md))
  stays: Map: Code in the Atlas's panel, the code pages, and notes attached
  to code. It is not removed.
- New project-mode features are about the base and agents: see
  [the agent's path, and an agent in the editor](/ideas/project-agent-features.md).

Later the same day, after the margins and route clearance were widened: "the
code view does look a bit neater now with the fixes to the margins." That
softens the judgement of how it looks; it does not change the direction.

# Assumption

What a person running a project needs from rdstudio is to manage what is
written about it and what agents do with that, and a drawing of the code
itself adds little to this. The evidence so far is the developer's own
reaction to the code map on one generated test bed
([nanosim](/tasks/T69-codebase-testbed.md)); it has not been tried on a real
codebase.

# Alternatives considered

- **The code map as project mode's default Atlas** (what
  [T66](/tasks/T66-code-map.md) built): judged shaky.
- **Removing the code map:** not asked for; it costs little to keep as an
  option.

# Reopen if

- The code map, tried on a real codebase, turns out to be what people open
  first.
- An agent's work is shown to go better with the code's structure in the
  base ([measuring the map](/ideas/measuring-the-map.md)), which would make
  the index worth more than its drawing.
