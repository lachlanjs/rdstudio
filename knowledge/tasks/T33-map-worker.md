---
type: Task
title: "T33 — Map layout and routing in a Web Worker"
description: "Move layout and routing off the main thread and cache the results by bundle and settings."
tags: [task, m9, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-29T01:14:28Z }
---

# Prompt

Platform B2.

# Outcome

- **Layout in a worker.** The layout moved to `js/layout.js`, shared by the
  page and `js/layout-worker.js`. The map appears at once in the starting
  circle packing ("Arranging the map…") and settles when the worker is done,
  refitting the view unless the reader has already moved it. Without module
  workers it falls back to the main thread.
- **Cached.** A finished layout is kept in the browser, keyed by a hash of the
  contents and the five layout settings, so a reload, or tuning back to
  earlier settings, is already settled.
- **A quadratic removed.** Each folder looked at every link in the project;
  now it looks only at links with an end inside it. Positions are identical
  (checked against the old code on the test bed and the field bundle), and
  layout is about 30% faster.
- **Tuning** keeps the current positions until the new layout arrives, so the
  map no longer jumps back to the packing while a slider moves.
- Routing stays on the main thread: 5 to 34 ms for the first routes, and
  reroutes while zooming (40 to 300 ms on the phone profile at the largest
  sizes) are the next cost. Level of detail (B7) is the way to cut them.
- New measures: `rd:map-place` (the quick start) and `rd:map-settled` (time
  from opening the page to the settled map), which the benchmarks now wait for.

# Results (phone profile, Studio; bench/baselines/2026-09-29-t33-layout-worker.json)

| Bundle | Notes | First map before → after | Settled | Reload before → after |
|---|---|---|---|---|
| differential geometry | 63 | 370 → 305 ms | 358 ms | 230 → 148 ms |
| area | 224 | 500 → 290 ms | 383 ms | 411 → 148 ms |
| field | 1,186 | 1,583 → 407 ms | 708 ms | 1,544 → 240 ms |
| ceiling | 3,885 | 5,354 → 773 ms | 1,690 ms | 5,700 → 599 ms |

"Before" is the baseline's time to a usable map, which was also its settled
map. The build fixes from T31 are included. Caveat: Chromium's CPU throttling
applies to the page, perhaps not to the worker, so the worker's own layout time
on a real phone may be longer; the main thread stays free either way.
