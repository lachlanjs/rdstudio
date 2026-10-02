---
type: Task
title: "T29 — Catching up on change"
description: "What changed in each note since you last looked, from git history and the hashes in your record; notes going stale when their sources change."
tags: [task, m8, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T09:20:35Z }
---

# Prompt

For the papis and rdstudio trials, where agents change the territory.

# Outcome (2026-10-02)

- **Changed since you looked.** Your last look at a note is the last event
  about it that carries its version (opening, marking, an exercise,
  explain-back, a tour stop). When the note's version now differs, it has
  changed meaningfully since. Its page says so at the head ("Changed since
  you last looked (3 days ago)", compared with the look before this visit),
  and Show what changed lists the commits since and a diff of the note then
  against now, uncommitted edits included, renames followed
  (`GET /api/history/{id}?since=`, `historySince` in `gitlog.ts`). Without git
  it says there is no history to compare with.
- **Prerequisites that moved.** A note you worked through or understood
  says when a note it requires was meaningfully edited after you did
  (its `generated` time against your state's), naming them.
- **Learn tab:** Changed since you looked lists both, the notes you worked
  through or understood first; opening a note counts as looking.
- Gap-widening alerts ("7 agent commits touched X since you last reviewed
  it") are covered by the commit list on the note; a count on the Learn tab
  is left for when the papis trial shows it is wanted.
- Checked: unit tests for the history (commits, the diff, uncommitted edits,
  a rename, no git), and `e2e/learn.py` (5 more checks).
