---
type: Task
title: "T97 — Chats with Axis about a note: follow-ups, cost, kept and deleted"
description: "Asking Axis in the editor is a chat: each turn goes on from the ones before, shows
  what it cost, and is kept in the learner record; the chats about a note are listed in the panel,
  opened again, gone on from and deleted there."
tags: [task, m15, editor, assist, learner, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T00:57:47Z}
---

# Prompt

The developer, 2026-10-08: "The previous chat threads should be shown in the
input area and follow up questions should be a feature. The same cost and
tokens details should also be available. Chat history should be stored. ...
previous chats should be deletable through the UI - both for the 'Ask Atlas'
feature and the note editing feature."

# Plan

1. One request, mode `chat`, in place of `ask` and `fill`
   (`packages/cli/src/assist.ts`): it answers, and may propose changes
   ([T98](/tasks/T98-edits-by-leave.md "requires")). The client sends the
   turns before (question and answer, the last eight); they go between the
   fixed part and the note as it is now.
2. Each turn is kept (`packages/cli/src/assistchats.ts`) in the learner
   record under `assist/chats/`, one JSON file a chat, as with
   [Ask Atlas](/decisions/ask-atlas-keeps-questions.md "uses"). A change is
   kept as the text it replaced and the text proposed, not as offsets.
3. `GET /api/assist/chats?note=`, `GET` and `DELETE /api/assist/chats/{id}`.
4. The panel ([T96](/tasks/T96-axis-beside-the-note.md "requires")): with no
   chat open, the chats about this note; a chat as its turns, each question
   a quotation; under it, outside what scrolls, the last turn's price,
   tokens in and out, tier and model, and opened, the breakdown and the
   chat's total.
5. Deleting asks first, here and on the Atlas.

# Acceptance

- A second question is sent with the first and its answer.
- After a reload the chat is listed, opens with its turns, and a question
  asked there is added to the same file.
- Deleting one removes its file; refusing the question removes nothing.

# Done

2026-10-08, on `feat/axis-panel`.

- All of the plan. The Atlas already had a delete on each kept question and
  on an open one; both now ask first, and are labelled Delete.
- Not kept where the learner record is off: the panel says so, and a chat
  still goes on from its turns while it is open.
- Checks: 3 unit tests (server), `e2e/assist.py`.

# Limits

- A follow-up carries the earlier questions and answers, not what was
  looked up for them.
- Chats are found by the note's id: a note moved or renamed leaves its
  chats behind (still in the record, not listed).
- A figure is not part of the chat and is not kept.
- An earlier chat's proposed changes are shown to read; they cannot be
  applied again from there.
- Not tried against a real model.
