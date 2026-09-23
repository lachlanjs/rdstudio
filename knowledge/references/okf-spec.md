---
type: Reference
title: Open Knowledge Format v0.2
description: The specification the knowledge bundle conforms to; local copy in reference/OKF_SPEC.md.
resource: https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md
tags: [okf, spec]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

Local copy: `reference/OKF_SPEC.md` (commit `ad30107`).

Key points for rdstudio:

- `type` is the only required field; unknown keys and types must be tolerated.
- Trust: `generated` (last meaningful change) and `verified` (list of events);
  tiers unverified / machine-confirmed / human-reviewed via the `human:` prefix.
- Lifecycle: `status` (draft, stable, deprecated), `stale_after`.
- `index.md`: no frontmatter (except root `okf_version`), bullet listings
  under headings; may be generated. `log.md`: date-grouped entries, newest first.
- Links: bundle-absolute `/path.md` recommended; broken links tolerated.
