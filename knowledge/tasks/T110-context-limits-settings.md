---
type: Task
title: T110 — Set how much goes to a model and how much may come back, in rdstudio itself
description: Settings for the input budget and the output limit of the model calls, which are fixed
  in the code today.
tags: [task, m16, assist, provider, settings, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T05:22:15Z}
---

# Prompt

The developer, 2026-10-08: "It would also be good to be able to configure
the context input and output limits in rdstudio itself".

# What exists, from the agent

Not the developer's words. Every limit is a number in the code today:

- **Input.** Each request is built from named sections, each with its own
  token budget, shortened to fit (`packages/cli/src/context.ts`). The
  budgets are written where each surface builds its prompt: `assist.ts`
  (for example 2,400 for notes found by searching, 3,600 for code, 12,000
  for an artifact), `atlasask.ts` (6,000 for what was looked up) and
  `tutor.ts` (3,000 for the notes an exercise tests). Tokens are estimated
  at four characters each.
- **Output.** `maxTokens` per call: Ask Atlas 1,600; the tutor 200 for a
  hint and 900 otherwise; Axis in the editor by `roomFor()` in `assist.ts`.
- **Tool rounds.** `ROUNDS` in `assist.ts`: 3, 6 and 8 for the low, mid and
  max tiers. Each round adds to the input.
- **What can be set now.** Only the name of the output field
  (`max_tokens_field` under `[teacher.provider]`), the model for each tier
  and job, and the weekly budget in dollars.

Nothing knows a model's context window. A gateway model with a small
window, or one that counts reasoning against the output limit, cannot be
allowed for without changing code.

# To settle before a plan

**Settled by the developer, 2026-10-08:** "I agree with those suggestions -
the settings should be settable in the UI".

- **What the limits are:** one ceiling for the input and one for the output
  per tier (low, mid, max), with the sections scaled to fit. No per-section
  settings.
- **Where they are set:** in the app, on the Settings page. The app already
  sets each tier's model there (the tiers route in `serve.ts`), so the
  limits sit beside it and are kept in the same place, the user's
  configuration.

Still open, for the plan:

- **Whether a model's own window is given**, so that rdstudio refuses or
  shortens before the gateway does, and whether it can be read from the
  gateway's model list where one is offered.
- **Whether tool rounds are part of it**, since they decide the input as
  much as the budgets do.
- **What the developer sees when something is shortened or cut off:** the
  "what the model was given" report already marks shortened sections; a
  reply stopped at the output limit should say so too.
- **The tutor**, whose jobs are not chosen by tier in the same way: whether
  it takes its tier's ceilings or keeps its own.

Easier after [one agent loop](/tasks/T100-one-agent-loop.md), which puts
the budgets in one place.

# Plan

Approved by the developer on 2026-10-08 with the rest of M16, so written
with the work. The four points left open, as settled in building:

- **A model's own window is not asked for.** The input limit is how the
  person says it.
- **Tool rounds are not a setting.** The input limit binds them: it is
  counted across the rounds.
- **A cut-off reply says so** under it, on every surface.
- **The tutor takes its job's tier's limits** (hints: low; the rest: mid).

One thing differs from "ceiling" as first written: **the output limit set
is what is sent**, in place of rdstudio's own figure, so it can raise as
well as lower. A model that reasons counts its reasoning against the
reply, and rdstudio's 900 tokens for an answer can then leave nothing;
only a higher figure mends that.

And one from "the Settings page": the limits are on **the Teacher page**,
under Models and spending, beside the tier models, which is where those
have always been set.

# Acceptance

- On the Settings page, each tier has an input ceiling and an output
  ceiling that can be changed; the defaults behave as today.
- A change made there is kept in the user's configuration and holds for
  the next request, with no restart.
- A request never exceeds the input ceiling set; sections are shortened to
  fit and marked as shortened.
- A reply cut off by the output ceiling is reported as cut off.
- `rdstudio provider show` reports the limits in force.
- The procedure note for an organisation's models describes the settings.

# Outcome

Done on 2026-10-08, on the branch `feat/m16-leaner`; not committed.

**The setting.** `[teacher.limits]` in the user config, a row for each tier
with `input`, `output` or both, in tokens. `models.limits()` and
`setLimits()`; `PUT /api/teacher/limits`; and a form under **Limits** on
the Teacher page. An empty field is no limit. `rdstudio provider show`
prints them. Described in
[an organisation's models](/procedures/enterprise-models.md).

**Input.**

- `assemble()` in `context.ts` takes the limit. Sections marked `keep`
  (instructions, the person's words, the note being changed, the exercise
  and the draft) are never cut. The rest are shortened in proportion until
  the whole fits, and are marked as shortened in "what the model was
  given".
- If what must be kept is over the limit, the request is refused with both
  figures and what to do.
- In the loop (`agent.ts`), the count carries across rounds. A tool's
  answer is cut to the room left, the model is told to reply, and the next
  call may not use a tool.
- The turns of a chat before this one count towards it.

**Output.** Applied in one place, `models.complete()`, by the call's tier
or its job's. A reply that stops at the limit is known from the provider's
`finish_reason`, and a line under the reply says so and what to change:
beside the note, on the Atlas (both kept with the chat or the question),
and in the tutor's reply. This also reports a reply cut at rdstudio's own
figure, which was silent before.

**Checked.**

- Five new tests: the config round trip (and the table removed when
  emptied); the output limit sent and a cut reported; sections shortened
  in proportion with kept ones whole; the loop ending early under an input
  limit and staying under it; the route. 156 command line tests pass, and
  the type checks.
- In a browser, on a throwaway project: the form empty, a value that is
  not a number said and not sent, the server's refusal shown, saved to the
  config with the rest of the file as it was, back after a reload, emptied
  again, and no sideways scroll at phone width.

**Not checked.**

- Against a real model: that a provider's `finish_reason` is `length` when
  it stops (OpenAI's and OpenRouter's word; `max_tokens` is also taken).
  A gateway that sends neither reports no cut.
- The notices as they look under a reply in the browser: the lines are
  rendered by the same element as the existing notes there, and were not
  looked at.
- Tokens are estimated at four characters each, so the input limit is
  approximate: text full of code or paths runs denser.
