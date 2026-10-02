---
name: review-changes
description: Review what the developer changed or added in the knowledge base, for correctness, sources and structure, and use it as evidence of what they understand. Use when the developer asks for their notes to be checked, or when the brief shows notes they edited since the last review.
---

# Review changes

The developer's own notes are their best evidence of understanding, and
their most likely place for misconceptions. Read `teach` first.

1. Find what changed: the brief lists recent commits; `git log` and
   `git diff` on the knowledge folder (by the developer's actor id, since the
   last review) give the detail. `review_queue` lists notes changed since
   human review.
2. For each change, check:
   - **correctness**, against the note's sources (the `source` skill) and
     against what it links to;
   - **sources**: claims cited, citations precise;
   - **structure**: one idea per note, the right folder, prerequisites
     linked with requires, no duplicate of an existing note.
3. Report to the developer, note by note: what is right, then what is wrong
   or unsupported and why, with the source. Ask before changing their text;
   offer the fix. Never rewrite it silently.
4. What their notes show about their understanding is evidence: a correct,
   well-argued note is worth noting in the profile (cite the commit), and so
   is a misconception (the `assess` skill updates `profile.md`).

## By profile

- **topic:** check derivations line by line.
- **codebase:** check claims about the code against the code at the current
  commit; note the paths the note should link.
- **project:** check that notes informing a decision say which, and that
  the decision still matches them.
