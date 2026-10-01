# rdstudio

A knowledge base, dashboard and agent toolkit for research projects, which you
add to any repository. You and your agents write notes, decisions, tasks and
procedures as markdown in `knowledge/`, and a local dashboard lets you browse
them.

**[See a live preview](https://lachlanjs.github.io/rdstudio/)**: the dashboard
for rdstudio's own knowledge base, rebuilt on every push to `main`.

## Requirements

- Python 3.11+ and [uv](https://docs.astral.sh/uv/)
- git
- An agent harness: [Claude Code](https://claude.com/claude-code) and
  [OpenCode](https://opencode.ai) are set up automatically; others that read
  `AGENTS.md` and support MCP can use the same files

## Install

```bash
uv tool install rdstudio       # from PyPI; `uv tool upgrade rdstudio` later
```

or, with Node 24 or later, `npm install -g rdstudio` (or run it without
installing: `npx rdstudio init`). Either way you get the same program: its
command line runs on Node, which the Python package brings along as a
dependency, so there is nothing else to install. `rdstudio-py` runs the older
Python command line, which does the same things, while it lasts.

To work on rdstudio itself, clone the repository, run `mise run setup`, then
`uv tool install --editable . --force` inside it. Releases are made by pushing
a version tag (see `knowledge/procedures/release.md`).

## Use it in a project

```bash
cd my-project
rdstudio init --human human:<your-name>
rdstudio serve                # dashboard at http://localhost:8000
```

`init` writes `AGENTS.md` (with `CLAUDE.md` importing it), skills in
`.claude/skills/`, subagents for both harnesses, and MCP settings in `.mcp.json`
and `opencode.json`. Then open Claude Code or OpenCode in the project and ask
it to work through the bootstrap task. The agent agrees a structure for the
knowledge base with you and fills in the first notes.

## Everyday commands

```bash
rdstudio verify <concept-id>     # mark a note as checked by you
rdstudio check                   # check the knowledge base's format
rdstudio path <concept-id>       # what to read first, from links rated "requires"
rdstudio --help                  # everything else
```

## Open the dashboard on your other devices

Keep `rdstudio serve` on localhost and let Tailscale put it on your tailnet
over HTTPS, where only your devices can reach it (and a phone can install it as
a full-screen app):

```bash
rdstudio serve --port 8003
tailscale serve --bg --https=8003 http://127.0.0.1:8003
# open https://<machine>.<tailnet>.ts.net:8003/ on any device signed in to your tailnet
```

`--bg` keeps it across restarts; `tailscale serve --https=8003 off` removes it.
Use one port per project. `rdstudio serve --host 0.0.0.0` also works, but
serves plain HTTP to your whole network.

Anyone who can open the dashboard from `rdstudio serve` can edit notes in it
(the Edit button on a note), with edits recorded as yours. Keep it to your own
devices, as above, or start it with `rdstudio serve --read-only`. Exported
snapshots (`rdstudio export`) are always read-only.

Over HTTPS (or on localhost) the dashboard keeps a copy of itself and of the
notes in the browser: after the first visit it reopens at once, even over a
slow tunnel, and it can be read offline. Only changed notes are fetched again.
Add `?nosw` to the address to bypass the copy.

## Optional

- **Global knowledge base** shared across projects: `rdstudio global init ~/knowledge`
- **papis references:** add this to `rdstudio.toml`:

  ```toml
  [references]
  backend = "papis"
  library = "<library name>"
  ```

- **Map settings:** the Map tab's Tuning panel adjusts layout and routing;
  put values you like under `[map]` in `rdstudio.toml` to make them the
  project's defaults (see `knowledge/design/map-view.md`).
- **Learner record:** a private record of what you study, kept outside the
  project (`rdstudio learner` shows where). Off until you add this to
  `~/.config/rdstudio/config.toml`:

  ```toml
  [learner]
  enabled = true
  # path = "~/knowledge/learning"   # optional: somewhere versioned and private
  ```

- **Static site:** `rdstudio export <dir>` writes a snapshot that any static
  host can serve (see below).

## Publish to GitHub Pages

Anything you publish is public, including commit authors and messages in the
Changes tab.

1. In the repository's settings on GitHub, open **Pages** and set the source to
   **GitHub Actions**.
2. Add `.github/workflows/knowledge-pages.yml`:

```yaml
name: Publish knowledge dashboard
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0   # full history, for the Changes tab
      - uses: astral-sh/setup-uv@v7
      - run: uvx --from git+https://github.com/lachlanjs/rdstudio@v0.1.0 rdstudio export _site
      - uses: actions/upload-pages-artifact@v5
        with:
          path: _site
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

If rdstudio is a dev dependency of the project, use `uv run rdstudio export
_site` instead of the `uvx` line. For other static hosts, run the same export
and upload `_site/`.

## Develop rdstudio

Tasks live in `mise.toml`; run them with `mise run <task>` (`mise tasks` lists
them), or run the command each one names.

```sh
mise run setup      # Node 24 (mise), Python and npm dependencies, the dashboard, Chromium for the benchmarks
mise run test       # the Python tests, then the TypeScript packages
mise run core:test  # the TypeScript core against the conformance fixtures
mise run core:agree ~/notes/knowledge   # do the Python and TypeScript cores agree on a bundle?
mise run bench      # load and map benchmarks, written to .bench/results/
mise run bench:compare .bench/results/a.json .bench/results/b.json
mise run bench:synth field /tmp/field   # a synthetic project of about 1,300 notes
```

The benchmarks build and serve the differential geometry test bed (set
`RDSTUDIO_BENCH_DG` to its folder) and synthetic projects from one subject up
to a whole field, then time the first map and a fixed pan and zoom in headless
Chromium, as a desktop and as a phone. Compare any change that could affect
speed against a baseline. The platform plan is in
`knowledge/design/platform.md`.

The TypeScript core (`packages/core`) and command line (`packages/cli`) are
replacing the Python ones; `fixtures/` holds the contract both keep (see
`fixtures/README.md`), and `mise run agree` runs every comparison between the
two: the core on real bundles, every command's output, every file `build`,
`export` and `init` write, the notes after the same writes, and the MCP
server's tools and replies. In a checkout, `rdstudio` runs the TypeScript
sources directly; `mise run bundle` builds the single file a release ships.

The dashboard is a SvelteKit app in `app/`. `mise run app:build` builds it into
`src/rdstudio/web/`, where `rdstudio build` and `serve` find it (it is not
committed, so a fresh checkout needs it once); `mise run app:dev` runs it with
live reloading.

## Licence

MIT. The bundled libraries and fonts keep their own licences, which are in
`app/static/vendor/licenses/`.
