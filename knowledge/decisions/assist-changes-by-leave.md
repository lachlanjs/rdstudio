---
type: Decision
title: Axis changes a note only where it is let, and only by suggestions
description: "One chat request replaces Ask, Rewrite and Write here: the model always answers, and
  proposes changes only in the forms it has been let use; the server drops the rest."
tags: [decision, editor, assist]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T00:58:07Z}
---

# Decision

In the editor there is one way to ask Axis, a chat turn. What it may change
is said with the turn, and is nothing unless said:

- a place set for new text (`<insert>`);
- a marked passage, when "Axis may change it" is ticked (`<passage>`);
- anywhere, when "Axis may edit anywhere in the note" is ticked: changes of
  its own choosing, each an exact text from the note and what replaces it
  (`<change>` with `<old>` and `<new>`).

The reply's form names only what is let, and the server enforces it: a
change in a form that was not let, or whose old text is not in the note in
exactly one place, is dropped and the reader is told. Every change is a
suggestion in the note, as in [the first design](/design/assist.md "uses").

Made by the agent on 2026-10-08 while building
[T98](/tasks/T98-edits-by-leave.md "see also") from the developer's request;
the developer asked for the three kinds of leave, not for this protocol.

# Why

- The developer asked to "specify if the agent is welcome to edit that
  selection": leave has to be off by default to mean anything.
- Exact text rather than line numbers or offsets: a model miscounts lines,
  and a wrong offset edits the wrong place silently. Text not found fails
  safe.
- Small changes rather than the whole note rewritten: each can be read and
  refused alone, and the reply is short.
- Enforced on the server, not trusted to the prompt.

# Assumption

Models copy a line or sentence from the note exactly often enough. If a
real model's changes are often dropped as not found, matching should be
loosened (it already ignores how lines are broken) or the form changed.

# Given up

Rewrite and Write here as single buttons.
