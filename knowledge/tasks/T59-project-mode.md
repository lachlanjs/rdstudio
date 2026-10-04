---
type: Task
title: "T59 — Project mode"
description: "Learning or Project per project: Project mode's spaces, the Activity and Health lenses, and the learning layer on top of a project."
tags: [task, m12, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T09:00:00Z }
---

# Prompt

Step 8 of the redesign; sketches ProjectToday, ProjectSpace, ProjectAtlasActivity, ProjectAtlasHealth.

# Outcome (2026-10-05)

The mode comes from the teacher's profile: `topic` is Learning, and
`codebase` or `project` is Project. It shows as the tag beside the
project's name.

- **Spaces:** Project mode has Today, Library, Atlas and Project, with
  Practice as the quiet link (on a phone: in the tab bar, and in More).
  Learning keeps Today, Library, Atlas and Practice, with Project quiet.
- **Today in project mode** (`ProjectToday.svelte`):
  - **Counters for the week in place of streaks**, each linking to its page:
    commits (with today's and the branch), reviews open, notes changed, and
    agent reports, then the last seven days of commits.
  - **Needs you:** the review queue, most pressing first: errors, proposals,
    notes changed since a person checked them, notes written by an agent,
    and broken links. Red marks only what is wrong (errors, broken links);
    the rest are plain tags.
  - **Continue where you left off.**
  - **The margin:** changed since you looked, the teacher's next step,
    Agents (recent reports), and Get up to speed (tours and your
    understanding).
  - **The learning layer on top:** Set for you (now a shared component,
    `SetsForYou.svelte`), reviews due, waiting for marking and goals appear
    whenever they hold something.
  - Today waits for the teacher's state, which says the mode, so it does not
    flash from one Today to the other.
- **The Atlas's height lenses:**
  - **Understanding:** where you stand, the learning default.
  - **Activity:** the project default. It is when each note last changed in
    git, or its file's time without git: this week, this month or this
    quarter, and 90 days untouched is fog. Its top state is a plain ring,
    because recent is not right.
  - **Health:** one step each for reviewed by a person, tested by an
    exercise, and current (neither its checks nor its content stale). The
    top state is a double green ring.
  - One lens shows at a time, and choosing the one shown again puts the
    terrain away. The key changes with the lens.
  - No north arrow and no north force in project mode. The map is drawn
    again once the mode is known.
- **Adapted from the brief:**
  - rdstudio sees git, not CI, so there are no checks to count; the fourth
    counter is notes changed.
  - "Agents running" is the agents' recent reports.
  - The Atlas maps notes, not code files, so Activity and Health are
    measured per note. Health's three facts are reviewed, tested by an
    exercise, and current, in place of the brief's test, review and note
    documenting a file.
- **Not done:**
  - Code files on the Atlas, with module regions and dependency routes.
  - The change in review as a numbered route.
  - A redesigned Project space: it is still the list of its pages.
- **Checked:** `e2e/teacher.py` (96) covers project mode's spaces, its Today
  and the Atlas on Activity without north. The fixture then returns to a
  topic for the learning checks. Every other walkthrough and suite passes.
