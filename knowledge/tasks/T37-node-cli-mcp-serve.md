---
type: Task
title: "T37 — Node command line, MCP server and rdstudio serve"
description: "The rdstudio command, MCP server and server rebuilt in Node on the TypeScript core, with OpenAPI and a HeyAPI client for the HTTP parts; the Python package retired part by part."
tags: [task, m9, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-29T01:14:28Z }
---

# Prompt

Platform D5. papis and the classifier stay in Python, called as subprocesses. Distribute through npm and as a single binary.

# Plan

In slices, each leaving both command lines working; `mise run cli:agree`
compares their output on every ported command.

1. **Read-only commands:** configuration, `check`, `index`, `search`, `path`,
   `learner`. Done.
2. **`build` and `serve`:** the dashboard data, byte for byte against the
   Python build; `rdstudio serve` on Hono (compression, caching, the learner
   API with its checks, rebuilding on change); OpenAPI for the learner API.
   Done.
3. **Writes:** store and verify (with the significance rules), procedures
   (and their lint), the global bundle and promote, `init` and skills.
4. **The MCP server** on the official TypeScript SDK, the same tools.
5. **papis and the classifier** by subprocess, `brief`.
6. **The launcher:** the wheel carries the bundled Node program and the
   dashboard, Node comes from `nodejs-wheel-binaries`, the `rdstudio` entry
   point runs it; then the Python modules are retired.

# Progress

- Slice 1: `packages/cli` (npm name `rdstudio`, run as TypeScript by Node 24):
  configuration from `rdstudio.toml` and the user config (`smol-toml`), the
  learner record's files, JSON printed as Python prints it, and `check`,
  `index`, `search` (text and `--json`), `path` and `learner`. The core gained
  `resolveId` and `writeIndexes`. Commands not yet ported say so and point to
  the Python command line. `fixtures/agree_cli.py` runs 27 commands in each of
  the five fixture bundles, this repository and the differential geometry
  bundle, with both command lines: identical output and exit codes, and
  identical index files (YAML error wording, which comes from each parser,
  excepted).
- Slice 2: `build` and `export` (the dashboard's data, git history, reports,
  skills, assets, the service worker's fingerprint, the manifest and the data
  version) and `serve` on Hono: compression with a cache, 304s, cache
  headers, the learner API with the same checks in the same order, keep-alive
  with POSTs closing, rebuilding on change. The learner API is described with
  zod and served as OpenAPI at `/api/openapi.json`, for the Svelte
  dashboard's generated client (T38). `fixtures/agree_build.py`
  (`mise run build:agree`) builds and exports each project with both command
  lines and compares every file written: identical, byte for byte, for the
  five fixture projects (made into git projects with a report and an
  uncommitted note), this repository and the differential geometry bundle.
  The Python server's tests are ported and pass.
- Found on the way: both cores read frontmatter without its last line break,
  so a folded block (`description: >`) as the last key lost its final newline
  in Python but not in JavaScript. Both now parse the block as written, with
  a fixture (`edge/block-scalar.md`). File walks follow symlinks, as Python's
  do (a symlinked skill folder was missing).
- Known and accepted: YAML error messages are worded by each language's
  parser; the Node server returns 404 for a folder without an `index.html`
  where Python lists it. Both servers rebuild twice after a change, because
  `git status` during the build refreshes git's index, which the watcher
  counts as a change (to fix later, in the Node server only).
- Slice 3a: the classifier's rules in the core, with a port of difflib's
  matching (400 random cases, edit significance and step matching recorded
  from Python as `fixtures/expected/classify.json`); the command backend; the
  store (`record`, `verify`, `replaceSection`, id checks) and `rdstudio
  verify`. The Node store edits frontmatter in place, so untouched keys keep
  their formatting and comments survive; new values are written as the
  Python store writes them (`[a, b]`, unindented list items, `|` for text
  with line breaks). `fixtures/agree_writes.py` (`mise run writes:agree`)
  runs 14 writes through both stores and reads the results with the Python
  core: they read the same.
