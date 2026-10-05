---
type: Roadmap
title: Roadmap
description: Milestones and task checklist for building rdstudio; the progress tracker.
tags: [roadmap]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

Each task's state is also carried in its `tags` (`todo`, `active`, `done`).

# M1 — Core

- [x] [T01 Package skeleton and configuration](/tasks/T01-package-skeleton.md)
- [x] [T02 OKF library](/tasks/T02-okf-library.md)
- [x] [T03 Deterministic search and sectioned reading](/tasks/T03-search.md)

# M2 — Dashboard

- [x] [T04 Build pipeline and server](/tasks/T04-build-serve.md)
- [x] [T05 Dashboard shell and Knowledge list](/tasks/T05-dashboard-knowledge.md)
- [x] [T06 Knowledge graph view](/tasks/T06-graph-view.md)
- [x] [T07 Changes and Review tabs](/tasks/T07-changes-review.md)

# M3 — Agent integration

- [x] [T08 MCP server](/tasks/T08-mcp-server.md)
- [x] [T09 Scaffolding, skills and agents](/tasks/T09-scaffold-skills.md)

# M4 — Rich features

- [x] [T10 Reports](/tasks/T10-reports.md)
- [x] [T11 Procedural graphs](/tasks/T11-procedures.md)
- [x] [T12 papis and Zotero references](/tasks/T12-references.md)
- [x] [T13 Global bundle and promote](/tasks/T13-global-bundle.md)
- [x] [T14 Pluggable classifier interface](/tasks/T14-classifier.md)

# M5 — Ship

- [x] [T15 Static export and visual QA](/tasks/T15-export-qa.md)
- [ ] [T16 Instantiate in himode and test drive](/tasks/T16-himode-test-drive.md)

# M6 — Refinements

- [x] [T17 Graph dragging, graph options, themes and CI publishing](/tasks/T17-settings-themes-ci.md)
- [x] [T18 Mermaid diagrams in concepts and reports](/tasks/T18-mermaid.md)
- [x] [T19 AGENTS.md and OpenCode support](/tasks/T19-harnesses.md)

# M7 — Understanding layer

- [ ] [T20 Map view](/tasks/T20-map-view.md)
- [x] [T21 Link ratings, implied-link culling and link filters](/tasks/T21-link-ratings.md)
- [x] [T22 Five themes, direction colours and a clearer range slider](/tasks/T22-themes-and-direction.md)

# M8 — Understanding layer: learning features

See the [understanding layer design](/design/understanding-layer.md).

- [x] [T23 Learner record and landmarks](/tasks/T23-learner-record.md)
- [x] [T24 Study paths and reading order](/tasks/T24-study-paths.md)
- [x] [T25 Tours](/tasks/T25-tours.md)
- [x] [T26 Interactive exercises](/tasks/T26-exercises.md)
- [x] [T27 Coverage and review](/tasks/T27-coverage-review.md)
- [x] [T28 Explain-back and AI marking](/tasks/T28-explain-back.md)
- [x] [T29 Catching up on change](/tasks/T29-catch-up.md)
- T30 Editing in the app: moved to M9

# M9 — Performance and platform (current priority)

See [platform, performance and deployment](/design/platform.md). M8 resumes after phase 0 or 1.

- [x] [T31 Benchmarks and learner event ids](/tasks/T31-benchmarks-and-event-ids.md)
- [x] [T32 Offline app shell](/tasks/T32-offline-shell.md)
- [x] [T33 Map layout and routing in a Web Worker](/tasks/T33-map-worker.md)
- [x] [T34 Conformance fixtures](/tasks/T34-conformance-fixtures.md)
- [x] [T35 TypeScript core: OKF parsing and lint](/tasks/T35-core-okf.md)
- [x] [T36 TypeScript core: graph, search and learner record](/tasks/T36-core-graph-search-record.md)
- [x] [T37 Node command line, MCP server and rdstudio serve](/tasks/T37-node-cli-mcp-serve.md)
- [x] [T38 Svelte UI with a build step](/tasks/T38-svelte-ui.md)
- [x] [T30 Editing in the app: create, edit, move and delete notes](/tasks/T30-dashboard-editing.md)
- [ ] [T39 GPU map renderer](/tasks/T39-gpu-map.md)
- [ ] [T40 Tauri desktop app](/tasks/T40-tauri-desktop.md)
- [ ] [T41 Local-first sync](/tasks/T41-local-first-sync.md)
- [ ] [T42 Mobile apps](/tasks/T42-mobile-apps.md)

# M10 — Teacher

See the [teacher design](/design/teacher.md). The trial comes before mounts,
as it runs in a repository of its own.

- [x] [T43 Teacher foundation](/tasks/T43-teacher-foundation.md)
- [x] [T44 Goals and exercises](/tasks/T44-goals-and-exercises.md)
- [x] [T45 Profile, sources and the default skills](/tasks/T45-profile-and-skills.md)
- [ ] [T46 Trial: dynamical mean-field theory](/tasks/T46-dmft-trial.md)
- [ ] [T47 Mounting a shared knowledge base](/tasks/T47-mounts.md)

# M11 — Tutor and streaks

See [work together](/design/tutor.md) and [streaks](/design/streaks.md).

- [x] [T48 Streaks](/tasks/T48-streaks.md)
- [x] [T49 Drafts and history](/tasks/T49-drafts-and-history.md)
- [x] [T50 The server-side teacher](/tasks/T50-teacher-service.md)
- [x] [T51 Work together](/tasks/T51-work-together.md)

# M12 — Redesign

See the [redesign](/design/redesign.md) and the brand book in
`design/project/README.md`.

- [x] [T52 One theme: tokens and fonts](/tasks/T52-theme-tokens.md)
- [x] [T53 The shell: spaces, palette and You](/tasks/T53-shell.md)
- [x] [T54 Today](/tasks/T54-today.md)
- [x] [T55 The workbench](/tasks/T55-workbench.md)
- [x] [T56 Library](/tasks/T56-library.md)
- [x] [T57 The Atlas](/tasks/T57-atlas.md)
- [x] [T58 Phone layouts](/tasks/T58-phone.md)
- [x] [T59 Project mode](/tasks/T59-project-mode.md)
- [x] [T60 The Atlas: contour folders and downhill routes](/tasks/T60-atlas-contours.md)

# M13 — Station, the grid Atlas, and a codebase to tell the modes apart

The second round from Claude Design (`design/project/README.md`: Station
terminal, "Atlas · calmer", "The grid Atlas", "Layout and routes searched
together"), then a codebase test bed so project mode has a real project to
show.

- [x] [T61 The Station theme](/tasks/T61-station-theme.md)
- [ ] [T62 A calmer Atlas](/tasks/T62-calmer-atlas.md)
- [ ] [T63 The grid Atlas](/tasks/T63-grid-atlas.md)
- [ ] [T64 A codebase test bed: a nanobind simulation](/tasks/T64-codebase-testbed.md)

# Future

- [Per-agent model and harness settings](/ideas/future-agent-settings.md)
- [Distribution, funding and naming](/ideas/distribution-and-naming.md)
- [Testing on real phones](/ideas/device-testing.md)
- Understanding layer (proposed; see the [manifesto](/ideas/manifesto/motivation.md)):
  [where it lives](/ideas/learning/tool-boundary.md),
  [PID feature map](/ideas/learning/pid-feature-map.md),
  [professional mode](/ideas/learning/professional-mode.md),
  [nested links](/ideas/learning/nested-links.md),
  [learner record](/ideas/learning/learner-record.md),
  [tours and exercises](/ideas/learning/tours-and-exercises.md),
  [dashboard editing](/ideas/learning/dashboard-editing.md),
  [discovery states and hiding what is undiscovered](/ideas/learning/discovery.md),
  [alpha trials](/ideas/learning/alpha-trials.md),
  [a two-person trial building an agentic game design engine](/ideas/learning/game-design-trial.md),
  [autoethnography](/ideas/learning/autoethnography.md)
