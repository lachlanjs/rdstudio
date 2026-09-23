# rdstudio

A knowledge base, dashboard and agent toolkit for research projects, which you
add to any repository. You and your agents write notes, decisions, tasks and
procedures as markdown in `knowledge/`, and a local dashboard lets you browse
them.

## Requirements

- Python 3.11+ and [uv](https://docs.astral.sh/uv/)
- git
- [Claude Code](https://claude.com/claude-code), or another harness that
  supports MCP

## Install

```bash
git clone <this repo> rdstudio
uv tool install --editable ./rdstudio
```

## Use it in a project

```bash
cd my-project
rdstudio init --human human:<your-name>
rdstudio serve                # dashboard at http://localhost:8000
```

Then open Claude Code in the project and ask it to work through the bootstrap
task. The agent agrees a structure for the knowledge base with you and fills
in the first notes.

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

- **Static site** (e.g. for GitHub Pages): `rdstudio export <dir>`
