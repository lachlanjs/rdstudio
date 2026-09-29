---
type: Task
title: "T32 — Offline app shell"
description: "A service worker that caches the app and data, so reloads are instant and reading works offline."
tags: [task, m9, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-29T01:14:28Z }
---

# Prompt

Platform A1; works with today's server.

# Outcome

- `sw.js`, a service worker the build stamps with a fingerprint of the app's
  files. App files come from a cache named after that fingerprint, so
  upgrading rdstudio (or editing an app file) replaces it; a page that opened
  just as a new version took over reloads once.
- Data is cached per data version (`data/version.json`, already a hash of the
  content): opening the dashboard costs one small request, and only a new
  version fetches data again. Two versions are kept.
- Offline, the newest copy is served; the version poll fails, so the Live
  indicator still turns to Offline. The learner record (`api/`) always goes to
  the server.
- The first page load happens before the worker is in control, so the page
  hands it the files it loaded; the next visit is served from the cache.
- Works on HTTPS and localhost (so with `tailscale serve` and dev tunnels),
  and in static exports. `?nosw` bypasses it; `bench/run.py --no-sw` measures
  without it.

# Results (differential geometry and field, Studio)

| Profile | Bundle | Reload without → with |
|---|---|---|
| Slow link (150 ms latency, 500 KB/s) | differential geometry | 1,330 → 221 ms |
| Slow link | field (1,186 notes) | 1,573 → 248 ms |
| Phone (local server) | either | unchanged (within noise) |

The first visit is unchanged (about 2 s over the slow link): it still
downloads 0.5 to 0.7 MB. Delta updates (A2) and a smaller build (T38) are what
shorten it.
