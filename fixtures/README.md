# Conformance fixtures

The contract every implementation of rdstudio's OKF core keeps: the Python
core today, the Rust core (T35 to T37) next, and any other reader of OKF
bundles that wants to agree with them.

- `bundles/`: small OKF bundles, each a knowledge folder's contents.
  - `basics`: frontmatter, every form of link, trust and staleness, headings,
    a log, a non-Markdown file.
  - `order`: `requires`, `uses` and `see also` ratings in their spellings, a
    requires cycle, reading order and depth, a rated folder link.
  - `edge`: a byte order mark, CRLF line endings, broken and missing
    frontmatter, index and log rules, YAML 1.1 quirks, Unicode names.
  - `markdown`: link and heading syntax where simple patterns and a Markdown
    parser disagree (see Known differences).
  - `synthetic`: 63 generated notes (`bench/synth.py subject`), shaped like a
    real subject.
- `queries.json`: search queries run against each bundle.
- `learner/`: two devices' learner records, with repeats, unreadable lines and
  events from before ids; `expected/learner.json` is each as read, and merged.
- `expected/<bundle>.json`: what the core computes, from `expected.py`.

## Use

```sh
uv run python fixtures/expected.py            # does the Python core still agree?
uv run python fixtures/expected.py --update   # record again, then review the diff
```

`tests/test_conformance.py` runs the check with the other tests;
`packages/core/test/conformance.test.ts` checks the TypeScript core against the
same files. `fixtures/agree.py` (`mise run core:agree <folders>`) compares the
two cores on any real bundle.

## What is compared

For each note: path, folder, title (from the file name when missing), type,
description, tags, status, frontmatter as JSON, trust, when it was generated and
last checked by a person, whether that check is stale and whether it is past
`stale_after`, a hash of its body, headings (level, text, slug, line), links
(target, kind, broken, rating), backlinks, direct and transitive prerequisites,
reading order and depth. For the bundle: the folders, lint issues by code
(the wording is free), requires cycles, the generated `index.md` of every
folder, and search results (id, score to 3 places, snippet).

Nothing depends on the clock or file times: `stale_after` dates are far in the
past or future.

## Decisions the fixtures pin down

Decided in T35 (2026-09-29), after T34 found the first core reading Markdown
and YAML by pattern:

- **Links and headings come from a CommonMark parser** (markdown-it, in both
  the Python and TypeScript cores, and the dashboard renders with it). No link
  in code, after an escaped bracket or in an image; nested brackets and
  parentheses in targets work; indented and setext headings count
  (`markdown/`). The links of a note are every link in order, then each
  reference definition that no link used.
- **Frontmatter is YAML 1.2** (core schema): `yes`, `on` and `NO` are text,
  `010` is ten, `1:30` is text, and dates stay as written
  (`edge/yaml-quirks.md`). Dates are read by one pattern: `YYYY-MM-DD`,
  optionally with a time, seconds, fraction and an offset; no offset is UTC.
- **Values as text** (titles, types, tags): `true`/`false`, whole-number
  floats without `.0`, and nulls dropped from tag lists.

Neither changed anything in the two real bundles (differential geometry and
this repository's own).
