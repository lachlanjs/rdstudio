---
type: Task
title: "T35 — TypeScript core: OKF parsing and lint"
description: "packages/core: frontmatter as YAML 1.2, links and headings through markdown-it, trust and staleness, lint and index generation, matching the fixtures."
tags: [task, m9, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-29T01:14:28Z }
---

# Prompt

Platform D2. The core takes files as text (no file system access), so it
runs in the browser, Node and Tauri alike; a Node loader reads a folder.

Where [T34](/tasks/T34-conformance-fixtures.md) found the Python core arguably
wrong (links and headings by pattern, YAML 1.1), the TypeScript core does the
right thing and the Python core is changed to match, with the fixtures recorded
again, so both agree before anything is replaced.

# Outcome

- **Decisions first.** The Python core now reads links and headings with
  markdown-it-py and frontmatter as YAML 1.2 (read and written with the same
  types; dates kept as written, read by one pattern), with one rule for values
  as text. Fixtures recorded again; nothing changed for the differential
  geometry bundle or this repository's.
- **`packages/core` (`@rdstudio/core`)**, TypeScript on Node 24 (npm
  workspaces, vitest, TypeScript 7 with erasable syntax only, so Node, Vite and
  vitest run the sources directly): frontmatter (`yaml`), links and headings
  (`markdown-it`), notes with trust and staleness, folders, link resolution,
  lint with the same codes, the requires graph, cycles, reading order, depth,
  prerequisites, backlinks and generated indexes. `node.ts` reads a folder;
  everything else takes files as text, and a test keeps Node modules out.
- **Conformance:** every fixture part but search (T36) matches, note by note
  (149 tests). `fixtures/agree.py` (`mise run core:agree <folders>`) compares
  both cores on real bundles: they agree on differential geometry (63 notes),
  this repository (79) and the field bundle (1,186).
- **Speed:** 3,885 notes parsed, linked, ordered and indexed in 0.27 s warm
  (0.43 s cold), against 1.3 s for the Python core.
- Line endings: the core turns CRLF and CR into LF, as Python's text mode does.

Not yet ported: procedure lint (with procedures, in T37), writes (store and
verify, D6).
