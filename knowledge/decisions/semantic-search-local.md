---
type: Decision
title: Search by meaning is local, bundled, for notes only, and second to OKF search
description: Embeddings for notes run on the device with a small model shipped in rdstudio; code
  embeddings are left for later as an optional extra; the agent uses search by meaning only where
  keyword search and links fall short.
tags: [retrieval, search, assist, platform]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:39:29Z}
---

# Decision

The developer, 2026-10-07:

- "I want to make as much local and bundled as possible to limit the amount
  of setup required of the user."
- "Let's scope this and leave the code based embeddings / search as a future
  feature. Perhaps I could make it an optional extra install for local
  builds."
- "The main thing I want to achieve before bothering with code RAG is the
  'Ask Atlas' feature, as well as being able to add RAG as a secondary
  search option for the general agent in instances where OKF isn't cutting
  it."

So:

1. **Local and bundled.** One small embedding model ships inside rdstudio
   and runs on the device: no download, account or install for search.
2. **Notes only.** Code is not embedded. If it is later, it is an optional
   extra for local builds, not part of the bundle.
3. **Second to OKF search.** Keyword search, outlines, section reads and
   links stay the first way in. Search by meaning is a further tool for
   when they do not find what is needed.
4. **[Ask Atlas](/ideas/ask-atlas.md "see also") comes before any code
   retrieval.**

The scope is in [semantic retrieval](/ideas/semantic-retrieval.md "see also").

# Assumption

- On a base of this size (about 150 notes, 720 sections) a small local
  model finds the right section nearly as often as a large hosted one,
  because the model reads what is found and keyword search runs beside it.
  Not measured here: the scope's first step is the measure.
- A model of about 35 MB run through WebAssembly is fast enough on every
  platform, a phone included. Estimated, not tried.
- A documented project's notes say in words what its code is for, so code
  is reached through notes and text search without embedding it.

# Alternatives considered

- **Hosted embeddings (OpenRouter).** No bundle cost, but needs the network
  and sends every note's text out once.
- **A larger local model.** Somewhat better, too heavy for a phone, and a
  query must be embedded by the model that made the stored vectors, so the
  smallest device sets the model for all.
- **A language server for code.** Exact, but cannot be bundled or run on a
  phone; left as something rdstudio may use where it finds one installed.

# Reopen if

- The measure shows the small model missing sections a larger one finds,
  often enough to matter.
- The bundle's added size (about 50 MB estimated) or the phone's time to
  embed a base proves unacceptable.
- Projects with thin notes need code found by what it does.
