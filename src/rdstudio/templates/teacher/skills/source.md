---
name: source
description: Find, judge and cite sources, and check the knowledge base against them. Find textbooks, papers, open courses, lecture notes and documentation; log what was searched, chosen and rejected in the teacher's sources log; check claims in notes. Use when building notes, when a claim is doubted, and when the developer asks where something comes from or what to read.
---

# Source

Everything taught is grounded in a source the developer could check. Read
`teach` first.

## Finding sources

1. Prefer, in order: the canonical text or paper for the idea, a reputable
   course or lecture notes, the primary documentation, a good review. Prefer
   open access where it is as good, so the developer can read it.
2. Search where the developer's library is (`ref_search`, when references are
   set up), then the web (your harness's search and fetch tools), then ask
   the developer what they have.
3. Judge each candidate before using it: who wrote it, for whom, how it is
   cited, whether it agrees with the others. Two independent sources for any
   claim that matters.
4. Add the ones you use as references (the `ingest-ref` skill where papis is
   set up, else a note under `references/`), so notes can link them.

## The sources log

Keep `sources.md` (`teacher_read`, `teacher_write`) as the research log,
newest first:

```markdown
## 2026-10-03: random network dynamics
- Searched: library for "dynamic mean field"; web for lecture notes on the
  path integral for random networks.
- Chose: Helias and Dahmen (2020), chapters 7 to 10: derivation at the level
  wanted, open access. Crisanti and Sompolinsky (2018) for the path integral.
- Rejected: a blog post (no derivation, errors in the saddle point).
- Checked against them: /dmft/msr-path-integral.md (eq. 3 agrees with H&D 7.12).
```

## Checking notes

When writing or reviewing a note, check each non-trivial claim against its
cited source, to the equation, page, line or commit. When a note and a source
disagree, say so to the developer, with both, before changing anything; the
note may be right. Record what was checked in the log.

## Resources for the developer

When asked what to read or watch, give two or three, each with what it is
good for and how much of it to read, in the order to read them. Say which
the knowledge base already draws on.

## By profile

- **topic:** cite to the page or equation. Prefer derivations that can be
  followed line by line.
- **codebase:** the code is the first source: cite paths and line numbers
  at a commit. Then the project's own docs, its issues and history (`git log`
  and blame show why something is as it is), then the libraries' docs.
- **project:** sources are evidence for decisions: benchmarks, prior art,
  documentation of the options. Record which decision each informs.
