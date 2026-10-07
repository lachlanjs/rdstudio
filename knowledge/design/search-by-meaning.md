---
type: Design
title: Search by meaning
description: Notes are found by what they say, in other words than theirs, with a small model that
  ships with rdstudio and runs on the device; a second tool beside keyword search, for Axis and for
  outside agents.
tags: [design, retrieval, assist, mcp]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T04:24:14Z}
---

# What it is

As built in [T89](/tasks/T89-find-similar.md "see also"), under
[the decision](/decisions/semantic-search-local.md "requires") and
[the scope](/ideas/semantic-retrieval.md "uses"). The numbers behind it are
in [the trial](/tasks/T87-embedding-runtime-trial.md "uses") and
[the measure](/tasks/T88-retrieval-measure.md "uses").

A tool, `find_similar`, takes a question or a sentence and returns the
notes nearest to it in meaning, each with its nearest section and a figure
from 0 to 1 for how alike. Nothing is sent anywhere.

# Who has it

- Axis, in the editor and on the Atlas: one more
  [lookup tool](/decisions/assist-looks-things-up.md "uses"), listed after
  `search_notes`. The instructions call it second: for when keyword search
  and the links of the notes in hand have not found what is needed.
- Outside agents, through the MCP server, as `find_similar`. Project base
  only, not the global one.
- It is offered only where the model is installed. `RDSTUDIO_EMBED=off`
  switches it off.

# The model

`bge-small-en-v1.5`, 8-bit quantised (34 MB, MIT licence), run by
`onnxruntime-web`'s WebAssembly build on one thread, with
`@huggingface/tokenizers`. No native binary. English only.

- In the npm package the model and the runtime's binary sit in `embed/`
  beside the command line. The package grows by 49 MB on disk.
- In a checkout the model is not in git: `mise run embed:model` fetches it
  into `packages/cli/models/`, pinned to one revision and checked against
  its SHA-256. `mise run setup` does this too.

# What is embedded

Each note is cut at its first- and second-level headings. A section over
1800 characters is cut again at its paragraphs, so that none is longer than
the model reads. Each piece is embedded with the note's title and
description before it.

# The cache

`.rdstudio/embeddings.json` in the project, not in git. It names the model.
Each vector is 384 bytes, kept under a fingerprint of the text it was made
from. This base: 665 pieces, 0.36 MB.

| What happens | What is embedded again |
|---|---|
| One section edited | That section |
| Title or description changed | The whole note |
| Note moved or renamed | Nothing |
| Note deleted | Nothing; its vectors are dropped |
| Another model | Everything |

# When it is made

- `rdstudio serve` starts a pass in another process when it starts and
  after every save. The save does not wait.
- Before a search, pieces with no vector are counted. Twelve or fewer are
  embedded there and then, so an edit made by another program is seen. More
  are left to the background, the search answers from what there is, and
  its reply says how many sections are not yet covered.
- With nothing embedded yet, the tool says it is being prepared and to use
  keyword search.
- A first pass of a hundred pieces or more is shared among up to four
  processes. This base: 87 s on one, 25 s on four.

# Limits

- Not in the Python wheel: the bundled command line there has no model
  beside it, so the tool is absent.
- Not tested in WebKit, and not yet run in the app itself: the desktop and
  phone apps do not exist yet.
- Code is not embedded
  ([left for later](/decisions/semantic-search-local.md "see also")).
- A high figure is not proof. The tool's reply says to read a note before
  resting on it.

# Where it lives

`packages/cli/src/embed.ts`, the tool in `lookup.ts` and `mcp.ts`,
`packages/cli/scripts/embed-model.ts`, `bench/retrieval/`.
