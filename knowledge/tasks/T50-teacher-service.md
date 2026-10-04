---
type: Task
title: "T50 — The server-side teacher"
description: "rdstudio serve calls models through OpenRouter: connecting an account, models by job, the context builder, a usage log by feature, and a weekly budget."
tags: [task, m11, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-04T10:00:00Z }
---

# Prompt

See [work together](/design/tutor.md), section The server-side teacher. The default budget is $10 a week.

# Outcome (2026-10-04)

- **`packages/cli/src/models.ts`:** calls through OpenRouter's chat
  completions, streaming. Text arrives piece by piece; the last event
  carries the usage and cost. It sends `HTTP-Referer` and `X-Title`, and
  marks sections for caching (`cache_control`), which the providers that
  support it use.
- **The key:** `OPENROUTER_API_KEY`, or `~/.config/rdstudio/openrouter.key`
  (mode 600), written by connecting from the Teacher page. Connecting is
  OpenRouter's OAuth with PKCE (S256): the server keeps the verifier by state
  for ten minutes, and the callback is `/api/teacher/ai/callback` on whatever
  host the dashboard was reached at. A localhost callback works on any port.
- **Models by job** (`[teacher.models]` in the user config):
  - hints and checks: `google/gemini-3.8-flash` ($0.75 in, $3.75 out per
    million tokens);
  - feedback, discussion and marking: `anthropic/claude-sonnet-5.5` ($2 in,
    $10 out).
- **Usage:** every call is logged to `learners/usage.jsonl`, across projects
  and never in a repository: time, project, feature, model, tokens in, out
  and cached, cost in US dollars, and the exercise. Spending is reported for
  this week (from Monday) by feature, model and exercise.
- **The budget** is `[teacher] weekly_budget`, default $10. There is a
  warning at 80%; at 100% calls are refused with the reason, until Monday.
- **The context assembler** (`context.ts`): named sections with token
  budgets, shortened at a break with a mark, grouped into system and user
  messages, with a report of exactly what was sent.
- **HTTP:** `GET` and `DELETE /api/teacher/ai`, `POST /api/teacher/ai/connect`,
  `GET /api/teacher/ai/callback`, and `POST /api/teacher/ai/check` (a
  ten-token request, logged as "check").
- **The Teacher page:** a "Models and spending" section: connect, check,
  disconnect; the week's spending against the budget, by feature, model and
  exercise; and the model for each job.
- **Checked:** unit tests against a fake OpenRouter (streaming split across
  chunks, usage, budget, errors, the key's file mode), HTTP tests (PKCE
  address, forged callback state), and `e2e/teacher.py` (3 more checks).
  It has not yet been tried with a real account: connect one on the Teacher
  page, then "Check the connection".
