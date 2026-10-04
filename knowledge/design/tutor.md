---
type: Design
title: "Work together: the tutor"
description: "The developer writes an answer with the teacher alongside: hints, feedback and discussion pinned to passages of the draft; the draft's history, so any response can be seen against the draft it answered; and the server-side teacher on OpenRouter that makes it possible, with its context and cost kept in check."
status: draft
tags: [design, learning, ai]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-04T10:00:00Z }
---

# Purpose

Marking says how an answer went once it is finished. A tutor helps while it
is being written. This is the first feature that needs a model on demand from
the dashboard. So it brings forward step 1 of [where the teacher
runs](/design/ai-providers.md): the server calls the model.

# Modes

The teacher answers only when asked: through a mode button, or by
highlighting a passage and asking. It never comments as the developer types.
That keeps the thinking theirs, and the cost bounded. Every response is pinned
to the passage of the draft it is about.

| Mode | Says | Colour | Draws on |
|---|---|---|---|
| **Hint** | the next step: two sentences at most, perhaps one word | none | the linked notes, the draft, the exercise's solution |
| **Feedback** | named aspects of the draft, each discussed; critical where wrong, positive where right, either possibly absent | red, green | the same, and the profile's relevant struggles |
| **Discuss** | an answer to the developer's prompt or highlighted passage, linking the parts of the draft it bears on | blue | the same |

**Hints climb a ladder.** Each "Hint" goes one rung further: a word, then a
direction, then the next step. Hints are part of the written answer: the
attempt carries them, with where in the draft each was given, so whoever marks
it sees which were used. There is no automatic cap; the marker judges.

**Smaller touches:**
- **Confidence before feedback:** unsure, fairly sure or sure, recorded so
  the profile can see calibration.
- **Discuss may answer with a question first** (switchable), and has an
  "explain it to me" variant in which the teacher plays a confused student.
- **A replay of the draft:** a scrubber under the answer shows how it grew,
  with the teacher's pins appearing where they were made.
- **The final marking** can refer to the session: "you fixed the point
  marked red at step 2".

# Drafts and history

How it works now:
- **Undo:** CodeMirror's history is in memory, per editor; it is lost on
  leaving the page.
- **Drafts:** answer boxes keep nothing until submitted.

What changes:
1. **Drafts persist.** An exercise answer in progress is saved as it is
   typed, privately in the teacher folder (`drafts/<exercise>.json`), and
   restored on return.
2. **Snapshots at teacher moments.** Each request to the teacher saves the
   draft exactly as sent. The response refers to that snapshot, and to
   character ranges in it.
3. **Restore.** Any response offers "show the draft as it was": beside the
   current draft, or restored. Restoring first snapshots the current draft, so
   a restore can be undone.
4. **Anchors follow edits.** While the page is open, CodeMirror maps each
   pin through the changes. After a reload, a pin is found again by its quoted
   text with a little context either side (the text-quote anchors of web
   annotation). A pin whose passage was deleted shows as "about text you
   removed", linked to its snapshot.

Keystroke undo stays CodeMirror's. Snapshots are taken only at teacher
moments, so the history stays small.

# The server-side teacher

- **Where:** `rdstudio serve` calls the model; the browser asks the server
  and the reply streams back. The key never reaches the browser.
- **Account:** OpenRouter. Connect it once from the Teacher page (OpenRouter's
  OAuth flow with PKCE hands over a key, kept in the user config) or set
  `OPENROUTER_API_KEY`.
- **Models by job,** changeable in settings: a fast, cheap model for hints;
  a strong one for feedback, discussion and marking.
- **Later:** the same endpoint serves the phone through the home server
  ([projects, accounts and sync](/design/projects-and-sync.md)).

## Context

Each request is assembled from parts, in order, each with a token budget:

1. the `teach` skill and the mode's instructions (cached);
2. the exercise: its problem and solution (cached per exercise);
3. the notes it tests, then their prerequisites, by outline and relevant
   sections, never the whole knowledge base;
4. the profile's struggles that touch these notes;
5. the draft as it is now, and what changed since the teacher last spoke;
6. this session's earlier turns, summarised once there are more than a few.

The assembly is a pure function in the core, so it can be tested. A "What
the teacher sees" panel shows exactly what was sent.

## Cost

- **Usage log:** every call goes to `teacher/usage.jsonl` (private, never in
  the learner record): time, feature (hint, feedback, discuss, marking, and
  each later one), model, tokens in, out and cached, cost (OpenRouter reports
  it), and the exercise.
- **Budget:** $10 a week by default (`[teacher] weekly_budget`). A warning
  at 80%; at 100% requests stop until the week turns over, with the reason
  said.
- **The Teacher page** shows spending this week, and by feature, exercise
  and model.
- **Keeping it down:** cheap models for hints, prompt caching on, a cap on
  the length of a discussion, and no requests the developer did not make.

# Order

Tasks in milestone M11:
1. [T48 Streaks](/tasks/T48-streaks.md), which need no model (see [streaks](/design/streaks.md)).
2. [T49 Drafts and history](/tasks/T49-drafts-and-history.md).
3. [T50 The server-side teacher](/tasks/T50-teacher-service.md): OpenRouter, context, usage and budget.
4. [T51 Work together](/tasks/T51-work-together.md): hint, then feedback, then discuss, with pins and replay.
