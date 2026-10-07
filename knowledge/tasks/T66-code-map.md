---
type: Task
title: "T66 — The code map: an index of the code, and notes attached to it"
description: "Index a codebase (Python with its own parser, C++ with tree-sitter, offline) from directories down to functions and important variables, with imports, includes, bindings and calls as links; notes attach to code items; the project Atlas maps it."
tags: [task, m13, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T19:00:00Z }
---

# Prompt

The developer's choice on 2026-10-05 ("Both"): the index gives the skeleton
and stays current; notes document the items worth explaining and attach to
them. Test bed: [nanosim](/tasks/T69-codebase-testbed.md).

- **Levels:**
  - library directories;
  - files and modules;
  - classes and module-level constructs;
  - methods, functions and important variables (module constants, class
    fields).
- **Links:**
  - Python imports and C++ includes;
  - nanobind bindings, joining a Python name to the C++ function or class
    it binds;
  - calls between known names;
  - tests to what they test.
- **Notes attach to code** through `code:` in their frontmatter.
- **The project Atlas** maps the code (Notes or Code), with Activity per
  file from git. Health uses the original three facts: a test exists, a
  person has reviewed it (an attached note is human-reviewed), and a note
  documents it.
- **A code item's page:** signature, docstring, where it is, its links and
  its notes.

# Outcome (2026-10-05)

See [the code map's design](/design/code-map.md).

- **The index (`packages/cli/src/code.ts`):**
  - **What it parses:** Python and C++ with tree-sitter (`web-tree-sitter`
    and the grammars' WASM files from npm, so it works offline); CMake
    targets and GitHub Actions jobs line by line.
  - **Which files:** those git tracks, outside the notes, reports and
    `.rdstudio`; `[code] include` and `exclude` narrow them.
  - **When:** for a `codebase` or `project` profile, or with
    `[code] enabled = true`.
  - **Levels:** directories, files, classes (C++ namespaces fold into the
    qualified name), functions and methods, fields and constants (Python
    UPPER_CASE and annotated class fields; C++ data members and
    `const`/`constexpr`), targets and jobs.
  - **Links:**
    - imports (Python, resolved against the package layout) and includes;
    - calls and type uses between known names, the same file first;
    - nanobind and pybind11 bindings, so `_core.Gravity(...)` in Python
      reaches the C++ class;
    - a C++ definition implementing its declaration;
    - tests (calls from test files) and builds (a CMake target's sources).
  - **Speed:** about 45 ms for nanosim (193 items, 216 links).
- **The build:** writes `data/code.json`, through a hidden command
  (`rdstudio __index-code`) run in a child process, because the parsers
  load asynchronously and the build is synchronous. It is cached against
  the code files' timestamps. `rdstudio serve` watches the code files, so
  the map follows the code.
- **The Atlas:**
  - In project mode with code indexed, it maps the code; More options has
    "Map: Code or Notes".
  - Directories, files and classes are folders. Everything else is a place,
    marked by kind (circle function or method, square class, triangle field,
    diamond constant, star target or job).
  - Links may end on a folder (a file imports a file), and the layout's
    links follow suit. Tests and builds are drawn like "see also" and stay
    out of trunks.
  - **Activity** is each file's last commit. **Health** is the original
    three facts: tested, documented (a docstring, a leading comment, or an
    attached note) and reviewed (an attached note a person has reviewed).
    Understanding is not offered on code.
  - A code item's card says what it is, where, and its links by kind, with
    Open and its notes.
- **Code pages (`#/code/<path>@<qualified name>`):**
  - the trail of directories and file;
  - its kind, where it is, the Python name it is bound to, and its
    declaration;
  - health and last change, documentation and signature;
  - the notes about it and what it defines;
  - its links in both directions by kind;
  - up to 60 lines of source, highlighted.
- **Notes attach** with `code:` in their frontmatter: an item's id, a file,
  or a qualified name or its ending. The nanosim notes now do: particle
  system, cell lists, zero-copy views, integrators, forces, Verlet by
  default, why nanobind, minimum image.
- **Checked:**
  - `packages/cli/test/code.test.ts`: when code is mapped; levels, kinds
    and documentation; bindings, definitions, includes, calls across the
    binding, tests, imports and builds.
  - `e2e/code.py` (14): the code Atlas in project mode, a class's page (its
    binding, links, note and source), Python to C++ through the binding, a
    card, switching to Notes, and the index under two seconds.
  - Every other suite passes.
- **Not done:**
  - call resolution through types (`self.system.compute_forces()` is not
    followed);
  - C++ templates beyond names;
  - other languages;
  - a code tree in the Library.
