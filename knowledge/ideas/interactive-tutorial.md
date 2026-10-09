---
type: Idea
title: An interactive tutorial on GitHub Pages, with exemplar knowledge bases and recorded AI answers
description: "A tutorial for rdstudio served as a static site: exemplar knowledge bases to explore,
  guided by tours, with the AI features answering from recordings in place of a model."
tags: [idea, tutorial, onboarding, static-export, tours, assist]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-09T00:26:05Z}
---

# The idea

From the developer, 2026-10-09: "How doable would it be to create an
interactive tutorial for rdstudio? Would it be possible to include
placeholders for the AI functionality and serve it on github pages with
some exemplar knowledge bases?"

# Notes from the agent

Not the developer's words: what exists to build on, what is missing, and a
shape for it. From reading how the export turns features off, not how the
exporter itself is built, so the later stages may be larger than they look.

## What exists

- **A static export that runs on GitHub Pages.** `rdstudio export` builds a
  snapshot that needs no server, and `.github/workflows/pages.yml`
  publishes this repository's own base on every push to `main`.
- **Tours** ([T25](/tasks/T25-tours.md)): a Markdown note listing stops
  with narration, followed on the Atlas from note to note. Most of a
  tutorial's walking is this.
- **Recorded answers that replay.** A kept Ask Atlas question plays again
  on the map, step by step ([T94](/tasks/T94-ask-history.md)), and so does
  a kept agent session ([T107](/tasks/T107-agent-path-live.md)). Neither
  needs a model to replay.
- **A generated test bed.** `bench/nanosim.py` makes a small codebase
  project with notes, which the browser checks use.

## What is missing

- **A snapshot turns the AI surfaces off.** Where `site.static` is set, the
  Axis panel, the tutor, editing and the learner record are hidden or
  disabled.
- **Recordings are not part of an export.** Kept questions, chats and
  sessions are in the private record, outside the repository.
- **A tour only walks notes.** It cannot say "open the Axis panel and ask
  this", or wait for something to be clicked.
- **No exemplar bases written to teach from.**

## Placeholders as recordings, not fakes

1. The real feature is run once, against a real model, on the exemplar.
2. What came back (the answer, the steps, the proposals) is saved as a
   file in the exemplar.
3. In the snapshot, a demo mode offers a fixed set of questions as
   buttons. Choosing one replays its recording in the real panel, with the
   real marks on the map.

Every answer shown is then one the tool gave. The same serves Axis beside
a note, proposals with Accept and Reject, and a terminal agent's path.

A box that answers any question typed into it is not possible without a
model, and the page should say so.

## What is harder

- **Editing, and accepting a proposal, in a snapshot.** There is no server
  to write to. Changes would live in the browser's memory and be lost on
  reload. The largest piece of new work.
- **The learner record.** Understanding, exercises and streaks need
  somewhere to be kept; the browser's own storage would do for a demo.
- **The exemplars themselves.** One for each of
  [the two targets](/decisions/two-targets-many-platforms.md): a learning
  project (a short topic, with exercises) and a codebase project. Writing
  them well is the work that decides whether the tutorial is any good, and
  it is writing, not code.

## A shape, in stages

1. Exemplar bases published on Pages, with guided tours. Nearly free, and
   useful by itself.
2. Recorded answers shipped with the export and replayed in a demo mode.
3. Editing in the browser and a learner record in the browser, so that
   exercises and proposals work.
4. Tutorial steps that wait for an action, beyond walking notes.

The agent's guess, given on 2026-10-09: about a week for a good first
version, stages 1 and 2.

## To decide

- Which topic the learning exemplar teaches, and which codebase the other
  describes (the nanosim test bed is to hand).
- Whether the tutorial is a mode of the app or a separate small site that
  embeds it.
- Whether recordings are made by hand and committed, or made again by a
  command when the exemplar changes (and then who pays for the model).
- Whether the exemplars live in this repository or in ones of their own.

# Where it stands

Not started. No tasks are written for it.
