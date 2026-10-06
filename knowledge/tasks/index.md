# Roadmap

* [Roadmap](roadmap.md) - Milestones and task checklist for building rdstudio; the progress tracker.

# Task

* [Bootstrap the knowledge base](bootstrap-knowledge-base.md) - Tailor this knowledge base to the project with the developer.
* [T01 — Package skeleton and configuration](T01-package-skeleton.md) - pyproject, CLI entry point, project and global config loading.
* [T02 — OKF library](T02-okf-library.md) - Parse bundles, frontmatter, links, trust tiers and staleness; lint; generate index.md.
* [T03 — Deterministic search and sectioned reading](T03-search.md) - BM25 search with frontmatter filters; outline and section extraction.
* [T04 — Build pipeline and server](T04-build-serve.md) - Emit site JSON and assets; categorised git history; serve with rebuild-on-change.
* [T05 — Dashboard shell and Knowledge list](T05-dashboard-knowledge.md) - Single-page app, responsive layout, rendered markdown with KaTeX, tables, code highlighting and frontmatter panel.
* [T06 — Knowledge graph view](T06-graph-view.md) - Force-directed graph with directed link edges, undirected hierarchy edges and persistent positions.
* [T07 — Changes and Review tabs](T07-changes-review.md) - Commit-by-commit changes by category; review queue of unverified, stale and open items.
* [T08 — MCP server](T08-mcp-server.md) - Local stdio MCP for search, outline, read, record, verify and log.
* [T09 — Scaffolding, skills and agents](T09-scaffold-skills.md) - rdstudio init plus the skill and agent set.
* [T10 — Reports](T10-reports.md) - HTML reports with vendored charting, Reports tab, graph integration and the /report skill.
* [T11 — Procedural graphs](T11-procedures.md) - Procedure concepts with graphs; MCP neighbourhood lookup; Procedures tab.
* [T12 — papis and Zotero references](T12-references.md) - Optional papis backend: reference stubs, MCP reference tools, /ingest-ref.
* [T13 — Global bundle and promote](T13-global-bundle.md) - Support ~/knowledge as a second bundle; scoped search; /promote.
* [T14 — Pluggable classifier interface](T14-classifier.md) - Interface for edit-significance and step localisation with deterministic default.
* [T15 — Static export and visual QA](T15-export-qa.md) - Export for static hosting; screenshot review at desktop and mobile widths.
* [T16 — Instantiate in himode and test drive](T16-himode-test-drive.md) - Run rdstudio init in ~/Repositories/himode and exercise the full workflow.
* [T17 — Graph dragging, graph options, themes and CI publishing](T17-settings-themes-ci.md) - Fix node dragging, add persistent force options, a Settings tab with five themes, and CI export guidance.
* [T18 — Mermaid diagrams in concepts and reports](T18-mermaid.md) - Render Mermaid diagrams offline in the dashboard and in reports, themed, with agent guidance.
* [T19 — AGENTS.md and OpenCode support](T19-harnesses.md) - Make rdstudio init set up OpenCode (and other AGENTS.md harnesses) alongside Claude Code.
* [T20 — Map view (first version)](T20-map-view.md) - A Map tab showing folders as nested regions with links drawn at their scale, tested on a separate differential geometry bundle.
* [T21 — Link ratings, implied-link culling and link filters](T21-link-ratings.md) - Rate links by how consequential they are, hide links implied by chains of others, and filter the map by folder level, rating and focus.
* [T22 — Five themes, direction colours and a clearer range slider](T22-themes-and-direction.md) - Replace the themes with Studio, Notebook, Map, Space and Cyber, each restyling the map as well as the page; colour routes by direction only; make range-slider thumbs distinct.
* [T23 — Learner record and landmarks](T23-learner-record.md) - A private, append-only record of learning events per project, written by the dashboard, the CLI and later agents; landmarks from frontmatter.
* [T24 — Study paths and reading order](T24-study-paths.md) - Use requires links to give each note its prerequisites in reading order, the whole bundle in reading order, and how advanced each note is.
* [T25 — Tours](T25-tours.md) - Ordered walks through notes with narration; your own tours private, shared tours as Tour notes kept off the map; following one highlights its route.
* [T26 — Interactive exercises](T26-exercises.md) - Offline exercises checked by the dashboard: fill the gap, placement, landmarks named and placed, recall with a self-grade.
* [T27 — Coverage and review](T27-coverage-review.md) - Show on the map what you have shown you understand; a capped spaced-review queue; a quiet load indicator.
* [T28 — Explain-back and AI marking](T28-explain-back.md) - AI-driven tasks: a skill and MCP tools to set and mark explain-back questions, answered in the harness or queued from the dashboard.
* [T29 — Catching up on change](T29-catch-up.md) - What changed in each note since you last looked, from git history and the hashes in your record; notes going stale when their sources change.
* [T30 — Editing in the app](T30-dashboard-editing.md) - Create, edit, move and delete notes from the dashboard, through the same write path as the MCP tools, ergonomic on desktop and phone.
* [T31 — Benchmarks and learner event ids](T31-benchmarks-and-event-ids.md) - Measure map frame times and load times on real and generated bundles; give learner events unique ids before any sync exists.
* [T32 — Offline app shell](T32-offline-shell.md) - A service worker that caches the app and data, so reloads are instant and reading works offline.
* [T33 — Map layout and routing in a Web Worker](T33-map-worker.md) - Move layout and routing off the main thread and cache the results by bundle and settings.
* [T34 — Conformance fixtures](T34-conformance-fixtures.md) - Test bundles with the Python core's output recorded as expected JSON, which every implementation must match.
* [T35 — TypeScript core: OKF parsing and lint](T35-core-okf.md) - packages/core: frontmatter as YAML 1.2, links and headings through markdown-it, trust and staleness, lint and index generation, matching the fixtures.
* [T36 — TypeScript core: graph, search and learner record](T36-core-graph-search-record.md) - Requires graph, reading order, implied links, PageRank, BM25 search and record merging in the TypeScript core, matching the fixtures.
* [T37 — Node command line, MCP server and rdstudio serve](T37-node-cli-mcp-serve.md) - The rdstudio command, MCP server and server rebuilt in Node on the TypeScript core, with OpenAPI and a HeyAPI client for the HTTP parts; the Python package retired part by part.
* [T38 — Svelte UI with a build step](T38-svelte-ui.md) - Rewrite the dashboard in Svelte 5 and TypeScript as a SvelteKit single-page app, built at release time, still vendored and offline.
* [T39 — GPU map renderer](T39-gpu-map.md) - A renderer interface, then a Canvas 2D or WebGL renderer with theme parity, hit-testing, accessibility and level of detail.
* [T40 — Tauri desktop app](T40-tauri-desktop.md) - A desktop app with the UI and core bundled in the webview, released through CI with signed updates.
* [T41 — Local-first sync](T41-local-first-sync.md) - Delta updates, derivation on the device, git and home-server sync, and learner record merging.
* [T42 — Mobile apps](T42-mobile-apps.md) - Android then iOS builds of the Tauri app, edits with merging, and several projects per device.
* [T43 — Teacher foundation](T43-teacher-foundation.md) - The private teacher folder as a git repository beside the learner record, the default skills served through MCP with profiles and overrides, and the Teacher page with its Skills section.
* [T44 — Goals and exercises](T44-goals-and-exercises.md) - Goal and Exercise notes, shared or private; choice, value and text answers; marking by the dashboard, by yourself against the solution, or by an agent; coverage per goal.
* [T45 — Profile, sources and the default skills](T45-profile-and-skills.md) - The evidence-linked learner profile and the sources log, shown on the Teacher page, and first versions of the assess, map, source, exercise, next and review-changes skills.
* [T46 — Trial: dynamical mean-field theory](T46-dmft-trial.md) - Learn the DMFT of random neural networks from first principles to Clark and Abbott's theory of coupled neuronal-synaptic dynamics, in a separate repository, using the teacher throughout.
* [T47 — Mounting a shared knowledge base](T47-mounts.md) - A personal repository that reads a team's knowledge base read-only underneath its own notes, links into it, follows its history, and promotes notes up to it as proposals.
* [T48 — Streaks](T48-streaks.md) - Daily and weekly streaks for recall, new learning, problem solving and all three, with reprieves, derived from the learner record and shown on the Learn tab.
* [T49 — Drafts and history](T49-drafts-and-history.md) - Exercise drafts saved as they are typed, snapshots at each request to the teacher, restoring a draft as it was, and pins that follow edits.
* [T50 — The server-side teacher](T50-teacher-service.md) - rdstudio serve calls models through OpenRouter: connecting an account, models by job, the context builder, a usage log by feature, and a weekly budget.
* [T51 — Work together](T51-work-together.md) - The hint ladder, feedback and discussion pinned to passages of the draft in red, green and blue, hints carried into the answer, confidence, and a replay of the draft.
* [T52 — One theme: tokens and fonts](T52-theme-tokens.md) - Marginalia as the one theme, dark first: the brand book's tokens, the corrected Charter, the six themes and their extra fonts retired.
* [T53 — The shell: spaces, palette and You](T53-shell.md) - The top bar with the project and its mode, the four spaces with Project as the quiet link, the command palette, and the You menu; routes moved out of the old tabs.
* [T54 — Today](T54-today.md) - The home screen: streaks, Set for you, Continue where you left off, reviews due, changed since you looked, the teacher's next step pinned to its row, and goals.
* [T55 — The workbench](T55-workbench.md) - Problem, answer and the teacher's margin in three columns, cards level with their words and joined to them by leader lines in each pen's line style; four exercise states.
* [T56 — Library](T56-library.md) - The tree, the note, and the companion panel (details, your understanding, explain it back, ask the teacher).
* [T57 — The Atlas](T57-atlas.md) - New markers, lenses one at a time, trunks with counts, terrain baked in the worker, north as later in the study order, and a layout that keeps notes in place. Contour folders and downhill routes follow in T60.
* [T58 — Phone layouts](T58-phone.md) - The bottom tab bar, Today and the workbench at 390 wide, pins hanging under their paragraph, marking actions in place of the tab bar while an exercise is open.
* [T59 — Project mode](T59-project-mode.md) - Learning or Project per project: Project mode's spaces, the Activity and Health lenses, and the learning layer on top of a project.
* [T60 — The Atlas: contour folders and downhill routes](T60-atlas-contours.md) - Folder outlines as contours of their contents' fields, and routes that cross contours at right angles and gather in the flats, as options beside circles and gates; the default once timed at scale.
* [T61 — The Station theme](T61-station-theme.md) - Station as a second theme beside Marginalia: the theme picker back, the station tokens, and all of its terminal chrome (status line, key legend, numbered spaces, framed panes, scan lines).
* [T62 — The grid Atlas: cells, routes and drawing](T62-grid-atlas.md) - The grid Atlas in the app as a third folder shape on real bundles: note blocks and rectangular folders on cells, A* routes with lanes, solved in the worker, behind a layout interface with a placeholder layout.
* [T63 — The grid Atlas: parity, the Station skin and retiring the old Atlas](T63-grid-atlas-parity.md) - Everything the continuous Atlas does, on the grid (lenses, selection, study paths, tours, labels, phone), the Station skin, then the grid as the only Atlas and the old one deleted.
* [T64 — The grid Atlas: a layout from the DAGs in each folder](T64-dag-layout.md) - Lay out the grid Atlas bottom-up: in each folder find a DAG among its links, place it by the Sugiyama method, freeze it, and repeat one folder up with subfolders as single items; back links are routed last at their own level.
