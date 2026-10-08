---
type: Task
title: "T103 — Decide what the tool is not: unbuilt platforms, little-used pages, older views"
description: Go through the unbuilt platform tasks, the app's pages and the older map views with the
  developer, and drop or remove what does not serve the tool's purpose.
tags: [task, m16, reduction, scope, dropped]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T05:01:29Z}
---

# Prompt

The developer, 2026-10-08, asked what would improve the project, naming
"making the tool leaner (refinement, reduction), cleaner organisation, or
adding new impactful features".

This task is the agent's suggestion in reply, not the developer's words.
The agent's view: the project's main weakness is breadth, not missing
features. The choices here are the developer's.

# What to go through

- **Unbuilt platform tasks still marked todo:**
  [Tauri desktop app](/tasks/T40-tauri-desktop.md),
  [mobile apps](/tasks/T42-mobile-apps.md),
  [local-first sync](/tasks/T41-local-first-sync.md),
  [GPU map renderer](/tasks/T39-gpu-map.md),
  [mounts](/tasks/T47-mounts.md). Each either stays with a reason or is
  marked dropped.
- **Pages.** The app has about 25 routes, among them streaks, tours, goals,
  practice and skills. For each: has the developer used it in the last
  month, and does it serve the purpose?
- **Older views.** `app/src/lib/views/graph.js` still has its own route
  beside the grid Atlas. `map.js` and `layout.js` are imported only by
  `gridmap.js`, the layout worker and a test.

# The purpose to judge against

The developer, 2026-10-08: "The point of the tool is to use AI in a way
which is commensurate with human understanding. The tools supports you to
stay at pace with rapid AI development. It is trying to mature vibe-coding
into something more rigorous… better tools are needed to deal with the
bottleneck between the project and the human brain".

# Plan

(Filled in by the agent before implementation.)

# Acceptance

- Each platform task above is either marked dropped or has a stated reason
  to stay.
- A decision note lists the pages kept and the pages removed, with the
  reason for each.
- Removed pages and views are gone from the code, their tests and the
  walkthroughs.

# Outcome

Dropped by the developer, 2026-10-08, when approving the rest of M16: the
tool aims at two overlapping targets and several platforms on purpose. See
[the decision](/decisions/two-targets-many-platforms.md). Nothing was
removed.
