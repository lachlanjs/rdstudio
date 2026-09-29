---
type: Task
title: "T31 — Benchmarks and learner event ids"
description: "Measure map frame times and load times on real and generated bundles; give learner events unique ids before any sync exists."
tags: [task, m9, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-29T01:14:28Z }
---

# Prompt

Phase 0 of the [platform](/design/platform.md): B1 and the event-id decision under A5.

# Outcome

- **Event ids.** Every learner event now has an `id` (a ULID: sortable, made
  in order within a millisecond) and the `device` that wrote it (a random id
  kept beside the records). Ids made offline are accepted; a retried write is
  read once. `learner.merge()` joins records from several devices as a union by
  id, the same in any order. Events written before ids get a fixed id derived
  from their time and content, so every device agrees on it.
- **Performance contract.** With `?perf` in the address the dashboard records
  `rd:data`, `rd:map-model`, `rd:map-layout`, `rd:map-routes` and
  `rd:map-render` as performance measures; nothing is recorded otherwise.
- **Synthetic projects.** `bench/synth.py` makes valid, repeatable bundles at
  the sizes in the [platform](/design/platform.md) Scale section: subject (63
  notes), area (224), field (1,186), ceiling (3,885).
- **Benchmarks.** `bench/run.py` builds and serves each bundle, opens the map
  in headless Chromium as a desktop (mouse wheel and drag) and as a phone (4×
  slower CPU, 390 px wide, pinch and swipe), and records the steps, frames and
  long tasks, then a reload. `bench/compare.py` compares two results. The
  baseline is kept in `bench/baselines/2026-09-29-svg-map.json`.
- **Tasks.** `mise.toml` holds setup, test, check, serve, bench, bench:compare
  and bench:synth.

# Baseline (SVG map, before phase 0)

First map, in milliseconds (Studio theme):

| Bundle | Notes | Desktop | Phone | of which layout (phone) | Reload (phone) |
|---|---|---|---|---|---|
| differential geometry | 63 | 155 | 370 | 92 | 230 |
| area | 224 | 167 | 500 | 229 | 411 |
| field | 1,186 | 437 | 1,583 | 1,200 | 1,544 |
| ceiling | 3,885 | 1,456 | 5,354 | 4,634 | 5,700 |

What it says:

1. **Layout is the cost, and it is paid again on every reload.** At field size
   it is three quarters of the time to first map on a phone. Moving layout and
   routing to a worker and caching it by bundle and settings (T33) is the most
   valuable next step; for fields, laying out only the open bubble in detail
   (B7) comes next.
2. **The SVG is not large.** Closed folders hide their contents, so the map
   has 100 to 200 SVG elements at every size. A GPU renderer (B4) is not
   needed for element count; it moves down the list until measurements on a
   real phone say otherwise.
3. **Rerouting on zoom** costs about 40 ms on the test bed and 300 ms at the
   ceiling (phone profile), a pause each time folders open or close. The worker
   helps here too.
4. **Space theme:** on the desktop profile, repainting its blur filters after
   a gesture produced long tasks of 2 to 12 seconds in total on the larger
   bundles (Studio: under 0.7 s). Headless Chromium paints in software, so
   check this on real hardware before acting; if it holds, pre-rendered glows
   (B5) are the fix.
5. **The Python build grew faster than the bundle** (1.3 s at 1,186 notes, 9.8 s
   at 3,885), and `rdstudio serve` rebuilds on every save. Fixed here: LibYAML
   for frontmatter, the requires graph and backlinks computed once instead of
   once per note, folder paths split once. Now 0.21 s and 0.9 s.
6. **Transfer** is 430 to 1,085 KB compressed; only at field size does the
   data outgrow the scripts, which is when delta updates (A2) start to matter.

Caveat: under CPU throttling, frame rates from `requestAnimationFrame` in
headless Chromium stay near 60 even when a step takes longer than a frame, so
the measured steps and long tasks are the numbers to trust, not the fps column.
