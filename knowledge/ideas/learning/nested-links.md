---
type: Idea
title: Nested networks and links shown at their scale
description: Classify each link by the lowest folder containing both ends, and draw it only at that scale, so cross-scale links can be examined separately.
tags: [learning, graph, proposal]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T03:11:24Z }
---

# Summary

From [characterising complexity](/ideas/manifesto/characterising-complexity.md):
the map is a hierarchy of networks ("nested networks"), and links between nodes
separated by nesting deserve separate examination from links within a community.

- A link **belongs** to the lowest folder containing both its ends. Siblings'
  links belong to their folder (within-community); links whose common folder is
  the root are cross-scale.
- **Draw a link at its scale.** Zoomed out, folders are bubbles joined by one
  line per pair, weighted by how many links it stands for. Zooming into a
  bubble opens it and shows its notes and internal links. Selecting a thick line
  lists the links it bundles. This is the tile-map analogy applied to edges.
- Cross-scale links are either insights into how parts connect or signs that
  the hierarchy is wrong.

The developer finds full hierarchical edge bundling (Holten, 2006) messy when
every edge is drawn; bundling only the edges above the current scale is the
variant worth trying. Nested stochastic block models (Peixoto) could compare
the drawn hierarchy with the one the links imply. Experimentation needed.

```mermaid
flowchart TB
    subgraph design["design/"]
        a[architecture] --- c[conventions]
    end
    subgraph decisions["decisions/"]
        s[static-build] --- r[reports-html]
    end
    a -.->|cross-scale: drawn as one<br/>design ↔ decisions line when zoomed out| s
```

It uses data already in the bundle and is read-only, so it is the cheapest
first prototype.
