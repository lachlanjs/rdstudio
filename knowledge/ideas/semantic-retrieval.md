---
type: Idea
title: "Semantic retrieval (RAG) beside keyword search: scope"
description: "A scope for finding notes by meaning with embeddings, as one more lookup tool beside
  keyword search: what it would add, how it could be built here, and what it would depend on."
tags: [idea, retrieval, assist, search]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:14:22Z}
---

# The idea

From the developer, 2026-10-07: "I would also like to scope RAG retrieval. It
might be the case that the note titles or frontmatter are not enough to
identify whether a note is likely to contain relevant information. RAG might
help in this case. Is this possible for this project? What dependencies would
it introduce?" Notes found this way would be shown apart from notes found by
the search tool ([Ask Atlas](/ideas/ask-atlas.md "see also")).

Not decided and not built. What follows is the agent's scope.

# What it would add

The search there is now (`SearchIndex`, BM25) already reads the whole body
of every note, not only titles and frontmatter, with titles, tags,
descriptions and headings weighted above body text. What it cannot do is
match by meaning: a question about "stopping the simulation blowing up"
does not find a note that only says "softened gravity". That gap, a note
that holds the answer in other words, is what embeddings close. How often it
bites here is not measured
([measuring the map](/ideas/measuring-the-map.md "see also")).

It would not replace [OKF's links and progressive reading](/design/okf-and-rag.md "uses"):
it is another way to find where to start.

# How it could be built

- **What is embedded:** each section of each note (a heading and what is
  under it), with the note's title and description put before it. That is
  the unit `read_note` already reads. The base today is about 150 notes and
  720 sections, about 512 000 characters.
- **Where the vectors are kept:** one file under `.rdstudio/` (not in git),
  keyed by a hash of each section's text, so only changed sections are
  embedded again. At 1024 numbers a section it is about 3 MB.
- **How it is searched:** every vector is compared (cosine) in memory. At
  this size that takes a millisecond or two; no vector database is needed
  until a base is a hundred times larger.
- **How the model uses it:** one more tool beside `search_notes`
  ([T84](/tasks/T84-assist-lookup.md "requires")), say `find_similar`,
  returning sections with the note, the heading and a score. A step records
  that it was found by meaning, which is what a different colour on the
  Atlas would show.
- **Code:** not at first. The repository's tracked files are about 16 MB,
  which is tens of thousands of chunks. If wanted, embed the code index's
  items (a function's signature and comment), not raw files.

# What it would depend on

Three ways to get embeddings, and what each brings:

| | Brings | Works offline | Cost |
|---|---|---|---|
| OpenRouter's embeddings endpoint | Nothing new: the account and client already there | No | About 0.2 US cents to embed the whole base once with `baai/bge-m3` (0.01 US dollars a million tokens, checked 2026-10-07); a query is a fraction of that |
| A model run locally in Node (`@huggingface/transformers` with `onnxruntime-node`) | A native dependency of tens of megabytes, and a model file of 25 to 90 MB fetched once | Yes, after the first fetch | None |
| Ollama, if the person has it | Nothing in rdstudio; a program the person must install and run | Yes | None |

The agent's recommendation: OpenRouter first. Axis already needs the
network and an account to answer at all, so a semantic search made on the
way to an answer adds no new requirement, and the first version adds no
dependency. The local model is for when search by meaning is wanted where
no model is called: the Library's search box, or the MCP server's `search`
for an outside agent.

# Things to settle

- **Privacy.** Embedding sends every note's text to the provider once.
  Asking Axis already sends what it reads, but not the whole base. It
  should be asked for, not done silently, and never done for the global
  base without being asked.
- **Whether it is needed.** Build the measure first: a set of questions
  with the note that answers each, scored for keyword search alone and with
  embeddings. If keyword search with a model rewording its own queries
  finds nearly everything, this is not worth its weight.
- **Staleness.** The file is a cache: it must be rebuilt for changed
  sections before a search, and that takes a network call.
