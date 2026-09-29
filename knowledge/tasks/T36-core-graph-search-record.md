---
type: Task
title: "T36 — TypeScript core: graph, search and learner record"
description: "Requires graph, reading order, implied links, PageRank, BM25 search and record merging in the TypeScript core, matching the fixtures."
tags: [task, m9, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-29T01:14:28Z }
---

# Prompt

Platform D3 and D4. The map's implied links and PageRank move from map.js into the core.

# Outcome

- **Search** (`search.ts`): BM25 with the same field weights, stop words,
  stemming, filters and snippets as the Python core, scores rounded as Python
  rounds them.
- **Learner record** (`record.ts`): ULIDs (in order within a millisecond),
  legacy ids, reading a record, merging by union, and checking and stamping
  an event. Where and how records are stored stays with the caller.
  A new fixture (`fixtures/learner/`, two devices' records with repeats,
  unreadable lines, old events without ids and a time with an offset) is
  recorded from Python; both cores read and merge it identically. The Python
  record now reads times with the shared date pattern and limits events by
  bytes of compact JSON, as the TypeScript one does.
- **Link graph** (`graph.ts`): link strengths from ratings, PageRank, strongly
  connected components and implied links, moved from the map. A test lifts
  those functions out of `map.js` and checks the core gives identical results
  on every fixture bundle, until the Svelte dashboard imports the core (T38).
- **Agreement:** `mise run core:agree` now compares search too (queries made
  from titles and descriptions). The cores agree on differential geometry, this
  repository, and the 1,186- and 3,885-note synthetic bundles.
- 179 TypeScript tests; the core now covers everything the Python core does
  except writes (store, verify) and procedures.
