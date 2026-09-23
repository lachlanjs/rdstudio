# Decision

* [Adopt procedural graphs, without automatic self-evolution](procedural-graphs.md) - Procedures carry a small typed graph; MCP returns the 2-hop neighbourhood; edits are human-approved.
* [Dashboard is a static site built from JSON](static-build.md) - A Python build step emits JSON; the browser app is static and can be served by any file server.
* [Distribute as a uv tool, not a template repo](uv-tool-distribution.md) - rdstudio ships as a Python package installed with uv; project content lives at the repo root.
* [OKF v0.2 is ground truth](okf-ground-truth.md) - The knowledge format conforms to the OKF spec; conventions only choose among what OKF allows.
* [Optional structured classifier (Jev-style)](classifier-optional.md) - Small classification steps go through a pluggable interface, off by default, with deterministic fallback.
* [Reports are HTML outside the bundle](reports-html.md) - Agent-to-developer reports are self-contained HTML in reports/, linking one-way into knowledge.
* [Support a global bundle alongside project bundles](multiple-bundles.md) - A private ~/knowledge bundle holds cross-project knowledge; no links between bundles; promote moves concepts up.
* [Verification goes stale only on significant edits](verification-staleness.md) - Significant edits bump generated.at; human verification older than that is stale.
