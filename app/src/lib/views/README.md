# views/

The map (`map.js`, `layout.js`, `layout-worker.js`) and the graph (`graph.js`),
ported from the old dashboard as they were: imperative d3 code that builds a
view's element, mounted by `components/Imperative.svelte`. They read the same
store as the rest of the app and keep the `rd:` performance measures, so the
benchmarks compare old and new. They are plain JavaScript (not type-checked)
until the renderer interface (platform B3) replaces the drawing code.

The grid Atlas (`gridmap.js`, with `grid/nested.js`, `grid/cells.js` and
`grid/router.js`; T62, T64) is drawn the same way and chosen with
`folders = "grid"`. A layout is plain data (`grid/nested.js` says what one
is), and the cells, the router and the drawing know nothing of how it was
made, so the layout can be replaced on its own.

Ask Atlas (`ask.js`, T85) is the box to ask from, the answer beside the map,
and the marks an answer leaves; `gridmap.js` draws the marks, so `ask.js`
knows nothing of where a note is.
