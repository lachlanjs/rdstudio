---
type: Idea
title: Distribution, funding and naming
description: Self-hosting by default under MIT, optional paid convenience or donations, the user always free to bring their own AI, and name candidates for an agentic harness for learning.
tags: [strategy, naming, proposal]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-29T01:14:28Z }
---

# Position

rdstudio is heading towards an **agentic harness for learning**: coding
harnesses loop over a codebase with tests; this loops over a person's
understanding, with the knowledge map as the specification, exercises as the
tests, and the learner record as the state. AI tutors exist (conversational
study modes in the major assistants), but none keeps a persistent map of a
subject and of what the learner knows, kept current as agents change the
territory.

# Decided

- **MIT licence.**
- **Courses free.**
- **Bring your own AI, always:** any harness or model the user pays for or
  hosts themselves.

# Options for funding (not yet decided)

| Option | For | Against |
|---|---|---|
| Donations (GitHub Sponsors, Open Collective) | simple; matches bring-your-own-AI | rarely sustains a project without a large audience |
| Paid convenience, free self-hosting (the Obsidian model: free app, paid sync and publish) | proven for local-first Markdown tools | needs a hosted service to run and support |
| Hosted AI included | the easiest start for non-technical learners | inference is the main cost; prices must cover heavy users |

No financial case has been made yet; the [platform](/design/platform.md) work
keeps every option open (portable formats, a sync design that can be hosted,
end-to-end encryption for the record).

# Names

Candidates: `par` (understanding on par with output), `ken` (range of
understanding), `cog` (cognition), `tele` (telepathy).

- `cog`: short, but "a cog in the machine" is the opposite of the message,
  and Replicate's Cog is well known in AI tooling, so searches collide.
- `tele`: reads as "distance" (telephone, television) more than telepathy,
  and is a common prefix, so hard to search or claim.

Check for any candidate: package names (PyPI, crates.io, npm), app stores, a
domain, and trademarks in software.

# Marketing

The developer's view: in the AI age, marketing decides which tool wins, and
it is still very human. Assets this project has: the map is visual and demos
well; the [autoethnography](/ideas/learning/autoethnography.md) is evidence and
a story at once; learning in public (a devlog of learning TypeScript with the tool)
markets the tool while testing it.
