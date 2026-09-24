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
uv tool install git+https://github.com/lachlanjs/rdstudio@v0.1.0
```

To upgrade later, run the same command with a newer tag, followed by
`--force`. To work on rdstudio itself, clone the repository and run
`uv tool install --editable .` inside it.

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
rdstudio serve --host 0.0.0.0    # reachable from other devices (e.g. over Tailscale)
rdstudio verify <concept-id>     # mark a note as checked by you
rdstudio check                   # check the knowledge base's format
rdstudio --help                  # everything else
```

## Optional

- **Global knowledge base** shared across projects: `rdstudio global init ~/knowledge`
- **papis references:** add this to `rdstudio.toml`:

  ```toml
  [references]
  backend = "papis"
  library = "<library name>"
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

## Licence

MIT. The bundled libraries and fonts keep their own licences, which are in
`src/rdstudio/web/vendor/licenses/`.
