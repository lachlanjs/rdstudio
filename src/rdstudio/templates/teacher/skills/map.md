---
name: map
description: Build and repair the map of what depends on what. Write goals as Goal notes, add notes and prerequisites (including ones found missing later), link them with requires, mark landmarks, and keep the knowledge base's structure fit for learning. Use when starting to learn something, after a diagnostic finds gaps, and when the developer asks what something builds on.
---

# Map

You shape the knowledge base so it can be learnt from: notes small enough to
master one at a time, linked by what each needs first. Read `teach` first.

## Goals

A goal is an outcome stated so it can be checked: "derive X and solve it
numerically", "change the parser without breaking the round trip", "decide
between A and B on evidence". Write one as a note (`record`, `type: Goal`)
whose body says the outcome, how it will be checked, and links each note it
needs with the title "requires":

    Needs [Self-consistent autocorrelation](/dmft/autocorrelation.md "requires").

Propose goals to the developer before writing them. Each goal gets exercises
(the `exercise` skill); without any, it can never be met.

## Notes and their order

1. Survey what exists (`list_concepts`, `search`) before adding anything.
2. One idea per note. A note someone could understand in one sitting, with
   its prerequisites already understood.
3. Link prerequisites with the title "requires": only what is genuinely
   needed first. Use "uses" for a weaker dependence and "see also" for a
   neighbour. `study_path` shows the chain; keep it free of cycles
   (`rdstudio check` reports them).
4. Mark the few notes worth knowing by heart with `landmark: true`.
5. Every note cites its sources (the `source` skill). A note you cannot
   source is marked `status: draft` and says what is unsourced.

## Conventions

Keep one note of the knowledge base's conventions (`conventions.md` at the
top, `landmark: true`): notation, units, sign and normalisation choices, and
where they differ from the main sources. Notes and exercises then use them
without restating them. When a source uses another convention, say so in
the note that cites it.

## Filling a gap found later

When `assess` (or a marked answer) shows a missing prerequisite:

1. Write the note, sourced, in the folder where it belongs by subject (not
   in a "gaps" folder).
2. Link it as "requires" from the notes that need it.
3. Say in one sentence near its top why it was added if that helps the
   developer find their way ("Added when the cavity argument needed it.");
   the profile records the gap itself, with the evidence.
4. Give it an exercise if it is worth checking.

## Folders

Folders are regions of the map: group notes a learner would study together.
Suggest moving notes (the dashboard's Move keeps links working) rather than
duplicating them.

## By profile

- **topic:** follow the subject's own order (a good textbook's chapter
  structure is evidence of it), but split chapters into notes.
- **codebase:** notes follow the code's architecture: one per module or
  mechanism, linking the source paths they describe, so a change to the code
  shows which notes to check. Prerequisites are often concepts outside the
  code (a protocol, a library's model): give those notes too.
- **project:** notes are the knowledge the decisions rest on; link each to
  the decisions that need it, and the decisions to their notes.
