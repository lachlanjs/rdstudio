---
type: Decision
title: The person chooses how strong a model each editor request gets, from three tiers
description: Axis in the editor is asked at a tier (low, mid, max), each a model the person sets;
  rdstudio offers a usual tier per action and does not judge a request's difficulty itself.
tags: [assist, models, cost]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:05:55Z}
---

# Decision

The developer, 2026-10-07, after a mechanical edit went to the strongest
default model: "I don't think that Claude Sonnet 5.5 is appropriate for such
a menial edit." They proposed: "we could let them configure a low, mid, max,
model in the settings, and then they could toggle this for each request."
The agent recommended that, with a usual tier per action and no automatic
judging, and they agreed ("Sure").

- Three tiers, `low`, `mid`, `max`, each a model, in `[teacher.tiers]` of
  the user config, set from the Axis page. Defaults:
  `anthropic/claude-haiku-4.5`, `anthropic/claude-sonnet-5.5`,
  `anthropic/claude-opus-5.5`.
- The editor's bar has a choice: Usual, Low, Mid, Max. It is remembered in
  the browser. Usual is mid for a question and for text, max for a figure.
- The reply names the tier, the model and what it cost.
- rdstudio does not classify a request's difficulty.

Built in [T83](/tasks/T83-model-tiers.md "see also"). It governs
[an agent in the editor](/design/assist.md "see also"); the tutor's models
stay by job.

# Assumption

The person can tell a menial request from a hard one more reliably, and at
no cost, than a keyword rule or a further model call could. A wrong guess
downwards would give a worse answer without saying so.

# Alternatives considered

- **rdstudio chooses.** Rules on the request's words guess wrong; a model
  call to classify adds delay, cost and a way to fail.
- **A setting to choose between manual and automatic.** Nothing reliable to
  put behind "automatic" yet.
- **A model per job, as the tutor has.** The same action (rewrite) covers
  both re-rating links and redrafting an argument.

# Reopen if

- Use shows the person picking the same tier for the same kind of request
  nearly always: that is evidence to choose it for them.
- The low and mid defaults stay close in price (today 1 and 5 against 2 and
  10 US dollars a million tokens), so that the choice saves little.
