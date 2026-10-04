---
type: Task
title: "T53 — The shell: spaces, palette and You"
description: "The top bar with the project and its mode, the four spaces with Project as the quiet link, the command palette, and the You menu; routes moved out of the old tabs."
tags: [task, m12, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-05T09:00:00Z }
---

# Prompt

Step 2 of the redesign.

# Outcome (2026-10-05)

- **The top bar** (sketch MarginaliaToday):
  - **Left:** the wordmark (`rdstudio`, Ioskeley Mono bold), the project's
    name, and its mode as a bordered tag. The mode is Learning for a topic
    and Project otherwise, from the teacher's profile until projects say so
    themselves (T59).
  - **The spaces:** Today, Library, Atlas, Practice.
  - **Right:** Project as the quiet link (with the review count), the palette
    box ("Jump to a note or action ⌘K"), and You.
  - **Status:** shown only when there is something to say (offline, or sign
    in again). The live state is on the header as `data-live`.
- **Routes:**
  - `#/` is Today (the Learn page for now, rebuilt in T54) and `#/library` is
    the top folder.
  - Every other route belongs to a space: notes and folders to Library; the
    map, graph, paths and tours to Atlas; practice and the old `#/learn` to
    Practice; changes, review, reports, procedures and skills to Project;
    the teacher and settings to You.
  - `#/project` is a new landing page for the five.
  - Folder links to the top go to `#/library`.
- **The command palette:** ⌘K or Ctrl+K, or the box.
  - **With nothing typed:** the notes opened last, then every space and
    action.
  - **When typing:** names are matched by letters in order (whole words and
    early matches first), descriptions only when they contain what was
    typed. Actions include new note and folder, practise recall, and light
    or dark.
  - **Keys:** arrows and Enter, Esc to close.
- **The You menu:** Teacher, Settings, light/dark/system, full screen, and
  the live and learner-record status. On a phone it also holds Project.
- **Removed:** the GitHub highlight.js stylesheets, which overrode the
  brand's code colours.
- **The phone,** until T58's bottom tab bar: the wordmark, the project, the
  palette and You on one row, the spaces on the next, nothing scrolling
  sideways.
- **Checked:**
  - `e2e/teacher.py`, 6 more checks (89): the spaces, the palette by name and
    by action, Project, the You menu, light and dark;
  - every other walkthrough, updated for the new routes; the sign-in one
    reads `data-live`.
