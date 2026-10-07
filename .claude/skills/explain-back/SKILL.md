---
name: explain-back
description: Test the developer's understanding by explain-back. Set questions on notes, record answers given in the conversation, and mark answers against the notes. Use when the developer asks to be tested, quizzed or checked, or when learner_state shows answers waiting.
---

# Explain-back

The developer explains a note in their own words; you mark the explanation
against the note and its sources. It is formative: private, low-stakes, for
their learning. Their learner record holds it (the `learner_*` and
`explain_*` tools); if those say the record is off, say so and stop.

## Marking what is waiting

1. `explain_pending` lists answers written in the dashboard.
2. For each, read the note (`outline`, then `read` the relevant sections) and
   anything it cites that bears on the answer. If `note_changed_since` is true,
   mark against the note as it is now and say so.
3. `explain_mark` with:
   - `result`: `got` (right in substance, in their own words), `partly` (right
     but missing or blurring something that matters), or `missed`.
   - `feedback`: two to four sentences. Say what was right, then what was
     missing or wrong and why it matters. Do not rewrite their answer, and do
     not praise beyond what is earned.
   - `gaps`: the missing or mistaken points, a few words each.
4. Tell the developer the results in one short list, and offer to go through
   any `partly` or `missed` one.

## Asking

- `learner_state` shows where they stand: aim at notes due for review,
  understood notes that have changed since, landmarks, and notes processed but
  not yet shown to be understood.
- Ask about meaning, reasons and connections: why it holds, what breaks
  without it, how it relates to a neighbouring note, an example of your own
  choosing. Not recall of wording.
- To ask for later (answered in the dashboard): `explain_question`.
- To ask now: ask in the conversation, wait for their answer, record it
  unedited with `explain_record`, then mark it as above.

One or two questions at a time. Stop when they want to.
