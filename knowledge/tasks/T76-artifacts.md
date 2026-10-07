---
type: Task
title: "T76 — Artifacts in the knowledge folders, and pictures: found, served sandboxed and offline,
  linked and embedded from notes"
description: "Step 1 of artifacts, with embeds and pictures: reports become artifacts, HTML files
  beside the notes that notes link to or show in place, served in a sandbox with no network;
  pictures are shown at 80% width, centred or left."
tags: [task, m13, artifacts, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T01:07:43Z}
---

# Prompt

The first step of [the artifacts scope](/design/artifacts.md), which the
developer agreed on 2026-10-07 ("Agree with the build order. Go ahead."),
adding the same day: "pictures directly linked or embedded in the markdown
should also be a feature - this should be treated the same way as an embed -
but with options to align the image to the left or in the center (should
have width of 80% of the document width)."

Embeds on the note page (the scope's step 3) came with this step, since the
frame that shows an artifact on its own page is the one that shows it in a
note.

# What was built

On the branch `feat/artifacts`.

- **The core** reads what a note cites besides notes
  (`packages/core/src/bundle.ts`, `Concept.cites`): a link or an embed
  (image syntax) to an `.html` file is an artifact, to a picture file an
  image, each with its rating or its place and whether the file is there.
  A bundle knows its files that are not Markdown (`Bundle.files`). Links to
  notes are untouched.
- **Artifacts** (`packages/cli/src/artifacts.ts`, replacing `reports.ts`):
  every `.html` in the knowledge folders (not `_draft.html`), with its head
  read (title, description, `rdstudio:date`, `author`, `aspect`, `network`),
  its size, the addresses elsewhere it would load, and the notes that cite
  it. Written to `data/artifacts.json`. An artifact's own links are never
  read.
- **Served** from `a/<path>`, never as written: the build puts first in its
  head a policy allowing only inline code and rdstudio's own files, and a
  bridge that tells the framing page its height, when it is ready and what
  went wrong, and takes the theme's colours. `vendor/…`, `report.css` and
  `report.js` are pointed at rdstudio's copies from any folder.
  `rdstudio serve` sends every artifact with `Content-Security-Policy:
  sandbox allow-scripts`, so it runs apart from the app even when opened on
  its own.
- **In the app** (`app/src/lib/artifactFrame.ts`): one frame, sandboxed to
  scripts. On its own page (`#/a/…`, with the notes that cite it) it fills
  the space; in a note it is as tall as its content, loads when it nears the
  screen, shows its caption, and when it errors or does not load says so in
  one line. One marked as needing the network is not loaded in a note until
  asked. The Reports page is the Artifacts page; the graph joins an artifact
  to the notes that cite it.
- **In a note:** `[title](x.html)` goes to the artifact's page;
  `![caption](x.html)` shows it. `![alt](pic.png)` is a picture at 80% of the
  text's width, centred; `![alt](pic.png "left")` puts it at the left.
- **The lint** (`rdstudio check --warnings`): an artifact with no title, over
  200 kB, loading an address elsewhere, or marked as needing the network; a
  cited file that is missing; and HTML left in an old `reports/` folder.
- **The skill** `report` is `artifact`, with the rules an agent must keep:
  one file, offline, no errors, light, the app's colours, sized by content.
  New projects get no `reports/` folder.

# Found on the way

- The report viewer framed a report with no sandbox, so its script ran with
  the app's rights. Gone with the viewer.
- Raw HTML files in the knowledge folders were already being copied to
  `data/k/` and served as they were. Artifacts are no longer copied there.

# Checks

- Unit: the core's cites (2); artifacts found, linted and prepared (3).
- Browser (`e2e/artifacts.py`, 16): the lint; the sandbox header and policy;
  an embed that draws on a canvas, loads KaTeX from `vendor/`, and responds
  to a slider; that it cannot reach the app's storage, page or API, nor the
  internet; its height, caption and colours; the line for one that errors;
  the button for one that needs the network; pictures left and centred at
  80%; the artifact's page and the list.
- All suites: core 207, CLI 116, app 48, Python 58; code 23, assist 14,
  edit 26.

# Not done here

- On the Atlas (the scope's step 2); embeds in the editor's preview; made
  from the editor with the checks (step 4); link controls (step 5).
- The Python package's `reports.py` is left as it was: the Python build
  already differs from the Node one (the code map), and is not what runs.
- A static export has the policy (it is in the file) but not the sandbox
  header; there is no token to protect there.
