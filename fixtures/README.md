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
- `expected/<bundle>.json`: what the core computes, from `expected.py`.

## Use

```sh
uv run python fixtures/expected.py            # does the Python core still agree?
uv run python fixtures/expected.py --update   # record again, then review the diff
```

`tests/test_conformance.py` runs the check with the other tests. Another
implementation builds the same JSON (the shape is `snapshot()` in
`expected.py`) and compares it field by field.

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

## Known differences (to decide in T35)

The expected output records what the Python core does today. Where that is
arguably wrong, the Rust core should do the right thing and the Python core be
changed to match, with the fixtures recorded again.

- **Links are found by pattern, not by a Markdown parser.** `markdown/links.md`:
  a link after an escaped bracket (`\[not a link](…)`), inside double-backtick
  code and inside an indented code block are counted; a label with nested
  brackets and a target with parentheses are missed.
- **Headings are found by pattern.** `markdown/headings.md`: headings indented
  by up to three spaces and setext headings (underlined with `===`) are missed.
- **YAML 1.1.** PyYAML reads `yes`, `no`, `on` and `off` (any case) as booleans,
  `010` as octal 8 and `1:30` as 90 (`edge/yaml-quirks.md`). YAML 1.2, which
  most Rust parsers follow, reads them as strings and 10. The OKF spec names no
  YAML version; 1.2's core schema is the likely choice.
