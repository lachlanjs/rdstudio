---
type: Decision
title: The tool aims at two overlapping targets and several platforms, and is not narrowed to one
description: rdstudio serves both developers working with agents and people learning, on several
  platforms for different purposes; breadth is intended and is not a reason to cut features.
tags: [scope, learning, project-mode, platforms]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T05:01:27Z}
---

# Decision

The developer, 2026-10-08, declining the agent's suggestion to "decide what
the tool is not" ([T103](/tasks/T103-prune-scope.md), dropped):

"This tool is aiming at multiple targets. One is the developer workflow and
enhancing/supporting developer understanding in agentic workflows, the other
is education and learning, and they overlap - so it is quite complicated
from that perspective. Multiple platforms are targeted for different
purposes also."

So:

- **Two targets.** The developer's workflow with agents, and a person's
  understanding within it; and education and learning. They overlap.
- **Several platforms**, each for its own purpose. The unbuilt platform
  tasks (desktop, mobile, sync and the like) stay on the list.
- **Breadth is not a fault to be fixed.** Pages and features for learning
  (streaks, tours, goals, practice) are not to be removed because a
  developer's workflow does not use them, nor the reverse.

# What this does not rule out

The agent's reading, not the developer's words. Removing a second
implementation of the same thing
([the Python one](/tasks/T102-retire-python.md)) or tidying
([T104](/tasks/T104-tidy-board-server-root.md)) cuts no feature and was
approved in the same message.

# Related

- [Project mode's scope](/decisions/project-mode-scope.md)
- [Is the mode the project's, or the viewer's?](/questions/mode-per-project-or-viewer.md)
