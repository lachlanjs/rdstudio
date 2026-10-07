---
type: Design
status: draft
title: "Artifacts: HTML documents in the knowledge base, linked or embedded from notes"
description: "Scope for replacing reports with artifacts: self-contained HTML files beside the notes
  that do what Markdown cannot, shown on the Atlas, linked or embedded from notes, made by the agent
  from the editor, sandboxed, offline, and checked for errors and weight before they are offered."
tags: [design, artifacts, editor, atlas, agents, scope]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T01:07:43Z}
---

# What the developer asked for

On 2026-10-07, in three messages:

- "I also want to change what 'reports' are. Instead I want them to be
  called 'artifacts'. These should be pure HTML documents which have
  functionality beyond what the usual markdown notes can provide. They
  should appear in the Atlas and be linkable *from* regular nodes. Artifacts
  cannot link back to regular nodes."
- They live "inside the knowledge folders - as long as this does not
  conflict heavily with the OKF spec. it would be nice if they worked well
  with the folder-based Atlas functionality." Everything that was a report
  becomes an artifact. Links from an artifact back to notes "should just not
  be considered for the OKF's purposes or the Atlas ... technically they
  could href back, but this just won't be acknowledged in the rest of the
  app."
- The scenario: "if I were in the middle of editing some note, and then saw
  an opportunity for a useful visualisation which I couldn't do in a mermaid
  chart or in the markdown format, so I could highlight the text the
  visualisation should be about and ask the agent to produce an artifact for
  it and link it in the document below."
- Embeds are in scope. "It is important that the agent ensures that
  embedded artifacts do not error and are lightweight enough that they do
  not slow down the experience too much."
- "Whatever the artifacts do, it must work locally with no connection to
  the internet. OR: We could add a tag to artifacts which need internet
  access by necessity."

This is a scope, not yet built. Decision:
[artifacts replace reports](/decisions/artifacts.md).

# What an artifact is

- **One self-contained `.html` file** in any folder of the knowledge base,
  beside the notes. Its title, description, author and date are `<title>`
  and `<meta name="rdstudio:…">` tags in its head, as reports had.
- **Not an OKF concept.** The spec calls a bundle "a directory tree of
  markdown files" and forbids nothing else, so another OKF tool ignores the
  file. It is not listed in `index.md`, has no frontmatter and no trust
  fields. (If strict conformance is ever wanted, a note with the spec's
  `resource` field can describe one. Not required.)
- **Cited from notes, two ways,** both ordinary Markdown:
  - a link, `[title](figure.html)`: the note points at it, and it opens as a
    page of its own;
  - an embed, `![caption](figure.html)`: the same file shown in the note.
    Another viewer shows a broken image or a link; nothing is lost.
- **Its own links are not read.** An artifact may hold any `href`. Search,
  the link graph, the lint and the Atlas never look inside one. It has no
  links out, as far as the rest of the app knows.
- **On the Atlas** it is an item of its folder, with a shape of its own,
  joined to the notes that cite it by their links (a note that cites it
  "uses" it, unless the link says otherwise). Since nothing leads out of an
  artifact, it sits at the late end of its folder's layout.

# What it can do that a note cannot

Tested on 2026-10-07, in Chromium.

**A note today** is Markdown rendered with footnotes, maths (KaTeX), code
colouring (highlight.js), Mermaid diagrams, tables, images, and raw HTML
passed through a sanitiser (DOMPurify). What survives the sanitiser:

| In a note | Kept | Stripped |
|---|---|---|
| Drawing | static inline SVG, images | SVG animation (`<animate>`) |
| Style | `style` attributes | `<style>` blocks, so no CSS animation or hover rules |
| Controls | `<details>`, and inputs, sliders and selects as inert shapes | every script and event handler, so no control does anything |
| Other | an empty `<canvas>`, `<video>` | `<iframe>` |

So a note can show a fixed picture, a fixed diagram, and one fold-out. It
cannot respond to anything.

**An artifact**, in a frame with scripts allowed and nothing else, with a
policy that allows no network:

| Tried in the sandbox | Result |
|---|---|
| Canvas drawing | works |
| WebGL (3D) | works |
| Computation in script (3 million square roots) | 7 ms |
| Animation frames | work |
| Pointer and keyboard events | work |
| Web Audio | available |
| The app's storage (the write token) | blocked |
| The app's page | blocked |
| The internet | blocked |
| Other files on rdstudio's own server | blocked by the policy |
| Workers | blocked by the policy as tested; can be allowed |

So an artifact can be: an interactive plot (pan, zoom, hover, brush); a
figure with sliders that recomputes as they move; a simulation or an
animation that plays, pauses and steps; a 3D object to turn; a sortable,
filterable table; a small calculator or worked example with inputs; a
diagram that steps through a process. All from one file, with no server.

# Offline

- An artifact is served with a policy (`Content-Security-Policy`) allowing
  inline script and style, and scripts, styles, fonts and images from
  rdstudio's own vendored libraries (KaTeX, Vega-Lite, Mermaid today; d3 to
  add), and nothing from anywhere else. Offline is enforced, not asked for.
- Data goes in the file. A sandboxed frame cannot read a sibling data file.
- **The tag for the exception:** `<meta name="rdstudio:network"
  content="required">`. A tagged artifact is served with the network
  allowed, is marked wherever it is listed, is never loaded on its own in a
  note (a click loads it), and `rdstudio check` lists it. An artifact that
  reaches for the network without the tag simply fails to, and the check
  reports the address.

# Safety

- Every artifact is shown in a frame sandboxed to scripts only: it cannot
  read the app's page, its storage or the write token.
- **A hole to close in the first step:** the report viewer today frames a
  report with no sandbox at all (and reaches into it to rewire its links),
  so a report's script runs with the app's own rights.
  [T10](/tasks/T10-reports.md) says "sandboxed"; the code is not.

# Embeds

One artifact, two presentations: nothing new to define beyond the image
syntax above.

- **Height:** the frame is as tall as its content. A few lines of script
  that rdstudio adds when serving an artifact report its height to the page,
  so there are no scroll bars inside a note. An artifact may ask for a fixed
  shape instead (`<meta name="rdstudio:aspect" content="16/9">`).
- **Theme:** the page passes its colours and light or dark as CSS variables
  (`--surface`, `--text`, the pens), and again when they change, so an embed
  is not a white box in a dark note.
- **Loading:** a frame is made when it nears the screen and dropped when
  far off it; at most a few are live at once.
- **In the editor:** the live preview shows the embed as a block, as it does
  a diagram; the source view shows the Markdown.

# Not erroring, and staying light

The developer's requirement: the agent must make sure an embedded artifact
does not error and is light enough not to slow the note. Three guards, the
first being the agent's own duty.

1. **Before an artifact is offered** (when the agent has just written one):
   the editor loads it in a hidden sandboxed frame with a probe that reports
   back any error (uncaught errors, rejected promises, `console.error`),
   how long it took to be ready, and whether it keeps the processor busy
   when nothing is happening. Limits, to start with:
   - no errors at all;
   - the file under 200 KB (vendored libraries not counted);
   - ready within half a second;
   - idle when untouched: no animation running until asked for, and paused
     when off screen.
   If it fails, what failed is given back to the agent to fix, up to twice.
   If it still fails it is not offered, and the person is told why. A
   preview is shown before anything is saved.
2. **In the lint** (`rdstudio check`): an artifact's size, any address
   outside the vendored libraries (unless tagged), a missing title, and an
   embed in a note whose file is missing.
3. **On the page:** an embed that errors or takes too long shows a plain
   line ("This figure did not load") with its link, and never breaks the
   note round it.

The agent is told all of this in its instructions for writing an artifact:
one file, no network, vendored libraries only, the theme's variables, no
work until asked, nothing in the console.

# Made from the editor

A third action beside Ask and Write here
([an agent in the editor](/design/assist.md)): **Make a figure** (the name
to settle). With a passage selected, or a request typed:

1. The model is given what a text request is given (the note, linked and
   found notes, code by name), plus the instructions above.
2. It replies with the file, a title, and a one-line caption.
3. The editor runs the checks, shows a preview, and, if accepted, saves the
   file in the note's folder under a name from its title and puts the embed
   (or link) below the passage as a suggestion.
4. The note's stamp names the model, as for accepted text.

# Reports become artifacts

- `reports/` and the Reports page go; the Project space lists artifacts.
- The `report` skill becomes `artifact`: an agent's write-up of its work is
  an artifact, in a folder of the base (by default beside the task it
  reports on, cited from the task's Outcome).
- Routes `#/r/…` become `#/a/…`; `[paths] reports` in `rdstudio.toml` is
  read for a release, then dropped. This repository has no reports to move.
- The Python package's `reports.py` and its fixtures change with it.

# Order of work

1. Artifacts in knowledge folders: found, listed, served sandboxed with the
   policy; reports renamed; links from notes recognised; the lint.
2. On the Atlas and in the graph.
3. Embeds on the note page and in the editor's preview.
4. Made from the editor, with the checks.
5. [Link controls in the editor](/design/link-controls.md), which is where
   a link is turned into an embed and back.

# Open

- Whether an artifact embedded in exactly one note should be left off the
  Atlas as part of that note.
- Whether an artifact may be edited after it is made (by asking the agent
  to change it), and how its history is shown.
- The limits above are guesses until tried on real figures.

# Pictures

Added by the developer on 2026-10-07: "pictures directly linked or embedded
in the markdown should also be a feature - this should be treated the same
way as an embed - but with options to align the image to the left or in the
center (should have width of 80% of the document width)."

- `![alt](pic.png)` shows the picture at 80% of the text's width, centred.
- `![alt](pic.png "left")` puts it at the left. The title is the place
  (`left`, `center`), not a tooltip.
- `[text](pic.png)` is a link to the file.
- A picture is a file in the knowledge folders like an artifact, cited the
  same way, and a missing one is a broken link in the lint.
- The [link control](/design/link-controls.md) sets link or embed, and left
  or centre, as it does for an artifact.

# Progress

- Step 1, with embeds on the note page and pictures:
  [T76](/tasks/T76-artifacts.md), done.
