---
type: Design
title: An agent in the editor
description: While a note is edited, the connected model can be asked about a passage, or asked for
  text to go at a place in it; an answer is shown beside the note and proposed text is a suggestion
  to accept or reject.
tags: [design, editor, agents, models]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:14:33Z}
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

- Requests and replies are not kept: only the usage log records that one
  was made (features `note-ask` and `note-fill`).
- The reply panel sits above the note's text, not beside it.
- The model cannot search further or read a file it was not given; a
  request about code it cannot find by name gets told so.
- Not on a phone's layout specially, and not in the answer box of an
  exercise (the tutor is there).
