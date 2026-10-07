# Decision

* [Adopt procedural graphs, without automatic self-evolution](procedural-graphs.md) - Procedures carry a small typed graph; MCP returns the 2-hop neighbourhood; edits are human-approved.
* [Dashboard is a static site built from JSON](static-build.md) - A Python build step emits JSON; the browser app is static and can be served by any file server.
* [Distribute as a uv tool, not a template repo](uv-tool-distribution.md) - rdstudio ships as a Python package installed with uv; project content lives at the repo root.
* [OKF v0.2 is ground truth](okf-ground-truth.md) - The knowledge format conforms to the OKF spec; conventions only choose among what OKF allows.
* [Optional structured classifier (Jev-style)](classifier-optional.md) - Small classification steps go through a pluggable interface, off by default, with deterministic fallback.
* [Project mode is for the knowledge base and agents' workflows, not a map of the code](project-mode-scope.md) - Project mode's features stay with managing the OKF base and working with agents; the code map is kept as an option on the Atlas, not its default or its direction.
* [Reports are HTML outside the bundle](reports-html.md) - Agent-to-developer reports are self-contained HTML in reports/, linking one-way into knowledge.
* [Show streaks, counting real work only](streaks.md) - Daily and weekly streaks are shown, reversing the earlier rule of no scores or streaks, on condition that only work that teaches counts and reprieves soften a missed day.
* [Station is a second chooseable theme, with its terminal chrome](station-theme.md) - The Station terminal theme joins Marginalia as a user setting, including the status line, key legend and numbered spaces, revising the one-theme rule of the redesign.
* [Support a global bundle alongside project bundles](multiple-bundles.md) - A private ~/knowledge bundle holds cross-project knowledge; no links between bundles; promote moves concepts up.
* [The grid Atlas replaces the continuous Atlas](grid-atlas.md) - The Atlas moves to a square grid of note blocks and rectangular folders with routes over cells; the circle and contour Atlas is kept switchable until the grid reaches parity, then deleted.
* [Verification goes stale only on significant edits](verification-staleness.md) - Significant edits bump generated.at; human verification older than that is stale.
