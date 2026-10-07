---
type: Design
title: The code map
description: How rdstudio reads a codebase into a map, from directories down to functions and important variables, with the links between them, and how notes attach to code.
status: draft
tags: [design, code, atlas, project-mode]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-06T22:35:02Z}
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
engine as the notes, the grid Atlas ([T64](/tasks/T64-dag-layout.md)): each
directory, file and class is a folder laid out as a layered DAG of what is
in it, with trunks between its items. A link may end on a folder (a file
imports a file, a test tests a class); `grid/nested.js` takes those ends on
the code map only. Links for tests and builds are rated like "see also", so
they are shown but do not shape the layout. A directory holding only one
directory is folded into it. Activity is each file's last commit. Health is
tested, documented and reviewed. The Atlas maps the notes by default, in project mode too; the panel's Map
choice switches between Code and Notes (`source` in [the settings](/design/map-view.md)).

# Limits

As of 2026-10-07 (asked by the developer: how general is it, and is it
LLM-based, LSP-based or both?).

- **Neither.** The index is static parsing with tree-sitter; no language
  model and no language server is involved. It is about 400 lines
  (`packages/cli/src/code.ts`).
- **Two languages.** Python and C++ are read down to classes, functions,
  methods, fields and constants. CMake targets and CI jobs are read line by
  line. Any other language appears as files in directories, with nothing
  inside them.
- **Links are by name, not by meaning.** A call to `step` links to whatever
  known item is called `step`: no types, overloads, inheritance, macros or
  templates are resolved. A language server resolves all of these.
- **The bridge between languages is a special case:** nanobind and pybind11
  binding calls are recognised; ctypes, Cython, SWIG and other bridges are
  not.
- **Tried on one codebase,** [nanosim](/tasks/T69-codebase-testbed.md),
  which was generated to suit it. Not yet on a real one.

How it could generalise: another language with tree-sitter is a grammar
package and some 60 to 100 lines saying what a class, a function and an
import look like, with the by-name weakness unchanged; a language server
would correct the links where one is available; and what a module is for
belongs in notes, not the index. See
[measuring the map](/ideas/measuring-the-map.md) and the
[scope of project mode](/decisions/project-mode-scope.md), under which the
code map is an option, not the Atlas's default.
