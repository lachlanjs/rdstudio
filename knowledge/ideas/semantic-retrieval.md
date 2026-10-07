---
type: Idea
title: "Semantic retrieval (RAG) beside keyword search: scope"
description: "A scope for finding notes by meaning with embeddings, as one more lookup tool beside
  keyword search: what it would add, how it could be built here, and what it would depend on."
tags: [idea, retrieval, assist, search]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:39:29Z}
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

# Scope agreed (2026-10-07)

Under [the decision](/decisions/semantic-search-local.md "requires"): local,
bundled, notes only, second to OKF search. This replaces the recommendation
above to start with OpenRouter. Sizes and speeds are estimates.

## What is built

- **The model:** `bge-small` (about 35 MB compressed), shipped in the
  package and the apps. Run through WebAssembly, so the same code works in
  Node, the desktop webview and a phone, with no native binaries. About
  10 MB of runtime.
- **What is embedded:** each section of each note, with the note's title
  and description before it.
- **The cache:** one file in the project's `.rdstudio/`, 1 to 3 MB, not in
  git. It records the model that made it. Each section is keyed by a
  fingerprint of its text.
- **The tool:** `find_similar` beside `search_notes` for Axis
  ([T84](/tasks/T84-assist-lookup.md "requires")), and the same for
  outside agents through the MCP server. Its description says when: after
  keyword search and links have not found what is needed. A step records
  that a note was found by meaning.
- **Text search of code without git:** a built-in file search, with git
  used where it is present.

## When a note is edited

- On save, only sections whose text changed are embedded again, in the
  background; the save does not wait.
- A changed title or description embeds the whole note again.
- A note moved or renamed costs nothing.
- Edits made outside the app (an agent, a pull, another editor) are caught
  before a search: fingerprints are compared and what is stale is embedded.
  Until then those sections are still found by keyword.
- Unsaved text is not embedded.
- A different model makes the whole cache again.

## Left out

- Code embeddings: later, as an optional extra for local builds.
- Language servers: not bundled; used if found installed, at some later
  point.
- Hosted embeddings: not needed under this scope.
- A local chat model: several gigabytes; Axis still calls a hosted model.

## Order

1. **A trial of the runtime** ([T87](/tasks/T87-embedding-runtime-trial.md "see also")): the model through WebAssembly in Node, timed
   on this base, and its size in the package. Everything else rests on it.
2. **The measure:** questions with the note that answers each, scored for
   keyword search alone and with search by meaning.
3. **The cache, the tool, and re-embedding on edit.**
4. **Ask Atlas's third colour,** for notes found by meaning.

[Ask Atlas](/ideas/ask-atlas.md "see also") itself does not wait for any of
this: its first version needs only the steps Axis already keeps.
