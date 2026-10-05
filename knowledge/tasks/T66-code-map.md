---
type: Task
title: "T66 — The code map: an index of the code, and notes attached to it"
description: "Index a codebase (Python with its own parser, C++ with tree-sitter, offline) from directories down to functions and important variables, with imports, includes, bindings and calls as links; notes attach to code items; the project Atlas maps it."
tags: [task, m13, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T19:00:00Z }
---

# Prompt

The developer's choice on 2026-10-05 ("Both"): the index gives the skeleton
and stays current; notes document the items worth explaining and attach to
them. Test bed: [nanosim](/tasks/T64-codebase-testbed.md).

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
