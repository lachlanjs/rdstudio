---
type: Decision
title: "OKF v0.2 is ground truth"
description: "The knowledge format conforms to the OKF spec; conventions only choose among what OKF allows."
tags: [decision]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

# Decision

The [OKF spec](/references/okf-spec.md) governs the bundle format. No invented
status vocabularies; `index.md` files are generated listings; extensions use
OKF's allowance for additional keys only when no native field fits.

# Assumption

OKF is expressive enough for provenance, trust and lifecycle; staying conformant
keeps bundles portable to other OKF consumers.

# Reopen if

A needed capability cannot be expressed without violating the spec, or a newer
OKF version changes the relevant rules.
