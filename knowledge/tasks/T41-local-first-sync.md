---
type: Task
title: "T41 — Local-first sync"
description: "Delta updates, derivation on the device, git and home-server sync, and learner record merging."
tags: [task, m9, todo]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-29T01:14:28Z }
---

# Prompt

Platform A2 to A5.

See [projects, accounts and sync](/design/projects-and-sync.md):
- content as plain git;
- the private learner repository, with merging between devices as a union
  of events and a user-wide layer (skills, "About you");
- the home server: several projects, git over HTTP, device tokens, pairing
  by QR code, and mDNS discovery.
