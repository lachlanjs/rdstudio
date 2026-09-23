---
type: Design
title: Architecture
description: Components, repository layout, and data flow of rdstudio.
tags: [architecture]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Components

| Component | Module | Role |
|---|---|---|
| OKF library | `rdstudio.okf` | Parse bundles, frontmatter, links, trust tiers; lint; generate `index.md`. |
| Search | `rdstudio.search` | Deterministic BM25 over title, description, tags, headings, body. |
| Git history | `rdstudio.gitlog` | Commit-by-commit file lists, categorised by path rules. |
| Build | `rdstudio.build` | Emit a static site (web assets + JSON data) to `.rdstudio/site/`. |
| Serve | `rdstudio.serve` | Stdlib HTTP server; watches files and rebuilds. |
| MCP | `rdstudio.mcp_server` | search / outline / read / record / verify / procedures. |
| Scaffold | `rdstudio.scaffold` | `rdstudio init`: bundle placeholders, skills, agents, config. |
| Dashboard | `rdstudio/web/` | Vanilla JS single-page app, vendored libraries, no CDN. |

See [static build decision](/decisions/static-build.md) for why the dashboard
reads pre-built JSON rather than talking to a live API.

# Layout in a host project

```
project/
  knowledge/        OKF bundle            (committed)
  reports/          HTML reports          (committed)
  rdstudio.toml     project config        (committed)
  .claude/          skills, agents        (committed)
  .mcp.json         MCP registration      (committed)
  .rdstudio/        build output, caches  (git-ignored, rebuildable)
```

The tool itself lives outside the project, either as a uv tool or as a pinned dev
dependency ([distribution](/decisions/uv-tool-distribution.md)).

# Data flow

1. Humans and agents edit markdown in `knowledge/` (agents preferably via MCP
   `record`, which stamps provenance).
2. `rdstudio build` parses the bundle, git history, reports, skills and agents,
   and writes `data/*.json` plus copies of the markdown into the site directory.
3. The browser renders markdown client-side (markdown-it, KaTeX, highlight.js)
   and draws the graph (d3-force).
4. `rdstudio serve` rebuilds on change; the page polls a version stamp and
   refreshes data without losing graph state.

# Dashboard tabs

Knowledge (list + graph), Changes, Review, Reports, Procedures, Skills & Agents.
