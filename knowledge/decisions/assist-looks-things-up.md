---
type: Decision
title: Axis in the editor looks things up for itself, with tools, and is handed nothing in advance
description: The editor's agent gets the note and read-only tools over the knowledge base and the
  code, the same search, outline and section reads the MCP server gives; nothing is gathered for it
  beforehand.
tags: [assist, retrieval, tools]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:13:33Z}
---

# Decision

The developer, 2026-10-07: "are we able to get the openrouter models to use
the MCP functionality to search the OKF instead of just straight feeding it
the first six linked notes? I feel like it would be more effective to give it
instructions for how to tool call and get it to retreive that context for
itself if needed". The agent agreed and proposed the shape below; they said
"Sounds good."

- The model is sent the fixed instructions, the note with the place marked,
  and the titles and descriptions of the notes it links to. Nothing else.
- It may call read-only tools before it replies: `search_notes`,
  `outline_note`, `read_note`, `search_code`, `read_code`. They run inside
  `rdstudio serve` on the project's own base and on files git tracks.
- Rounds of looking up are capped by [tier](/decisions/model-tiers.md "uses"):
  3, 6 and 8. After the last it must reply.
- Each call is kept as a step, with how the note was reached (a search, a
  read, a link from a note already in hand). The reply's "Drew on" is what
  it opened.
- A model that cannot call tools is given what was gathered before this
  decision (linked notes, a search's finds, code by name), in one call.

Built in [T84](/tasks/T84-assist-lookup.md "see also"). It replaces the
gathering described in [an agent in the editor](/design/assist.md "see also").

# Assumption

What a request needs cannot be told before the model has read it. Shown on
2026-10-07: asked to re-rate the roadmap's links, the gathering sent T01 to
T06, five notes found by searching the roadmap's own text and ten code
snippets, about two thirds of the request, none of it of use
([T81](/tasks/T81-assist-knows-the-format.md "see also")).

It also rests on the models in use calling tools well. Tried once for real
on the low tier (`anthropic/claude-haiku-4.5`): it searched, read and
followed a link sensibly, and on a second question stopped one read short
and said the note in hand did not have the answer.

# Alternatives considered

- **Keep gathering, but less.** Search from the request and not the
  selection; no code unless asked. Still a guess made before the request is
  understood.
- **Embeddings (RAG) in place of tools.** A different way of guessing; see
  [semantic retrieval](/ideas/semantic-retrieval.md "see also"), scoped as a
  further tool and not a replacement.
- **The MCP server itself, over its protocol.** The same functions are in
  the same process; a protocol between them adds nothing.

# Reopen if

- Requests that need looking up become slow enough to put people off: each
  round is a round trip.
- Small models are seen to skip lookups they needed, or to search badly,
  often enough that answers at the low tier cannot be trusted.
