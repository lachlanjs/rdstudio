# views/

The map (`map.js`, `layout.js`, `layout-worker.js`) and the graph (`graph.js`),
ported from the old dashboard as they were: imperative d3 code that builds a
view's element, mounted by `components/Imperative.svelte`. They read the same
store as the rest of the app and keep the `rd:` performance measures, so the
benchmarks compare old and new. They are plain JavaScript (not type-checked)
until the renderer interface (platform B3) replaces the drawing code.
