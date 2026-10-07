---
type: Design
title: An agent in the editor
description: While a note is edited, the connected model can be asked about a passage, or asked for
  text to go at a place in it; an answer is shown beside the note and proposed text is a suggestion
  to accept or reject.
tags: [design, editor, agents, models]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T01:53:31Z}
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

A bar under the formatting bar, shown when a model account is connected (when
none is, a line saying where to connect one): a box to type in, and two
buttons.

- **Ask:** about the selection, or the question typed. The answer appears
  under the bar, rendered, with the model, the cost and what it drew on.
  Nothing in the note changes.
- **Write here** (at the cursor), or **Rewrite** (with a passage selected):
  the text proposed appears in the note as a suggestion. What it would
  replace is struck through; the new text follows it, a phrase in the line
  or a block below it, with Accept and Reject. Ctrl+Enter accepts and Esc
  rejects. One suggestion at a time; it keeps its place as the note is
  edited round it.
- Accepting puts the text in the editor. It is then the person's to edit,
  and is saved when they save, like anything typed. A block (several lines,
  or a code fence) is set off from the text round it by a blank line.
- Stop ends a reply being written.

# What the model is given

Worked out by `rdstudio serve` for each request (`packages/cli/src/assist.ts`
`prepare`); no tools are handed to the model, so a request is one call.

- **How notes work here** (`FORMAT`,
  [T81](/tasks/T81-assist-knows-the-format.md "see also")): the forms the
  app reads in a note and what it makes of them. A link's rating is its
  title (`"requires"`, `"uses"`, `"see also"`), with a worked example and
  what the Atlas does with each; artifacts and pictures, linked or shown in
  place; checklists, maths, diagrams, footnotes. And a rule: asked to change
  the form of something, change only that. Without it the model read "make
  this a see also link" as words to write in the text.
- **The note as it is in the editor**, saved or not, with the place marked:
  a passage between ⟦ and ⟧, or the point ⟦HERE⟧. A long note is cut to a
  window round the place; the marked passage itself is never cut, and one
  over 40 000 characters is refused for a rewrite.
- **The notes it links to** (up to six), by bundle-absolute or relative
  link, with or without a rating.
- **Notes found by searching the base** (up to five) for the request, the
  passage, the text round the place and the note's title.
- **Code**, found by the names in the request and the passage (what is in
  backticks, and words that look like identifiers or paths):
  - from [the code index](/design/code-map.md) where there is one: the
    item's signature, its comment and its source;
  - and by searching the repository's files (`git grep`, outside the
    knowledge base), with the lines round each hit, a definition first. This
    finds code in any language, which the index does not.
  With no name given, the index is searched by the request's words only
  when the request is about code.
- How to help, and the form of the reply. A fill replies with the text
  between `<insert>` tags and a sentence or two on why between `<why>` tags.
  Its room grows with the passage, so a whole note can come back; a reply
  cut short proposes nothing.

Each section has a budget of tokens and is shortened to fit
([context](/design/tutor.md)). The model for an answer is the `discuss`
job's; for proposed text, a new job, `write` (`[teacher.models]`).

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

- Requests and replies are not kept: only the usage log records that one
  was made (features `note-ask` and `note-fill`).
- The reply panel sits above the note's text, not beside it.
- The model cannot search further or read a file it was not given; a
  request about code it cannot find by name gets told so.
- Not on a phone's layout specially, and not in the answer box of an
  exercise (the tutor is there).
