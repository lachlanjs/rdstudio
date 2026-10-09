---
type: Roadmap
title: Roadmap
description: Milestones and task checklist for building rdstudio; the progress tracker.
tags: [roadmap]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T23:45:06Z}
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

# M13 — Station and the grid Atlas

On the branch `grid-dag-view`, built from the sketches added to the design
since M12 (`design/README.md`). Decisions:
[Station](/decisions/station-theme.md) and
[the grid Atlas](/decisions/grid-atlas.md). A layout built on the directed
acyclic graphs in each folder is T64. In working order:

- [ ] [T62 The grid Atlas: cells, routes and drawing](/tasks/T62-grid-atlas.md)
- [ ] [T64 The grid Atlas: a layout from the DAGs in each folder](/tasks/T64-dag-layout.md)
- [x] [T63 The grid Atlas: parity, the Station skin and retiring the old Atlas](/tasks/T63-grid-atlas-parity.md)
- [ ] [T61 The Station theme](/tasks/T61-station-theme.md)

Merged in from `main` on 2026-10-06, where a second line of M13 work had been
done on the continuous Atlas: a codebase test bed and the code map, which the
grid Atlas now draws (Map: Code in the panel), and two tasks the grid Atlas
supersedes. Their numbers clashed with the ones above, so three were renumbered.

- [x] [T69 A codebase test bed: a nanobind simulation](/tasks/T69-codebase-testbed.md) (was T64 on main)
- [x] [T66 The code map: an index of the code, and notes attached to it](/tasks/T66-code-map.md)
- [x] [T67 A calmer Atlas](/tasks/T67-calmer-atlas.md) (was T62 on main; superseded)
- [x] [T68 The searched grid Atlas](/tasks/T68-searched-grid-atlas.md) (was T63 on main; superseded)
- [ ] [T65 Bake the grid Atlas into the repository](/tasks/T65-atlas-bake.md) (dropped: the layered layout needs no baking)
- [x] [T71 The Atlas: a folderless view, room for routes, a panel that folds](/tasks/T71-atlas-flat-and-room.md)
- [x] [T72 The Atlas: feeders, where a trunk's links come from inside a folder](/tasks/T72-feeders.md)
- [ ] [T73 Bring the browser walkthroughs up to the grid Atlas](/tasks/T73-walkthroughs-grid-atlas.md)
- [x] [T74 An agent in the editor: ask about a passage, or have text proposed](/tasks/T74-agent-in-editor.md)
- [x] [T75 Switch a project between Learning and Project from the app](/tasks/T75-mode-switch.md)
- [x] [T76 Artifacts in the knowledge folders, and pictures](/tasks/T76-artifacts.md)
- [x] [T77 Artifacts on the Atlas](/tasks/T77-artifacts-atlas.md)
- [x] [T78 Make a figure from the editor](/tasks/T78-figure-from-editor.md)
- [x] [T79 Link controls in the editor](/tasks/T79-link-controls.md)
- [x] [T80 The agent is called Axis in the app](/tasks/T80-axis-name.md)
- [x] [T81 Axis in the editor is told how notes work here](/tasks/T81-assist-knows-the-format.md)
- [x] [T82 Rate several selected links at once](/tasks/T82-rate-many-links.md)
- [x] [T83 Model tiers for Axis in the editor](/tasks/T83-model-tiers.md)
- [x] [T84 Axis in the editor looks things up with tools](/tasks/T84-assist-lookup.md)

# M14 — Axis finds things

In the order agreed on 2026-10-07. Written up in
[M14: Axis finds things](m14-axis-finds-things.html).

- [x] [T85 Ask Atlas, first version](/tasks/T85-ask-atlas.md)
- [x] [T86 Axis reads the code index: outlines and symbols](/tasks/T86-code-index-tools.md)
- [x] [T87 Trial: a small embedding model through WebAssembly](/tasks/T87-embedding-runtime-trial.md)
- [x] [T88 A measure of retrieval: questions with known answers](/tasks/T88-retrieval-measure.md)
- [x] [T89 Search by meaning: the cache, the tool, and edits](/tasks/T89-find-similar.md)
- [x] [T90 Ask Atlas shows notes found by meaning](/tasks/T90-ask-atlas-by-meaning.md)

# M15 — The Axis panel

Ask Atlas made to flow on the screen, and Axis in the editor moved into the
same panel as a chat, on the branch `feat/axis-panel`. Decisions:
[questions are kept](/decisions/ask-atlas-keeps-questions.md);
[Axis changes a note only where it is let](/decisions/assist-changes-by-leave.md).

- [x] [T93 Ask Atlas in a docked Axis panel](/tasks/T93-axis-panel.md)
- [x] [T94 Ask Atlas keeps its questions and replays them](/tasks/T94-ask-history.md)
- [ ] [T95 Ask Atlas: follow-up questions](/tasks/T95-ask-follow-ups.md)
- [x] [T96 Axis beside the note being edited, and the details under its title](/tasks/T96-axis-beside-the-note.md)
- [x] [T97 Chats with Axis about a note: follow-ups, cost, kept and deleted](/tasks/T97-note-chats.md)
- [x] [T98 What Axis may change in a note: a marked passage, a place for new text, or anywhere](/tasks/T98-edits-by-leave.md)
- [x] [T99 Less friction setting up an organisation's gateway](/tasks/T99-gateway-setup-friction.md)

Released as 0.4.0 on 2026-10-08.

# M16 — Leaner, cleaner, and Axis writes

Written up, with M17, in
[M16 and M17: leaner, Axis writes, agents seen](m16-m17-leaner-and-agents.html).

Recorded 2026-10-08, when the developer asked what would improve the
project. T101 and T110 are the developer's own ideas; the rest are the
agent's suggestions, for the developer to take or leave. The order
suggested: the cuts first (T102, T103), then a rename if one is chosen,
then T100 and T101. A trial on a real project
([T16](/tasks/T16-himode-test-drive.md), [T46](/tasks/T46-dmft-trial.md))
was suggested alongside.

- [x] [T100 One agent loop for Axis](/tasks/T100-one-agent-loop.md)
- [x] [T101 Axis creates, changes and moves notes from Ask Atlas](/tasks/T101-axis-writes-notes.md)
- [x] [T102 Retire the Python implementation](/tasks/T102-retire-python.md)
- [ ] [T103 Decide what the tool is not: unbuilt platforms, little-used pages, older views](/tasks/T103-prune-scope.md) (dropped by the developer: [the decision](/decisions/two-targets-many-platforms.md))
- [x] [T104 Tidy: the task board, the server file, the repository root](/tasks/T104-tidy-board-server-root.md)
- [x] [T105 Find out why no note here is verified, and act on it](/tasks/T105-verification-in-use.md)
- [x] [T106 rdstudio provider init](/tasks/T106-provider-init.md)
- [x] [T110 Set how much goes to a model and how much may come back, in rdstudio itself](/tasks/T110-context-limits-settings.md)

# M17 — Terminal agents seen in the app

From the developer, 2026-10-08: a terminal agent's reading and editing of
the base shown live in the browser. The idea:
[the agent's path](/ideas/project-agent-features.md).

- [x] [T107 A terminal agent's path through the base, shown live in the browser](/tasks/T107-agent-path-live.md)
- [x] [T108 The agent's path: reads and edits made outside MCP](/tasks/T108-agent-path-file-hooks.md)
- [x] [T109 From the browser to the terminal agent](/tasks/T109-browser-to-agent.md)

# M18 — Proposals on the map, and opencode

From the developer, 2026-10-09, on seeing M16 and M17: the opencode plugin
left out of T108, and Axis's proposals shown on the map and not only as
cards. To begin on the developer's own machine, where opencode and the
differential geometry test bed are.

First, before any of these: run the five browser suites that could not run
where M16 and M17 were built (edit, compose, reshape, learn, teacher), and
try M16 and M17 with a real model and a real Claude Code session. See
[the write-up](m16-m17-leaner-and-agents.html), "Not checked".

- [ ] [T111 An opencode plugin that reports file reads and edits of the base](/tasks/T111-opencode-file-plugin.md)
- [ ] [T112 Axis's proposals marked on the map, with cards and notes linked both ways](/tasks/T112-proposals-on-the-map.md)
- [ ] [T113 Proposed new notes and folders drawn on the map before they exist](/tasks/T113-ghosts-for-proposed-notes.md)
- [ ] [T114 Folders an agent makes are said and shown, in proposals, the trace and the Atlas](/tasks/T114-folders-made-explicit.md)

Waiting on the developer:
[which notes should need a check](/questions/what-verification-covers.md);
the draft decision
[Axis proposes and writes none itself](/decisions/atlas-proposals-by-leave.md);
and, in T114, whether an agent may move or rename a folder.

# Future

- [Per-agent model and harness settings](/ideas/future-agent-settings.md)
- [Distribution, funding and naming](/ideas/distribution-and-naming.md)
- [Testing on real phones](/ideas/device-testing.md)
- [An interactive tutorial on GitHub Pages, with exemplar knowledge bases and recorded AI answers](/ideas/interactive-tutorial.md)
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
