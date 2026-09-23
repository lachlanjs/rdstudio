---
type: Procedure
title: Publish the dashboard as a static site
description: Export a project's dashboard and publish it with GitHub Pages (or any static host) from CI.
tags: [export, ci, github-pages]
start: decide
nodes:
  - {id: decide, label: Decide the knowledge can be public}
  - {id: pages, label: Set Pages source to GitHub Actions}
  - {id: workflow, label: Add the knowledge-pages workflow}
  - {id: push, label: Push to main}
  - {id: export, label: CI runs rdstudio export _site}
  - {id: deploy, label: Upload artifact and deploy}
  - {id: check, label: Open the published site}
  - {id: other, label: Upload _site to another static host}
edges:
  - {from: decide, to: pages, relation: LEADS_TO, pitfalls: "Everything in the knowledge base, the reports and the commit history (authors and messages) becomes public. Private repositories can still publish public Pages sites on some plans."}
  - {from: pages, to: workflow, relation: LEADS_TO, guidance: "Copy the workflow from the README; replace <owner> with where rdstudio is hosted, or use `uv run rdstudio export _site` when rdstudio is a dev dependency."}
  - {from: workflow, to: push, relation: LEADS_TO}
  - {from: push, to: export, relation: TRIGGERS, condition: "A push to main, or a manual run (workflow_dispatch)."}
  - {from: export, to: deploy, relation: PROVIDES_INPUT_FOR, pitfalls: "Check out with fetch-depth 0, otherwise the Changes tab shows a single commit.", guidance: "The export excludes the global knowledge base, user-level skills and uncommitted changes, and turns off live polling."}
  - {from: deploy, to: check, relation: LEADS_TO, guidance: "The deploy job prints the page URL. Paths are relative, so the site works under a repository subpath."}
  - {from: export, to: other, relation: LEADS_TO, condition: "Hosting somewhere other than GitHub Pages."}
---

# Why a snapshot

`rdstudio export` produces the same dashboard as `rdstudio serve`, frozen at
the commit that was built: no live polling, no user-level skills, no global
knowledge. Any static file server can host it; `python -m http.server` in the
output directory is enough to preview it.

# Checked

Simulated a CI run: a fresh clone with an empty home directory, rdstudio run
through `uvx --from <path>`. The export contained the full commit history, no
uncommitted changes and no user-level skills. The workflow itself has not yet
run on GitHub; action versions were the latest majors on 2026-09-23.

See the [static build decision](/decisions/static-build.md).
