---
name: artifact
description: Write an artifact — an HTML page kept beside the notes that does what Markdown cannot (an interactive figure, a simulation, a sortable table, a write-up with charts). Use after substantial work, or when a note needs something to look at or play with.
---

# Write an artifact

An artifact is one self-contained HTML file in a folder of the knowledge
base, beside the notes. A note links to it, `[title](file.html)`, or shows it
in place, `![caption](file.html)`. It appears on the Atlas in its folder.

Use one when Markdown is not enough: something that responds (sliders, a
plot to pan and hover, an animation to play and step, a 3D object to turn, a
table to sort), or a write-up of work with charts and maths. For a fixed
diagram use a Mermaid block in the note; for a fixed picture, an image.

## Where and how

1. Copy `.claude/skills/artifact/template.html` to the folder of the note it
   belongs with, as `<short-slug>.html`. A write-up of a task goes beside the
   task.
2. Fill in the `<title>`, and the `<meta name="rdstudio:...">` tags (date,
   author as your actor id) and the description.
3. Write the body.
4. **Cite it from a note**, or nobody will find it: an embed where it should
   be seen, or a link (a task's Outcome links its write-up).

## Rules

- **One file.** Script, style and data go inside it. It cannot read a file
  beside it.
- **Offline.** It is served with a policy that blocks the network. Use only
  the libraries rdstudio ships, by these addresses, which work from any
  folder:
  - `vendor/katex/katex.min.js`, `vendor/katex/auto-render.min.js`,
    `vendor/katex/katex.min.css` (maths)
  - `vendor/vega/vega.min.js`, `vendor/vega/vega-lite.min.js`,
    `vendor/vega/vega-embed.min.js` (charts)
  - `report.css` and `report.js` (the page style, and maths and charts
    rendered for you, as in the template)
  If it truly cannot work without the network, say so in its head,
  `<meta name="rdstudio:network" content="required">`: it is then marked, and
  is not loaded in a note until asked for. Avoid this.
- **No errors.** Nothing uncaught, nothing in `console.error`. An artifact
  that errors shows a warning line in the note that embeds it. Load it and
  try every control before you offer it.
- **Light.** Under 200 kB. Ready within half a second. Do no work until
  asked: an animation starts when played, not on load, and stops when
  finished. A note may embed several.
- **The app's colours.** Use the CSS variables the page is given, with a
  fallback: `var(--surface, #fff)`, `--surface-1` to `--surface-3`,
  `--text`, `--text-soft`, `--text-faint`, `--rule`, `--rule-strong`,
  `--pen-red`, `--pen-green`, `--pen-blue`, `--font-text`, `--font-ui`,
  `--font-mono`. It then follows light and dark, and the theme.
- **Sized by its content** when embedded: no fixed page height, no inner
  scroll bars. For a fixed shape say `<meta name="rdstudio:aspect"
  content="16/9">`.
- **Its links are not read.** It may link anywhere, but nothing in rdstudio
  follows a link out of an artifact: not search, not the Atlas, not the
  lint. If a note should be connected to it, the note cites the artifact.
- It runs in a sandbox: no access to the app, its storage, or other files.

## A write-up of work

Structure it for a reader who was not watching:

- **Summary**: two to four sentences on what was done and the result.
- **What changed**: files, notes, decisions.
- **Results**: figures, tables, charts, with honest caveats.
- **Deviations and issues**: anything that did not go to plan.
- **For you to do**: what the developer should check, test or decide.

Maths: `\( ... \)` inline and `\[ ... \]` display. Charts: a Vega-Lite spec in
`<script type="application/json" class="vega-lite">`, with its data inline
under `data.values`. Diagrams: `<pre class="mermaid">`.

## Check

`rdstudio check --warnings` lists an artifact that has no title, is too
heavy, or reaches for the network.
