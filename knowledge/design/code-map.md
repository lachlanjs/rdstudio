---
type: Design
title: The code map
description: How rdstudio reads a codebase into a map, from directories down to functions and important variables, with the links between them, and how notes attach to code.
status: draft
tags: [design, code, atlas, project-mode]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T20:00:00Z }
---

# Why

Project mode should show a codebase as itself, not only the notes written
about it. The developer's levels, from the top: library directories, files
and modules, classes and module-level constructs, then methods, functions
and important variables. The index gives that skeleton and stays current
with the code; notes document the items worth explaining and attach to them
([T66](/tasks/T66-code-map.md)).

# The index

`data/code.json`, written by the build when the project's code is mapped (a
`codebase` or `project` profile, or `[code] enabled = true`):

- **Items:** `{id, kind, name, qual, parent, path, lang, line, end,
  signature, doc, src}`.
  - An id is a directory (`src/core/`), a file (`src/core/system.hpp`), or
    `file#qualified::name`.
  - Kinds: dir, file, class, function, method, field, constant, target and
    job.
- **Links:** `[from, to, kind]`, where the kind is imports, includes,
  calls, uses, binds, implements, tests or builds.

Python and C++ are parsed with tree-sitter. Bindings (nanobind,
pybind11) give a C++ item the Python name it is bound to, so Python calls
through the extension module resolve to C++. Calls are matched by name:
the same file first, then a name that is unique in the project. That is
cheap and right most of the time, but not type-aware.

```toml
[code]
enabled = true                 # default: on for codebase and project profiles
include = ["src/", "python/"]  # default: every tracked file
exclude = ["third_party/"]
```

# Notes on code

A note names the code it is about in its frontmatter:

```yaml
code: ["src/nanosim/core/system.hpp#nanosim::ParticleSystem", "CellList", "python/nanosim/io.py"]
```

Each entry is an item's id, a file's path, or a qualified name or its
ending. A code item's page lists its notes. A note counts towards the
item's health as documentation, and as a review once a person has reviewed
the note.

# On the Atlas

See [the map's design](/design/map-view.md). The code is mapped by the same
engine as the notes: the layout, the routes, the lenses, the grid and the
calmer drawing. Folders are directories, files and classes; links may end
on a folder. Activity is each file's last commit. Health is tested,
documented and reviewed.
