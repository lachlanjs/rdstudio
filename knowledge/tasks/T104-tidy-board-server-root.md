---
type: Task
title: "T104 — Tidy: the task board, the server file, the repository root"
description: Bring the task states up to date, split serve.ts by area, and clear the repository root
  of leftovers.
tags: [task, m16, organisation, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T22:32:29Z}
---

# Prompt

The developer, 2026-10-08, asked what would improve the project, naming
"making the tool leaner (refinement, reduction), cleaner organisation, or
adding new impactful features".

This task is the agent's suggestion in reply, not the developer's words.

# What was seen

- **The task board is stale.** Five tasks are marked active and every agent
  session opens with them. [Map view (first version)](/tasks/T20-map-view.md)
  is one, though the grid Atlas replaced it.
  [The grid Atlas](/tasks/T62-grid-atlas.md) and
  [the Station theme](/tasks/T61-station-theme.md) may be the same.
  [T99](/tasks/T99-gateway-setup-friction.md) is done but not on the
  [roadmap](/tasks/roadmap.md).
- **`packages/cli/src/serve.ts` is 1,034 lines**: the routes for notes,
  the teacher, the tutor, Axis, Ask Atlas, artifacts and the code map, with
  the file watching, in one file.
- **The repository root** holds `build_spec.md`, an empty `reports/`, and
  twelve reference images of the developer's that are not to be committed.

# To settle before a plan

- Whether `build_spec.md` is still read, or belongs in `knowledge/`.
- Where the developer's reference images should live: a folder named in
  `.gitignore` is suggested. They are the developer's files; nothing is
  moved without their say.

# Plan

(Filled in by the agent before implementation.)

# Acceptance

- Every task marked active is being worked on; the rest are done, todo or
  dropped.
- `serve.ts` is split into files by area, with no change in behaviour and
  the API description unchanged.
- The root holds only what the build, the tools and a reader need.

# Outcome

Done on 2026-10-08 and 09, on the branch `feat/m16-leaner`.

**The task board.** [T20](/tasks/T20-map-view.md),
[T61](/tasks/T61-station-theme.md) and [T62](/tasks/T62-grid-atlas.md) are
marked done, each with a note saying why; what they left unchecked is
[T73](/tasks/T73-walkthroughs-grid-atlas.md).
[T16](/tasks/T16-himode-test-drive.md) and
[T46](/tasks/T46-dmft-trial.md) are back to todo: they wait on the
developer. T99 is on the roadmap.

**The server file.** `packages/cli/src/serve.ts` was 1,157 lines by the
end of this milestone. It is now 190: the app put together, the static
files and the watching. Beside it, in `serve/`:

- `api.ts` (492 lines): every route's address and shapes, from which the
  OpenAPI description and the app's client are made.
- `shared.ts`: who may ask and who may write, which every handler uses.
- `learner.ts`, `teacher.ts`, `ai.ts`, `axis.ts`, `agents.ts`, `notes.ts`:
  what the routes do, by area, each handler as it was.

The API description is the same as before, compared as a value; the
order of its paths changed, so the generated client's files are reordered.
172 unit tests pass, the type checks are clean, the bundle builds, and the
seven browser suites that can run on this machine pass.

**The repository's root: not changed.**

- `build_spec.md` stays: the design overview cites it as its source.
- `reports/` holds a `.gitkeep` and is a folder the build reads.
- The developer's reference images are theirs, and are left where they
  are, untracked. A folder named in `.gitignore` would keep them out of
  `git status`: for the developer to say.

**Not checked:** the five browser suites that need the differential
geometry test bed (edit, compose, reshape, learn, teacher), which is not
on this machine. They cover routes that moved in the split.
