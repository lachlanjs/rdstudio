---
type: Design
title: Conventions
description: How rdstudio uses OKF fields, actor names, concept types, tasks, reports and procedures.
tags: [conventions, okf]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-23T04:55:51Z }
---

The [OKF spec](/references/okf-spec.md) is ground truth
([decision](/decisions/okf-ground-truth.md)). These conventions only choose
among what OKF allows.

# Actors

- Humans: `human:<id>` (e.g. `human:lachlan`), configured in `rdstudio.toml`.
- Agents: `<harness>/<model>` (e.g. `claude-code/claude-opus-5-5`).
- Tools: `process:rdstudio`.

# Provenance and verification

- `generated: { by, at }` is updated on every **significant** edit, since OKF
  defines `generated.at` as the last meaningful change. Minor edits (typos,
  dictated one-line additions) leave it unchanged.
- `verified` is appended to by humans (`rdstudio verify <path>`).
- A human verification whose latest `at` precedes `generated.at` is shown as
  **stale** in the Review tab ([decision](/decisions/verification-staleness.md)).

# Concept types (starting vocabulary)

`Overview`, `Design`, `Decision`, `Question`, `Task`, `Roadmap`,
`Procedure`, `Reference`, `Research`, `Experiment`, `Idea`, `Policy`.
Unknown types are always tolerated.

# Tasks

`type: Task`, with state carried in `tags` (`todo`, `active`, `done`,
`dropped`) plus a milestone tag. Body sections: `# Prompt`, `# Plan`,
`# Acceptance`, `# Outcome` (outcome links to the HTML report, if any).

# Decisions and questions

`type: Decision` with sections `# Decision`, `# Assumption`, `# Reopen if`.
`type: Question` with `# Question` and, once answered, `# Answer`
(`tags: [open]` or `[answered]`).

# Reports

HTML files in `reports/`, outside the bundle
([decision](/decisions/reports-html.md)). Metadata in the document head:

```html
<meta name="rdstudio:type" content="Report">
<meta name="rdstudio:date" content="2026-09-23">
<meta name="rdstudio:author" content="claude-code/claude-opus-5-5">
```

Links into knowledge use `/knowledge/<path>.md`; they become one-way graph edges.

# Procedures

`type: Procedure` concepts carry a procedural graph in frontmatter
([decision](/decisions/procedural-graphs.md)):

```yaml
nodes:
  - { id: add, label: papis add by DOI }
  - { id: rename, label: Rename citekey }
edges:
  - from: add
    to: rename
    relation: LEADS_TO          # LEADS_TO | TRIGGERS | PROVIDES_INPUT_FOR | CONVERGES_TO
    condition: entry was created
    guidance: follow author2020short convention
    pitfalls: papis auto-generates a non-conforming key
```
