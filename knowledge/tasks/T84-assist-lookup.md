---
type: Task
title: T84 — Axis in the editor looks things up with tools
description: The editor's agent is given read-only tools over the knowledge base and the code and
  calls them in rounds; what it looked up is kept as steps and shown.
tags: [task, m13, assist, retrieval, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:13:33Z}
---

# Prompt

Applying [the decision](/decisions/assist-looks-things-up.md "requires").

# Outcome

- `packages/cli/src/lookup.ts` (new): the five tools as OpenRouter takes
  them (`TOOLS`), and `Lookup`, which runs a call and keeps a `Step`: the
  tool, a line for the person (`said`), the notes named, the note opened,
  the note in hand that links to it (`from`, a step along a chain), the file
  and line, and an excerpt. A note's id is read however the model writes it.
  Code is read only from files `git ls-files` lists, and code searches leave
  the knowledge base out.
- `packages/cli/src/models.ts`: `complete` offers `tools`, reads calls that
  arrive in pieces, and carries `assistant` turns with calls and `tool`
  results in the conversation.
- `packages/cli/src/assist.ts`: `prepare` is lean unless `gather` is asked
  for; `LOOKUP` tells the model when to look and when not to; `ask` runs the
  rounds (`ROUNDS` by tier), falls back to gathering for a model that cannot
  call tools, and returns `steps`. Two cache marks only: Anthropic takes
  four at most, and five were refused.
- `rdstudio serve` streams a `step` event for each lookup. The editor lists
  them while it works, and under the reply as "Looked up n things", with
  the link a note was reached by.

Measured on the roadmap request of [T81](/tasks/T81-assist-knows-the-format.md "see also"):
what is sent first fell from about 9300 estimated tokens to about 3000.

Checked: five unit tests with a fake model that calls tools
(`assist.test.ts`, 126 in the suite), `e2e/assist.py` (29/29) and
`e2e/edit.py` (26/26). Tried twice for real at the low tier, at about one
and two and a half US cents: the calls, their results and the cache all
worked.

# Not done

- The developer's roadmap request has not been tried on it.
- Tool results are not cached between rounds, only the fixed part and the
  note.
- The base is loaded once for a request: a note saved while the model is
  looking is not seen.
- No tool reads an artifact or a reference's text.
- Global knowledge is never searched: it is private, and nothing asks the
  person first.
