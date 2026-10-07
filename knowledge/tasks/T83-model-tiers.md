---
type: Task
title: T83 — Model tiers for Axis in the editor
description: Three tiers of model (low, mid, max) set on the Axis page, and a choice of tier on the
  editor's bar for each request.
tags: [task, m13, assist, models, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:05:55Z}
---

# Prompt

Applying [the decision](/decisions/model-tiers.md "requires").

# Outcome

- `packages/cli/src/models.ts`: `TIERS`, `DEFAULT_TIERS`, `tiers()`, and
  `setTiers()`, which writes the `[teacher.tiers]` table of the user config
  whole and leaves the rest of the file. A model's id must look like one
  (`maker/name`). `complete` takes a `model` in place of the job's.
- `packages/cli/src/assist.ts`: a request carries a `tier`; without one,
  `USUAL` (ask and fill mid, figure max). The reply names the tier.
- `packages/cli/src/serve.ts`: `PUT /api/teacher/tiers`; `tiers` in
  `GET /api/teacher/ai`; `tier` on `POST /api/notes/{id}/assist`.
- The Axis page (`AiPanel.svelte`): "Models in the editor", three fields and
  Save. The tutor's models by job are listed under "Models elsewhere".
- The editor's bar (`NoteEditor.svelte`): a choice, Usual, Low, Mid or Max,
  each naming its model, remembered in the browser. The reply's heading
  gives tier, model and cost.

Checked: two unit tests (`assist.test.ts`, `serve-edit.test.ts`), and six
steps of `e2e/assist.py` (27/27).

# Found on the way

`packages/cli/test/serve-edit.test.ts` runs against the person's real user
config: it sets no `XDG_CONFIG_HOME`. The new test there wrote
`[teacher.tiers]` into the developer's config once before this was seen;
it was taken out again, and that test now uses a config of its own. The
file's other tests still read the real one.

# Not done

- The `write` job is no longer used by the editor; it stays in `JOBS` so
  old settings read.
- No list of OpenRouter's models to pick from: an id is typed.
