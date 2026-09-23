---
type: Reference
title: Jev (TypeSafe AI)
description: A "System One" model returning typed choices and scores with calibrated confidence; early access since 2026-09-15.
resource: https://typesafe.ai/blog/introducing-system-one-models-and-jev
tags: [models, classifier]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

- Primitives: Choice (≤255 options), Score, Noul (0–1); probabilities and
  confidence returned; no text generation, no images.
- Vendor-reported: 70–500 ms end to end; $0.042 per million input tokens,
  output unmetered; 40–200× faster and up to 444.6× cheaper than LLMs on their
  workflows (self-tested, not independently verified).
- Python and JS SDKs; cloud-only; limited early access.

Candidate uses: [optional classifier](/decisions/classifier-optional.md).
