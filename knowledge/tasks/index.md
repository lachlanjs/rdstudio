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
