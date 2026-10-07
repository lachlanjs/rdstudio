---
type: Task
title: T82 — Rate several selected links at once
description: With two or more links selected in the editor, the link control counts them and one
  choice, or Alt+1, 2, 3 or 0, rates them all; no model is needed for it.
tags: [task, m13, editor, links, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T03:01:31Z}
---

# Prompt

From the developer, 2026-10-07: they wanted every link of the
[roadmap](/tasks/roadmap.md "see also") rated "see also", because unrated
they clutter the Atlas, and found the model slow, dear and unsure at it
([T81](/tasks/T81-assist-knows-the-format.md "uses")). Proposed by the agent
and agreed: a change this mechanical should need no model.

# Outcome

In `app/src/lib/editor/linkControl.ts`
([link controls](/design/link-controls.md "requires")):

- With a selection that wholly holds two or more links that can carry a
  rating (to a note, or to an artifact not shown in place), the control is
  for all of them. Its button reads "12 links, mixed", or the rating they
  share, and sits beside the last of them in sight.
- Its menu offers Requires, Uses, See also and Unrated for all of them.
  Alt+1, 2, 3 and 0 do the same at once.
- Only titles change. Web links, pictures and what is shown in place are
  left alone, and a link the selection cuts in two is left out.

Checked by a unit test (`editor.test.ts`) and three steps of the browser
walkthrough `e2e/artifacts.py` (29/29).

# Not done

- No such control on a phone, as for a single link.
- It does not reach across notes: one note at a time.
