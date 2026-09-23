---
type: Idea
title: Per-agent model and harness settings
description: Future feature for choosing model, provider, thinking level and tool permissions per agent profile.
tags: [future, agents]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

Version 1 ships three agent profiles (Librarian, Critic, Searcher) as Claude Code
subagents. A future version could add, per profile:

- model and provider selection (e.g. through OpenRouter, or OpenCode's
  multi-provider agents);
- thinking or effort level;
- tool permissions;
- harness-specific output (`rdstudio init --harness opencode`).

Other roles discussed: Developer (the main agent), Experimenter, Eye (vision
review; every current Claude model has vision, so this is a prompt, not a model).
