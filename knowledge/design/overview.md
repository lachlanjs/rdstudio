---
type: Overview
title: rdstudio overview
description: What rdstudio is, who it is for, and the principles it serves.
tags: [overview]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
sources:
  - id: build-spec
    resource: ../../build_spec.md
    title: rdstudio build specification
    author: human:lachlan
---

# What it is

rdstudio is a uv-installable tool that drops an agentic research-and-development
setup into any repository.[^build-spec] It provides:

- a project **knowledge bundle** in [OKF v0.2](/references/okf-spec.md), jointly
  authored by the developer and agents;
- a **read-only dashboard** (static site, offline, mobile-friendly) for browsing
  knowledge, changes, reports, skills, agents and procedures;
- a lightweight **MCP server** giving agents deterministic, context-cheap access
  to the bundle;
- a set of **skills and agent profiles** for recording, searching and reporting.

Optionally, a user-level **global bundle** (`~/knowledge`) holds knowledge that
spans projects (see [multiple bundles](/decisions/multiple-bundles.md)).

# Principles

1. Enhance the memory of both agent and developer; stop retreading ground.
2. Formalise best practices and procedures.
3. Consistent, rich communication between agent and developer.
4. Preserve the agent's context: retrieve the smallest useful unit.
5. Provenance: every concept records who wrote it and whether a human checked it.

# Where to go next

- [Architecture](/design/architecture.md)
- [Conventions](/design/conventions.md)
- [Roadmap](/tasks/roadmap.md)

[^build-spec]: rdstudio build specification
