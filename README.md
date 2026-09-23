# rdstudio

An agentic research and development studio you drop into any repository:

- a **knowledge base** in [Open Knowledge Format](reference/OKF_SPEC.md)
  (markdown + YAML frontmatter), written jointly by you and your agents, with
  provenance and human verification recorded per concept;
- a **read-only dashboard** (knowledge, graph, changes, review, reports,
  procedures, skills and agents) that works offline, on phones, and as a static
  export;
- a local **MCP server** that gives agents context-cheap access: search, then
  outline, then read one section;
- **skills and agent profiles** for Claude Code: recording decisions and
  questions, working tasks, writing HTML reports, following procedures, handing
  off sessions.

## Requirements

- Python 3.11+ and [uv](https://docs.astral.sh/uv/)
- git (for the Changes tab and provenance)
- Optional: `pdftotext` (poppler) for reading reference PDFs; a
  [papis](https://papis.readthedocs.io/) library for references

## Install

```bash
uv tool install git+https://github.com/<you>/rdstudio   # once published
uv tool install --editable /path/to/rdstudio            # from a checkout
```

Or pin it per project: `uv add --dev rdstudio` and prefix commands with `uv run`.

## Start a project

```bash
cd my-project
rdstudio init --title "My project" --human human:<your-id>
rdstudio serve                     # dashboard on http://localhost:8000
```

`init` writes `rdstudio.toml`, `knowledge/` (placeholders and a bootstrap task),
`reports/`, `.claude/skills`, `.claude/agents`, `.mcp.json`, Claude Code
settings (MCP server enabled, a session-start brief), and a section in
`CLAUDE.md`. It is safe to re-run. Then open Claude Code in the project and ask
it to work through `tasks/bootstrap-knowledge-base`.

## Commands

| Command | What it does |
|---|---|
| `rdstudio init [path]` | Scaffold a project (idempotent; `--force` refreshes skills and agents) |
| `rdstudio serve [--host 0.0.0.0] [--port N]` | Dashboard with live rebuilds (use `0.0.0.0` to reach it over Tailscale or LAN) |
| `rdstudio build` / `rdstudio export DIR` | Build the site / write a static snapshot (e.g. for GitHub Pages) |
| `rdstudio check [-w]` | OKF conformance and broken links |
| `rdstudio index` | Regenerate `index.md` files (serve and the MCP server do this automatically) |
| `rdstudio search WORDS` | Keyword search |
| `rdstudio verify ID...` | Record your human verification of concepts |
| `rdstudio procedure list\|show\|apply\|reject` | Review agent-proposed changes to procedures |
| `rdstudio refs sync\|search\|text` | papis references (set `[references] backend = "papis"`) |
| `rdstudio global init [~/knowledge]` | Create your private cross-project knowledge base |
| `rdstudio promote ID [--keep]` | Move a project concept into the global knowledge base |
| `rdstudio skills list\|to-user\|to-project` | Move skills between project and user scope |
| `rdstudio brief` | The short orientation printed at the start of each agent session |
| `rdstudio mcp` | The MCP server (started by your agent harness) |

## Other harnesses

The MCP server works with any MCP-capable harness (OpenCode, Codex, Cursor and
others): register `rdstudio mcp` as a stdio server. Skills are plain
`SKILL.md` files and agents are markdown profiles, so they can be adapted;
generating harness-specific files is planned
(see `knowledge/ideas/future-agent-settings.md`).

## Design

rdstudio records its own design in its knowledge base: run `rdstudio serve` in
this repository, or read `knowledge/design/`, `knowledge/decisions/` and
`knowledge/tasks/roadmap.md`.
