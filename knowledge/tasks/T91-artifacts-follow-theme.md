---
type: Task
title: T91 — Artifacts follow the chosen theme
description: An artifact is shown in the app's theme and in light or dark, with its type and its
  charts, from its first paint and when the setting changes.
tags: [task, m14, artifacts, theme, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T05:00:23Z}
---

# Prompt

From the developer, 2026-10-07: "Can you ensure that artifacts follow the
selected theme?"

# What was wrong

An [artifact](/design/artifacts.md "requires") runs in a sandbox, so it is
another origin to the app. Four things followed from that or sat beside it:

- The template's script read the theme from the app's storage, which a
  sandboxed page cannot open. It failed quietly and loaded no theme.
- The template's stylesheet imported `themes/studio.css`, a file that no
  longer exists. So the names it styles with (`--paper`, `--ink`,
  `--accent`, `--text-size`) were never defined.
- The theme's fonts were refused: a sandboxed page asking for a font is a
  cross-origin request, and the server sent no header allowing it.
- No chart of the template's was ever drawn. Vega compiles expressions as
  functions, and the artifact's content policy forbade that.

The frame did send fifteen colour and font variables by message, so an
artifact written without the template was roughly right, and one written
with it was not.

# Done

2026-10-07.

- `report.css` imports both theme files, as the app loads them.
- The frame tells the artifact which theme and whether light or dark: in
  the address it is framed at, so the first paint is right, and by message
  whenever either changes. The bridge sets `data-theme` and `data-mode` on
  the artifact's page.
- `report.js` no longer reads storage. It draws charts once the
  stylesheets are in, and again when the theme changes.
- Font files are served with `Access-Control-Allow-Origin: *`. Fonts only.
- The artifact policy allows `'unsafe-eval'` for scripts. An artifact's own
  inline script could already do anything that allows, and the network
  stays blocked.
- A few more variables are sent (`--line`, `--radius`, `--text-size`,
  `--font-map`, the pens' soft tones).

Checked in `e2e/artifacts.py` (33 checks): a template artifact in Station
light matches the app's surface, text, type and chart colours; it follows a
change to Marginalia dark while open; an artifact without the template
gets the colours as variables.

# Not done

- An artifact opened on its own, outside the app, has no frame to tell it
  the theme: it shows Marginalia, dark.
- Station's rules for headings and controls live in the app's stylesheet
  and are not applied inside an artifact: it gets Station's colours,
  corners and type.
- Mermaid diagrams in an artifact are not drawn again when the theme
  changes while it is open.
- The exported static site was not checked.

# A second cause, the same day

The developer sent a snapshot of the M14 write-up shown bare: no page
style, no chart, the browser's default type. It could not be reproduced in
Chromium or Firefox (Firefox was installed to try), where it is themed.

The likely cause, not confirmed: WebKit. An artifact is sandboxed, and its
content policy allowed rdstudio's own files as `'self'`. To WebKit a
sandboxed page's `'self'` is no origin, so the stylesheet, the theme files
and the libraries were all refused. WebKit could not be run on this machine
(it needs system libraries), so this rests on its known behaviour and on
the snapshot matching it.

Changed: the policy now also names the server the artifact came from. Only
the page knows that address (it may be a tunnel's), so its first script
writes the policy; a short policy that needs no address is in the file as
well. Checked in Chromium and Firefox: the write-up is styled, its chart is
drawn, and a fetch and an image from elsewhere are still refused.

If the snapshot was not WebKit, or it still shows bare there, this is not
fixed and needs looking at on that device.
