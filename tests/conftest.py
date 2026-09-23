from pathlib import Path

import pytest


def write(root: Path, rel: str, text: str) -> Path:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


@pytest.fixture
def bundle_dir(tmp_path: Path) -> Path:
    root = tmp_path / "knowledge"
    write(root, "design/overview.md", """---
type: Overview
title: Design overview
description: How the system is designed.
generated: { by: agent/x, at: 2026-09-20T00:00:00Z }
verified: { by: human:alice, at: 2026-09-21T00:00:00Z }
---

# Summary

See [the spectrum](/research/spectrum.md) and [a sibling](./model.md).
Also [missing](/nowhere.md), [a dir](/research/), [web](https://x.org) and `[code](/ignored.md)`.

```
[fenced](/also-ignored.md)
```
""")
    write(root, "design/model.md", """---
type: Design
title: Model
description: The recurrent network model with random matrices.
tags: [model, rnn]
generated: { by: agent/x, at: 2026-09-22T00:00:00Z }
verified:
  - { by: human:alice, at: 2026-09-21T00:00:00Z }
  - { by: process:ci, at: 2026-09-23T00:00:00Z }
custom_key: kept
---

# Dynamics

Tanh units with Gaussian couplings.

## Stability

Spectral radius below one.

# Evolution

Genetic programming over block matrices.
""")
    write(root, "research/spectrum.md", """---
type: Research
description: Eigenvalue spectra of random matrices.
tags: [rmt]
verified: [{ by: process:ci, at: 2026-09-23T00:00:00Z }]
---

The circular law describes the spectrum of random matrices.
""")
    write(root, "research/broken.md", "no frontmatter here\n")
    write(root, "research/untyped.md", "---\ntitle: No type\n---\nbody\n")
    return root
