---
type: Design
title: How an agent uses the knowledge base, compared with RAG
description: Both put knowledge a model lacks in front of it; RAG retrieves chunks of existing
  documents by similarity before the model sees anything, while here the agent navigates notes
  written as knowledge, by search and links, and writes back.
tags: [design, agents, retrieval, okf]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T00:21:14Z}
---

# Why this note

The developer asked on 2026-10-07: "how would you say that this system using
OKF from the agent perspective is different to RAG? (I am not an expert on
RAG)." This is the agent's answer, from working in this repository through
the rdstudio MCP server. It is an account, not a measurement:
[measuring the map](/ideas/measuring-the-map.md) says how the difference
could be measured.

# What RAG is

Retrieval-augmented generation, as usually built:

1. Documents that already exist are cut into chunks of a few hundred words.
2. Each chunk is turned into a vector, a list of numbers that stands for its
   meaning.
3. When a question comes in, the chunks whose vectors lie nearest the
   question's are found.
4. Those chunks are put in the prompt, and the model answers from them.

# How this differs

| | Typical RAG | rdstudio with OKF |
|---|---|---|
| What is stored | Chunks of documents that already existed | Notes written to be knowledge: one idea each, with a type, a title and a one-line description |
| Structure | Mostly none; chunks stand alone | Links that say what they mean (requires, uses, see also), folders, and types such as Decision, Question and Task |
| How it is found | Nearness of meaning, by vector | Keyword search (BM25), then outlines and links |
| Who retrieves | A pipeline, before the model sees anything | The agent, step by step: search, an outline, one section, a link followed |
| Written back to | Usually not | Yes: decisions, findings and tasks are recorded as the work goes |
| Trust | Rarely tracked | Each note says who wrote it and when, whether a person verified it, and whether that has gone stale |
| Readable by a person | The index is not meant to be read | Plain Markdown in git: the same thing the developer reads and edits |

# What that means for the agent

- **It navigates; it is not handed things.** With RAG the model gets what
  the similarity search returned and cannot easily tell what is missing.
  Here it can see that a note requires three others and read them, or check
  whether a decision exists before proposing one. The server's own
  instruction is to retrieve progressively: search, outline, read a section
  ([the MCP server](/tasks/T08-mcp-server.md)).
- **The unit is a claim, not a fragment.** A chunk may begin in the middle
  of an argument. A note is written to stand alone, so a decision comes with
  its assumption and what would reopen it.
- **The knowledge accumulates.** What one session records, the next starts
  from, whether a person or an agent. An index over documents does not grow
  from the conversation.
- **What is read can be weighed.** A note an agent wrote three weeks ago and
  nobody verified deserves less confidence than one the developer verified
  yesterday, and the note says which it is
  ([conventions](/design/conventions.md),
  [staleness](/decisions/verification-staleness.md)).

# Where RAG is better

- **No curation.** It works over thousands of documents nobody has time to
  organise. The knowledge base helps only as far as its notes are written
  and kept current.
- **Loose matching.** Vector search finds a passage that says the same thing
  in other words. The search here is by keyword, so the agent has to guess
  the words that were used.
- **Scale.** Millions of chunks. A base kept by hand is realistically
  hundreds to a few thousand notes.

# They are not exclusive

- [The agent in the editor](/design/assist.md) is a small RAG pipeline over
  the base: the server searches the notes, gathers the linked ones and some
  code, and puts them in one prompt. No tools are handed to the model.
- An agent working through the MCP server is the navigating kind.
- Vector search could be added as one more way to find notes, keeping the
  links, types and trust fields that make a note worth finding. Not planned;
  [search](/design/architecture.md) is deterministic BM25 by design.
