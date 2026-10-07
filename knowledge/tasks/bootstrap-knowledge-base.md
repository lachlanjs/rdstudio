---
type: Task
title: Bootstrap the knowledge base
description: Tailor this knowledge base to the project with the developer.
tags: [task, todo]
---

# Prompt

This knowledge base was just created by `rdstudio init` and holds only
placeholders. Working with the developer, tailor it to this project.

1. **Learn the project.** Read the repository's README, CLAUDE.md or
   AGENTS.md, existing docs and recent history. Ask the developer what the
   project is for, who it is for, and what stage it is at.
2. **Propose a directory structure** suited to the project, and agree it with
   the developer before creating anything. Common directories: `design/`,
   `decisions/`, `questions/`, `tasks/`, `procedures/`, `references/`,
   `research/`, `experiments/`. Add project-specific ones where they earn their
   place (for example `thesis/` for a thesis project), and leave out ones that
   do not.
3. **Write the overview** ([overview](/overview.md)): purpose, scope, and a map
   of the directories. Give each directory an `overview.md` (`type: Overview`)
   when it needs explanation.
4. **Seed from existing material.** Where the repository already holds design
   notes, decision logs or references, record them as concepts. Material the
   developer wrote is recorded with `generated.by` set to their actor id.
5. **Record procedures** the developer repeats (release steps, data
   regeneration, bibliography updates) as `type: Procedure` concepts.
6. Write a short report (`/report`) summarising the structure and what was
   seeded, and mark this task done.

# Plan

(To be written by the agent and approved by the developer.)

# Acceptance

- The developer has agreed the directory structure.
- The overview describes the project and maps the directories.
- `rdstudio check` passes.

# Outcome

Not started.
