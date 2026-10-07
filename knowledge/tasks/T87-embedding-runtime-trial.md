---
type: Task
title: "T87 — Trial: a small embedding model through WebAssembly"
description: Run the bundled embedding model in Node through WebAssembly on this base, and measure
  its speed and what it adds to the package, before anything is built on it.
tags: [task, m14, retrieval, trial, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T04:11:56Z}
---

# Prompt

Step 1 of the agreed scope for
[semantic retrieval](/ideas/semantic-retrieval.md "requires")
([decision](/decisions/semantic-search-local.md "requires")). Every size and
speed in the scope is an estimate; this replaces them with measurements.

# Plan

- `bge-small` through WebAssembly in Node, with no native binary.
- Time to embed this base's sections once, and one query.
- What the model and the runtime add to the installed package.
- Whether the same code loads in a browser, as the desktop and phone apps
  would run it.

# Acceptance

Numbers recorded here, and a yes or no on the scope's assumption that this
is fast and small enough on every platform.

# Result

2026-10-07, on the developer's machine (20 threads, Node 24), this base:
164 notes cut at their headings into 607 sections, 135,000 tokens.

`bge-small-en-v1.5`, the 8-bit quantised ONNX file, run by
`onnxruntime-web`'s WebAssembly build, with `@huggingface/tokenizers` (plain
JavaScript). No native binary was loaded.

## Speed

| Where | Threads | One query | One section | The whole base |
|---|---|---|---|---|
| Node | 1 | 11 ms | 132 ms | 80 s |
| Chromium | 1 | 7 ms | 248 ms (longer sample) | not run |
| Chromium | 4 | 4 ms | 70 ms | about 45 s, scaled |
| Chromium, CPU slowed 4 times | 1 | 28 ms | 1.0 s | about 10 min, scaled |

- Loading the model takes 0.2 to 0.3 s (1 s on the slowed CPU).
- The unquantised file (133 MB) was 1.7 times slower in Node and is not
  needed.
- Memory while embedding: about 360 MB more than before loading.
- The browser rows embedded 40 longer passages, so their per-section times
  are not like for like with Node's; the whole-base figures are scaled from
  tokens a second.

## Size

| Part | On disk | Gzipped |
|---|---|---|
| Model | 34.0 MB | 24.3 MB |
| Runtime (`.wasm`) | 14.3 MB | 3.7 MB |
| Tokenizer's vocabulary | 0.7 MB | 0.2 MB |
| Runtime and tokenizer code | 0.1 MB | under 0.1 MB |
| Total | 49 MB | 28 MB |

Today the bundled command line is 2.2 MB and the app 11 MB, so the package
would grow about five times.

The cache for this base: 0.9 MB as 32-bit floats, 0.2 MB as bytes.

## What did not work, or was not tried

- More than one thread in Node: the web build tries to fetch its worker
  and fails. The runtime also has to be handed its `.wasm` file as bytes in
  Node. Several threads would need its other loader, or one session in each
  of several worker threads.
- WebKit, which the desktop app on macOS and Linux and the phone app on iOS
  would use, was not tested: only Chromium is installed here.
- Threads in a browser need the page to be cross-origin isolated (two
  response headers).
- 57 of the 607 sections are longer than the model's 512 tokens and were
  cut. Long sections should be split further.

## Answer

Yes, with one correction to the scope.

- Small enough: 28 MB compressed, against the scope's guess of 45.
- A query is fast everywhere tried.
- An edit is fast: one to a few sections.
- The first pass over a base is not instant: over a minute on a desktop
  with one thread, and some minutes on a phone. It must run in the
  background with search by meaning unavailable until it finishes, which
  the scope already assumed for edits but not for the first pass.

Whether it is worth building is [T88](/tasks/T88-retrieval-measure.md "see also")'s question.
