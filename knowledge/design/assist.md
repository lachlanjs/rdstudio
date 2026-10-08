---
type: Design
title: An agent in the editor
description: While a note is edited, the connected model can be asked about a passage, or asked for
  text to go at a place in it; an answer is shown beside the note and proposed text is a suggestion
  to accept or reject.
tags: [design, editor, agents, models]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T00:58:21Z}
---

# Why

From [the idea](/ideas/project-agent-features.md): when writing a note, to be
able to highlight some text and ask an agent for insight on it, or ask it to
fill in text, for example "find relevant code and insert it in the document
in a specified location". It mirrors the tutor's feedback on an exercise
([tutor](/design/tutor.md)), but on notes, in any project. Built in
[T74](/tasks/T74-agent-in-editor.md).

# What the developer chose

Asked on 2026-10-07, before it was built:

- **Proposed text is a suggestion**, shown in the note to accept, edit or
  reject. Not inserted directly, and not kept to the margin.
- **The model may look at notes and code.**
- **Provenance: the stamp only.** The note's `generated` stamp names the
  model; accepting a suggestion is otherwise the person's own edit, so
  verification is not disturbed beyond what any edit of theirs would do.
- **Everywhere notes are edited**, in Learning and Project mode alike.

"The connected LLM" is the OpenRouter account connected on the Teacher page,
with its weekly budget and usage log ([models](/design/ai-providers.md)).

# In the editor

Since [T96](/tasks/T96-axis-beside-the-note.md "see also") Axis is in a
panel beside the note, opened by "Axis" on the editing bar: to the right
where the frame is at least 900 px wide and wider than tall, below the note
otherwise, as on [the Atlas](/design/ask-atlas.md "see also"). It folds, and
is resized by dragging its edge. The note's details are no longer beside
it: they are a dropdown under the note's title. When no model account is
connected the panel says where to connect one.

The panel holds a chat about the note
([T97](/tasks/T97-note-chats.md "see also")):

- **The question** is written at the foot of the panel in the note editor's
  live preview (maths, links to notes). Ctrl+Enter or Ask sends it.
- **Each turn** shows the question as a quotation, the answer, any changes
  proposed, what was looked up and what was drawn on. A further question
  goes on from the turns before.
- **What it cost** is under the chat and does not scroll away: the last
  turn's price, tokens in and out, tier and model; opened, the tokens read
  from the cache, the calls, the lookups by kind, and the chat's total.
- **Chats are kept** in the learner record and listed in the panel when no
  chat is open; one can be opened, gone on from, or deleted (it asks first).

What a turn is about and what it may change
([T98](/tasks/T98-edits-by-leave.md "see also"),
[the decision](/decisions/assist-changes-by-leave.md "requires")):

- **A passage:** text selected in the note while the panel is open is
  marked as what the question is about, and stays marked when the cursor
  moves on. It is read only unless "Axis may change it" is ticked.
- **A place for new text:** "Put new text at the cursor" marks a point,
  apart from the passage.
- **Anywhere:** with "Axis may edit anywhere in the note" ticked, the model
  chooses where to add, reword or delete.

Every change is a suggestion in the note. What it would replace is struck
through and the new text follows it, a phrase in the line or a block below
it, with Accept and Reject; the same pair is in the panel, with Accept all
and Reject all when there are several. Ctrl+Enter in the note accepts the
one the cursor is nearest and Esc rejects it. Suggestions keep their places
as the note is edited. Accepted text is the person's to edit and is saved
when they save. Asking again rejects what was still waiting.

**Figure** has an artifact made for the marked passage, as before
([T78](/tasks/T78-figure-from-editor.md "see also")); it is shown in the panel and is
not part of the chat. Stop ends a reply being written.

# What the model is given

Worked out by `rdstudio serve` for each request (`packages/cli/src/assist.ts`
`prepare` and `ask`). The model
[looks things up for itself](/decisions/assist-looks-things-up.md "requires")
([T84](/tasks/T84-assist-lookup.md "see also")); nothing is gathered for it.

Sent at the start:

- **How to help**, and **how notes work here** (`FORMAT`,
  [T81](/tasks/T81-assist-knows-the-format.md "see also")): the forms the
  app reads in a note. A link's rating is its title (`"requires"`,
  `"uses"`, `"see also"`), with a worked example and what the Atlas does
  with each; artifacts and pictures; checklists, maths, diagrams,
  footnotes. And a rule: asked to change the form of something, change only
  that.
- **Looking things up**: when to use the tools and when not to (a change of
  form or wording needs nothing looked up), and how many rounds it has.
- **The form of the reply.** A fill replies with the text between
  `<insert>` tags and a sentence or two on why between `<why>` tags. Its
  room grows with the passage, so a whole note can come back; a reply cut
  short proposes nothing.
- **The notes this one links to**, as titles and descriptions only.
- **The note as it is in the editor**, saved or not, with the place marked:
  a passage between ⟦ and ⟧, or the point ⟦HERE⟧. A long note is cut to a
  window round the place; the marked passage itself is never cut, and one
  over 40 000 characters is refused for a rewrite.

The tools (`packages/cli/src/lookup.ts`), all read-only:

| Tool | Gives |
|---|---|
| `search_notes` | Notes by keyword: id, title, type, description, a snippet |
| `outline_note` | A note's headings, what it links to and what links to it |
| `read_note` | One section, or the whole note, up to 8000 characters |
| `search_code` | Lines of the repository's files holding an exact text |
| `read_code` | Lines of one file git tracks, 200 at most |

They are the MCP server's `search`, `outline` and `read`, in the same
process, on the project's own base. The model calls them in rounds, 3, 6 or
8 by [tier](/decisions/model-tiers.md "uses"), and must then reply. Each
call is kept as a step: what was looked up, the note opened, and how it was
reached (a search, a read, or a link from a note already in hand). The
steps stream to the editor as they happen and are listed under the reply;
"Drew on" is what it opened.

A model that cannot call tools is given, in one call, what was gathered
before T84: the first six linked notes, five found by searching, and code
found by the names in the request.

The model is the tier's (`[teacher.tiers]`). The fixed part and the note
are marked for the provider's cache, so a further round pays little for
them.

# Provenance

A save that carries accepted text says which models wrote it
(`assist` in the save). The note's stamp then names them beside the person:
`generated.by: human:lachlan with openrouter/anthropic/claude-sonnet-5.5`.

- Whether the edit is significant is judged as for any edit by a person
  ([conventions](/design/conventions.md)). A significant one moves the
  stamp's time, as it would have anyway.
- A small one leaves the time alone, so a verification is not made stale,
  but the model is still added to `by`.

# Not kept, not done

- A follow-up carries the earlier questions and answers, not what was
  looked up for them.
- Chats are found by the note's id, so a note moved or renamed leaves its
  chats unlisted. They are not kept where the learner record is off.
- A figure is not kept.
- A change is offered only if the text it replaces is in the note in
  exactly one place; otherwise it is dropped and said.
- Not tried on a real phone, and not in the answer box of an exercise (the
  tutor is there).
