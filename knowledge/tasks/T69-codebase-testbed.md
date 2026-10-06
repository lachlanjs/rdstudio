---
type: Task
title: "T69 — A codebase test bed: a nanobind simulation"
description: "A dummy project in Python and C++ (nanobind), with CMake, CI, documentation and notes, to show project mode on a real codebase, down to classes and functions."
tags: [task, m13, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T15:00:00Z }
---

> This was T64 on `main` before it was merged with the grid-dag-view branch, whose T64 is the layered layout.

# Prompt

Asked for on 2026-10-05: "better delineation between the study and project
modes". Levels from the top: library directories, then files and modules,
then classes and module-level constructs, then methods, functions and
important variables.

Decided with the developer (2026-10-05): the levels below files come from
both an index of the code (Python's parser, tree-sitter for C++) and notes
that attach to code items. That is [T66](/tasks/T66-code-map.md). This task
is the test bed itself.

# Outcome (2026-10-05)

`~/Repositories/nanosim`, a separate repository like the other test beds,
made by `bench/nanosim.py` (run it again to recreate it). It is a particle
simulation with a C++17 core bound to Python by nanobind:

- **C++ (`src/nanosim/`):**
  - `core/`: `Vec3`, `minimum_image`, `Particle`, `ParticleSystem` and
    `DEFAULT_SOFTENING`.
  - `forces/`: the `Force` interface, softened `Gravity` (OpenMP) and
    `LennardJones`, cut and shifted.
  - `integrators/`: `VelocityVerlet` and `RK4`.
  - `neighbors/`: `CellList`.
- **Bindings (`src/bindings/`):** nanobind classes for each, a zero-copy
  NumPy view of positions, and the GIL released in `Integrator.step`.
- **Python (`python/nanosim/`):**
  - `Simulation` and `Trajectory` (with `INTEGRATORS`);
  - `analysis` (temperature, g(r), mean squared displacement, diffusion,
    `RDF_BINS`);
  - `io` (npz and xyz), `presets` (two-body orbit, Lennard-Jones gas) and
    `cli`.
- **Build:** CMake 3.18 with a warnings helper and options for tests and
  OpenMP; scikit-build-core in `pyproject.toml`.
- **Tests:** pytest (energy drift, g(r) of an ideal gas, diffusion of a
  random walk, I/O) and Catch2 (minimum image, Verlet energy, cell list).
- **CI:** GitHub Actions for tests on three operating systems,
  cibuildwheel wheels, and the docs site.
- **Documentation:** `docs/` (MkDocs: architecture, forces, integrators,
  API) and `examples/`.
- **rdstudio notes (`knowledge/`), 16 of them:**
  - an overview;
  - design (architecture, particle system, forces, cell lists, integrators,
    zero-copy views);
  - decisions (why nanobind, Verlet by default, reduced units);
  - concepts (minimum image, softening, symplectic integrators);
  - an onboarding guide;
  - two open tasks.
- **Config:** `rdstudio.toml` has `[teacher] profile = "codebase"` (project
  mode) and change categories for code and CI.
- **History:** 15 commits backdated over 100 days, so the Activity lens has
  something to show.
- **Checked:** the C++ core passes `g++ -std=c++17 -fsyntax-only -Wall
  -Wextra`, and the Python parses. It was not built against nanobind here.
  rdstudio serves it in project mode: Today has its counters, and the Atlas
  shows the notes on Activity.
