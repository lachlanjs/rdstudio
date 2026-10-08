---
type: Task
title: T102 — Retire the Python implementation
description: Remove the second implementation of the library, search, build, server and MCP server
  in Python, keeping only the launcher that starts the Node program.
tags: [task, m16, reduction, python, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T05:10:33Z}
---

# Prompt

The developer, 2026-10-08, asked what would improve the project, naming
"making the tool leaner (refinement, reduction), cleaner organisation, or
adding new impactful features".

This task is the agent's suggestion in reply, not the developer's words. It
is the largest single cut seen.

# What was seen

- `src/rdstudio` holds about 3,800 lines of Python: `okf.py`, `cli.py`,
  `mcp_server.py`, `build.py`, `procedures.py`, `references.py`,
  `scaffold.py`, `serve.py`, `learner.py`, `store.py`, `scopes.py`,
  `search.py`, `classify.py`, `config.py` and more.
- `pyproject.toml` installs it as `rdstudio-py`, with the comment "the
  Python one, while it lasts". The `rdstudio` command is the launcher for
  the Node program.
- `tests/` has 13 Python test files, most for the Python implementation.
- The Node code carries `pyjson.ts`, used by `main.ts`, `mcp.ts`,
  `scaffold.ts` and `serve.ts`, to write JSON the way Python does.

# To settle before a plan

- Whether anything still depends on `rdstudio-py`: a harness set-up, a
  skill, a procedure, or a project of the developer's.
- Whether the conformance fixtures (`fixtures/expected`) stay as tests of
  the Node program alone, and if so whether `pyjson.ts` must stay for them.
- What the wheel is after this: the launcher, the bundled Node program, and
  nothing else.
- Which Python tests stay: the launcher's, and any that test the Node
  program through the command line.

Best done before a rename, since it removes many of the places the name
appears.

# Plan

Approved by the developer on 2026-10-08 with the rest of M16 ("Go ahead
with things"), so written with the work, not before it.

What was settled by looking:

- **Nothing depended on `rdstudio-py`** but the things written to compare
  the two: no skill, procedure, template or harness set-up named it.
- **The fixtures stay**, as tests of the TypeScript core. Their generator
  was Python (`fixtures/expected.py`), so it needed a replacement.
- **`pyjson.ts` stays.** It is the form of the output, which agents and
  scripts read; changing it is a different change.
- **Tests kept:** the launcher's and the benchmark's.
- **The search model in the wheel** (left from T99) is not touched here.

# Acceptance

- `src/rdstudio` holds the launcher and what it needs, and no second
  implementation.
- `rdstudio-py` is gone from `pyproject.toml`.
- The wheel builds, installs, and `uvx rdstudio --version` runs the Node
  program.
- The release build passes.

# Outcome

Done on 2026-10-08, on the branch `feat/m16-leaner`; not committed.

**Removed**, 39 files and about 5,600 lines:

- 17 modules in `src/rdstudio`: the core, search, build, server, MCP
  server, store, scaffold, references, classifier, learner record and the
  command line.
- 12 test files for them, and `tests/conftest.py`.
- The six comparisons (`fixtures/agree*.py`,
  `packages/cli/scripts/mcp-agree.ts`, `writes.ts`,
  `packages/core/scripts/snapshot.ts`), `fixtures/expected.py`, and their
  seven `mise` tasks.
- `rdstudio-py`, `RDSTUDIO_PYTHON`, and three dependencies
  (`markdown-it-py`, `mcp`, `pyyaml`). The wheel now needs only Node.

**Added or changed:**

- `fixtures/expected.ts` checks and records the fixtures
  (`mise run fixtures`, `fixtures:update`). Recording again with it changed
  no byte of any file. `classify.json` holds cases from Python's `difflib`
  and stays as recorded.
- `bench/bundle.ts` gives the benchmark and its test what they read from
  the Python core. `bench/run.py` now builds and serves with the Node
  program only.
- The launcher says what to do when the Node program or Node is missing,
  where it used to fall back to Python.
- Comments that pointed at the removed files, the README, and
  `fixtures/README.md`.
- [The platform design](/design/platform.md) has a dated note.

**Before removing**, the comparisons were run once more. The cores agreed
on this repository's 186 notes and 19 searches, and the 22 writes read the
same. The command lines no longer agreed: the Python one did not know
artifacts and still wrote a `reports` path. It had already fallen behind.

**Checked:**

- 148 command line, 207 core and 56 app tests pass; the type checks are
  clean; 4 Python tests pass (launcher and benchmark).
- The wheel was built and run from an empty folder outside the checkout:
  `--version`, `init` and `check` work. It holds two Python files and the
  bundled program.

**Not checked:**

- `bench/run.py` end to end. Its numbers for load and build are now the
  Node program's and do not compare with the baselines in
  `bench/baselines/`, which timed Python.
- The end-to-end browser checks (`mise run e2e`), which were not run; they
  already drove the Node server.
- The release workflow, which still runs `uv run pytest -q` and will find
  4 tests.
