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
