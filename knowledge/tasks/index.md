# Roadmap

* [Roadmap](roadmap.md) - Milestones and task checklist for building rdstudio; the progress tracker.

# Task

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
* [T30 — Editing from the dashboard](T30-dashboard-editing.md) - Let the dashboard edit notes through the same path as the MCP tools, with conflict checks, for a map you can reshape.
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
