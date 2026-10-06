// The grid Atlas's layout (T64): each folder is laid out on its own as a
// layered DAG of its items, and is then one item in its parent's.
//
//   Items     A folder's notes, and its subfolders, each already laid out and
//             now a single block. A link belongs to the lowest folder holding
//             both ends, and there joins the two items that hold them; links
//             between the same two items are one trunk with a count.
//   The DAG   An order of the items with as much weight of link as possible
//             running from what is required to what requires it (Eades, Lin
//             and Smyth). Trunks against it are back trunks: left out of the
//             layout and routed afterwards.
//   Flow      The top level runs from the bottom up (or, with flow "right",
//             from left to right), its folders' contents the other way, theirs
//             the first way again, and so on, so a chain of folders is a
//             column of rows, not a tower.
//   Layers    An item sits one layer after the last thing it requires; one
//             that requires nothing sits just before the first item needing
//             it. A layer too long for its folder wraps.
//   Order     Within layers, by sweeps that put each item at the mean place of
//             its neighbours in the layer before; then each is drawn level
//             with what it is joined to.
//   Routes    A trunk leaves the late side of the item required, runs along a
//             track of its own between two layers, and enters the early side
//             of the item requiring it. Trunks from one item share their way
//             (a bus). One that passes layers keeps a free lane in each.
//
// The result is plain data, and nothing after it knows how it was made:
//   { W, H, flow,                the grid, in cells, and the top level's direction
//     items: [{ id, ref, kind,   "note" or "folder"; the root is not an item;
//                                a parent comes before its children
//               parent, depth,   the parent's index (-1 at the top), 1 at the top
//               gx, gy, w, h }], a block of cells; a folder's is its whole region,
//                                and its title sits on its top edge
//     links: [{ a, b, s,         note to note: item indices (a links to b), the rating,
//               level, placed }] the lowest folder holding both ends (-1: the root),
//                                and false when the link runs against the layout
//     trunks: [{ a, b, count,    item to item, at one level: a requires b, for
//                back, implied,  `count` links; against the order; implied by a
//                pts }] }        longer way; and its path from b to a in cells
//                                (none for a back or implied trunk, which the
//                                router finds a way for when it is wanted)

export const NOTE_W = 18, NOTE_H = 5; // room for a whole title, on two or three lines, before the map is zoomed far in
const GAP = 2, GAP_FOLDERS = 3; // clear cells between neighbours in a layer
const CHANNEL = 3; // free cells between two layers, at least
export const PAD = 2; // cells between a folder's wall and its contents
const HEAD = 2; // free rows under a folder's top edge, where its title sits: they keep a subfolder's title clear of it
const MARGIN = 3; // free cells around the whole map
const MIN_FOLDER = 12; // a folder is at least this wide, for its title
const SHAPE = 1.4; // a folder's contents aim to be this much wider than tall
const SWEEPS = 8, PULLS = 12;

/** @param model { root, edges }: the map's plain model (layout.js `plainModel`) @param flow "up" or "right": the top level's direction */
export function nestedLayout(model, { flow = "up" } = {}) {
  const isDir = (n) => n.kind === "dir";
  const parent = new Map(), byRef = new Map(), dirs = [model.root];
  for (let k = 0; k < dirs.length; k++) for (const c of dirs[k].children || []) { parent.set(c, dirs[k]); if (isDir(c)) dirs.push(c); else byRef.set(c.ref, c); }
  const pathTo = (n) => { const out = []; for (let p = n; p; p = parent.get(p)) out.push(p); return out.reverse(); };

  // Each requires- or uses-link at its level: folder -> "required|requiring" -> { p, q, weight, count }.
  const joins = new Map(dirs.map((d) => [d, new Map()]));
  const number = new Map(); // a number for every note and folder, for keys
  for (const d of dirs) { number.set(d, number.size); for (const c of d.children || []) if (!isDir(c)) number.set(c, number.size); }
  for (const [from, to, s] of model.edges) {
    if (s < 2) continue;
    const a = byRef.get(from), b = byRef.get(to);
    if (!a || !b || a === b) continue;
    const pa = pathTo(a), pb = pathTo(b);
    let k = 0;
    while (pa[k + 1] && pa[k + 1] === pb[k + 1]) k++;
    const at = joins.get(pa[k]), p = pb[k + 1], q = pa[k + 1], key = number.get(p) + "|" + number.get(q);
    const j = at.get(key) || { p, q, weight: 0, count: 0 };
    j.weight += s; j.count++;
    at.set(key, j);
  }

  const box = new Map(); // node -> { w, h, x, y (in its folder's contents) }
  const trunksIn = new Map(); // folder -> [{ p, q, count, back, implied, pts (in its contents) }]
  const other = (f) => (f === "up" ? "right" : "up");
  const arrange = (folder, way) => {
    const kids = folder.children || [];
    for (const c of kids) { if (isDir(c)) arrange(c, other(way)); else box.set(c, { w: NOTE_W, h: NOTE_H }); }
    const inner = kids.length ? place(folder, kids, way) : { w: 0, h: 0 };
    box.set(folder, folder === model.root ? inner
      : kids.length ? { w: Math.max(MIN_FOLDER, inner.w + 2 * PAD), h: inner.h + PAD + HEAD + PAD }
      : { w: MIN_FOLDER, h: HEAD + 2 * PAD });
  };

  // Lay out one folder's items along `way`. Along the way is "main", across it "cross".
  function place(folder, kids, way) {
    const n = kids.length, index = new Map(kids.map((c, i) => [c, i])), up = way === "up";
    const gap = kids.some(isDir) ? GAP_FOLDERS : GAP;
    const main = kids.map((c) => (up ? box.get(c).h : box.get(c).w)), cross = kids.map((c) => (up ? box.get(c).w : box.get(c).h));
    const all = [...joins.get(folder).values()].map((j) => ({ ...j, p: index.get(j.p), q: index.get(j.q) }));
    const pos = greedyOrder(n, all.map((j) => [j.p, j.q, j.weight]));
    for (const j of all) j.back = pos[j.p] > pos[j.q];
    const forward = all.filter((j) => !j.back);

    // Layers: one after the last thing required; what requires nothing, just before the first that needs it.
    const layer = new Array(n).fill(0), needs = kids.map(() => []), neededBy = kids.map(() => []);
    for (const j of forward) { needs[j.q].push(j.p); neededBy[j.p].push(j.q); }
    for (const q of [...Array(n).keys()].sort((x, y) => pos[x] - pos[y])) for (const p of needs[q]) layer[q] = Math.max(layer[q], layer[p] + 1);
    for (let v = 0; v < n; v++) if (!needs[v].length && neededBy[v].length) layer[v] = Math.min(...neededBy[v].map((q) => layer[q])) - 1;
    // A trunk between two notes is implied when a longer way joins them.
    const reaches = (from, to, skip) => { const seen = new Set(), todo = neededBy[from].filter((m) => m !== skip); while (todo.length) { const v = todo.pop(); if (v === to) return true; if (!seen.has(v)) { seen.add(v); todo.push(...neededBy[v]); } } return false; };
    for (const j of forward) j.implied = !isDir(kids[j.p]) && !isDir(kids[j.q]) && reaches(j.p, j.q, j.q);
    const drawn = forward.filter((j) => !j.implied).sort((x, y) => y.weight - x.weight || x.p - y.p || x.q - y.q);

    // Rows: a layer wraps when it is longer than the folder should be across.
    const area = kids.reduce((t, _, i) => t + (cross[i] + gap) * (main[i] + CHANNEL), 0);
    const widest = Math.max(Math.ceil(Math.sqrt(up ? area * SHAPE : area / SHAPE)), ...cross);
    const rows = [], row = new Array(n);
    for (let l = 0; l <= Math.max(...layer); l++) {
      let cur = null, used = 0;
      for (let i = 0; i < n; i++) {
        if (layer[i] !== l) continue;
        if (!cur || used + cross[i] > widest) { cur = []; rows.push(cur); used = 0; }
        row[i] = rows.length - 1;
        cur.push(i);
        used += cross[i] + gap;
      }
    }

    // Nodes: the items, then the lanes trunks keep in the rows they pass; the trunks from one item share theirs.
    const size = [...cross], before = kids.map(() => []), after = kids.map(() => []); // neighbours in the rows next to a node's own
    const lane = new Map(), steps = [], stepped = new Set(), chains = new Map();
    for (const j of drawn) {
      const chain = [j.p];
      for (let r = row[j.p] + 1; r < row[j.q]; r++) {
        const key = j.p + "|" + r;
        if (!lane.has(key)) { lane.set(key, size.length); size.push(1); before.push([]); after.push([]); row.push(r); rows[r].push(size.length - 1); }
        chain.push(lane.get(key));
      }
      chain.push(j.q);
      for (let k = 1; k < chain.length; k++) {
        const u = chain[k - 1], v = chain[k];
        if (stepped.has(u + "|" + v)) continue;
        stepped.add(u + "|" + v);
        steps.push([u, v]);
        after[u].push(v); before[v].push(u);
      }
      chains.set(j, chain);
    }
    const passing = (v) => v >= n;

    // Order within rows.
    const at = new Array(size.length);
    rows.forEach((r) => r.forEach((v, k) => { at[v] = k; }));
    const sweep = (r, near) => {
      const key = new Map(rows[r].map((v) => [v, near[v].length ? near[v].reduce((t, u) => t + at[u], 0) / near[v].length : at[v]]));
      rows[r].sort((x, y) => key.get(x) - key.get(y) || at[x] - at[y]);
      rows[r].forEach((v, k) => { at[v] = k; });
    };
    for (let it = 0; it < SWEEPS; it++) {
      if (it % 2 === 0) for (let r = 1; r < rows.length; r++) sweep(r, before);
      else for (let r = rows.length - 2; r >= 0; r--) sweep(r, after);
    }

    // Across: each row packed in order and centred, then every node drawn level with its neighbours, keeping order and gaps.
    const space = (u, v) => (passing(u) || passing(v) ? 1 : gap);
    const c = new Array(size.length).fill(0);
    for (const r of rows) { let x = 0; r.forEach((v, k) => { if (k) x += space(r[k - 1], v); c[v] = x; x += size[v]; }); }
    const end = (r) => (r.length ? c[r[r.length - 1]] + size[r[r.length - 1]] : 0);
    const span = Math.max(...rows.map(end));
    for (const r of rows) { const shift = (span - end(r)) / 2; for (const v of r) c[v] += shift; }
    const mid = (v) => c[v] + size[v] / 2;
    for (let it = 0; it < PULLS; it++) {
      for (const r of it % 2 ? [...rows].reverse() : rows) {
        if (!r.length) continue;
        const want = r.map((v) => { const near = [...before[v], ...after[v]]; return (near.length ? near.reduce((t, u) => t + mid(u), 0) / near.length : mid(v)) - size[v] / 2; });
        const lo = [], hi = [];
        r.forEach((v, k) => { lo[k] = k ? Math.max(want[k], lo[k - 1] + size[r[k - 1]] + space(r[k - 1], v)) : want[k]; });
        for (let k = r.length - 1; k >= 0; k--) hi[k] = k < r.length - 1 ? Math.min(want[k], hi[k + 1] - size[r[k]] - space(r[k], r[k + 1])) : want[k];
        r.forEach((v, k) => { c[v] = (lo[k] + hi[k]) / 2; });
      }
    }
    for (const r of rows) r.forEach((v, k) => { c[v] = k ? Math.max(Math.round(c[v]), c[r[k - 1]] + size[r[k - 1]] + space(r[k - 1], v)) : Math.round(c[v]); });
    const c0 = Math.min(...c);
    for (let v = 0; v < c.length; v++) c[v] -= c0;
    const across = Math.max(...c.map((x, v) => x + size[v]));
    const centre = (v) => c[v] + Math.floor((size[v] - 1) / 2) + 0.5; // the middle cell

    // Ports: the steps into a node, in order across, each with a cell of its
    // own on its early side: the cell level with where the step comes from, if
    // the node reaches that far, so a step between two things in line is straight.
    const port = new Map();
    for (let v = 0; v < size.length; v++) {
      const list = [...before[v]].sort((a, b) => centre(a) - centre(b)), lo = c[v] + 0.5, hi = c[v] + size[v] - 0.5;
      if (list.length > size[v]) { list.forEach((u, k) => port.set(u + "|" + v, lo + Math.min(size[v] - 1, Math.floor((k * size[v]) / list.length)))); continue; }
      const x = list.map((u) => Math.max(lo, Math.min(hi, centre(u))));
      for (let k = 1; k < x.length; k++) x[k] = Math.max(x[k], x[k - 1] + 1);
      for (let k = x.length - 1; k >= 0; k--) x[k] = Math.min(x[k], k === x.length - 1 ? hi : x[k + 1] - 1);
      list.forEach((u, k) => port.set(u + "|" + v, x[k]));
    }
    // A step whose port the node reaches leaves from the cell level with it,
    // straight. The node's other steps leave together, from the cell level
    // with the middle one's port, as near as the node reaches.
    const direct = (u, v) => { const x = port.get(u + "|" + v); return x >= c[u] + 0.5 && x <= c[u] + size[u] - 0.5; };
    const stub = new Array(size.length);
    for (let u = 0; u < size.length; u++) {
      const to = after[u].filter((v) => !direct(u, v)).map((v) => port.get(u + "|" + v)).sort((a, b) => a - b);
      stub[u] = to.length ? Math.max(c[u] + 0.5, Math.min(c[u] + size[u] - 0.5, to[(to.length - 1) >> 1])) : centre(u);
    }
    const leaves = (u, v) => (direct(u, v) ? port.get(u + "|" + v) : stub[u]);
    // Buses: the steps on from one node that turn share a run across; runs between the same two rows take tracks, none on another.
    const bus = new Map();
    for (const [u, v] of steps) {
      if (direct(u, v)) continue;
      const x = port.get(u + "|" + v), b = bus.get(u) || { u, lo: stub[u], hi: stub[u], track: 0 };
      b.lo = Math.min(b.lo, x); b.hi = Math.max(b.hi, x);
      bus.set(u, b);
    }
    const tracks = rows.map(() => 0);
    rows.forEach((_, r) => {
      const ends = [];
      for (const b of [...bus.values()].filter((b) => row[b.u] === r && b.hi > b.lo).sort((a, d) => a.lo - d.lo || a.hi - d.hi || a.u - d.u)) {
        let t = ends.findIndex((e) => e < b.lo - 1);
        if (t < 0) { t = ends.length; ends.push(0); }
        ends[t] = b.hi;
        b.track = t;
      }
      tracks[r] = ends.length;
    });

    // Along: rows one after another, with room between for the tracks.
    const thick = rows.map((r) => Math.max(0, ...r.filter((v) => !passing(v)).map((v) => main[v])));
    const start = [], track0 = [];
    let m = 0;
    rows.forEach((_, r) => { start[r] = m; m += thick[r]; track0[r] = m + 1; if (r < rows.length - 1) m += Math.max(CHANNEL, tracks[r] + 2); });
    const along = m;
    const m0 = (v) => start[row[v]] + Math.floor((thick[row[v]] - main[v]) / 2); // an item's early side

    // To cells: flowing up, later is north; flowing right, later is east.
    const cell = (mm, cc) => (up ? [cc, along - mm] : [mm, cc]);
    kids.forEach((kid, i) => Object.assign(box.get(kid), up ? { x: c[i], y: along - m0(i) - main[i] } : { x: m0(i), y: c[i] }));
    const out = [];
    for (const j of all) {
      const chain = chains.get(j);
      let pts = null;
      if (chain) {
        pts = [cell(m0(j.p) + main[j.p], leaves(j.p, chain[1]))];
        for (let k = 1; k < chain.length; k++) {
          const u = chain[k - 1], v = chain[k], tm = track0[row[u]] + (bus.get(u)?.track || 0) + 0.5;
          pts.push(cell(tm, leaves(u, v)), cell(tm, port.get(u + "|" + v)));
        }
        pts.push(cell(m0(j.q), port.get(chain[chain.length - 2] + "|" + j.q)));
        pts = pts.filter((p, k) => !k || p[0] !== pts[k - 1][0] || p[1] !== pts[k - 1][1]);
      }
      out.push({ p: kids[j.p], q: kids[j.q], count: j.count, back: j.back, implied: !!j.implied, pts });
    }
    trunksIn.set(folder, out);
    return up ? { w: across, h: along } : { w: along, h: across };
  }

  arrange(model.root, flow);

  // ---- the layout as plain data: parents before their children
  const items = [], index = new Map(), origin = new Map([[model.root, [MARGIN, MARGIN]]]);
  for (const d of dirs) {
    const [ox, oy] = origin.get(d), upIndex = d === model.root ? -1 : index.get(d), depth = pathTo(d).length;
    for (const c of d.children || []) {
      const b = box.get(c);
      index.set(c, items.length);
      items.push({ id: c.id, ref: c.ref, kind: isDir(c) ? "folder" : "note", parent: upIndex, depth, gx: ox + b.x, gy: oy + b.y, w: b.w, h: b.h });
      if (isDir(c)) origin.set(c, [ox + b.x + PAD, oy + b.y + HEAD + PAD]);
    }
  }
  const trunks = [], backward = new Set();
  for (const d of dirs) {
    const [ox, oy] = origin.get(d);
    for (const t of trunksIn.get(d) || []) {
      const a = index.get(t.q), b = index.get(t.p);
      if (t.back) backward.add(a + "|" + b);
      trunks.push({ a, b, count: t.count, back: t.back, implied: t.implied, pts: t.pts && t.pts.map(([x, y]) => [x + ox, y + oy]) });
    }
  }
  const links = levelled(items, model.edges, new Map([...byRef].map(([ref, n]) => [ref, index.get(n)])));
  const under = (i, level) => { while (items[i].parent !== level) i = items[i].parent; return i; };
  for (const l of links) l.placed = l.s >= 2 && !backward.has(under(l.a, l.level) + "|" + under(l.b, l.level));
  const root = box.get(model.root);
  return { W: root.w + 2 * MARGIN, H: root.h + 2 * MARGIN, flow, items, links, trunks };
}

// The layout's links: each with the lowest folder that holds both its ends.
function levelled(items, edges, byRef) {
  const up = (i) => { const out = []; for (let p = items[i].parent; p >= 0; p = items[p].parent) out.push(p); return out; };
  const links = [];
  for (const [from, to, s] of edges) {
    const a = byRef.get(from), b = byRef.get(to);
    if (a === undefined || b === undefined || a === b) continue;
    const above = new Set(up(b));
    links.push({ a, b, s, level: up(a).find((p) => above.has(p)) ?? -1, placed: false });
  }
  return links;
}

// An order of n nodes in which as much weight of arc as possible points
// forwards (Eades, Lin and Smyth, 1993): nodes nothing points to are taken
// first and nodes pointing to nothing last, and otherwise the node with the
// most weight out over weight in is taken first. Ties go to the lower index,
// so the same graph gives the same order. Returns each node's place.
export function greedyOrder(n, arcs) {
  const out = Array.from({ length: n }, () => new Map()), into = Array.from({ length: n }, () => new Map());
  for (const [p, q, w] of arcs) { if (p === q) continue; out[p].set(q, (out[p].get(q) || 0) + w); into[q].set(p, (into[q].get(p) || 0) + w); }
  const sum = (m) => { let t = 0; for (const w of m.values()) t += w; return t; };
  const left = new Set([...Array(n).keys()]), first = [], last = [];
  const take = (v, list) => {
    left.delete(v);
    list.push(v);
    for (const q of out[v].keys()) into[q].delete(v);
    for (const p of into[v].keys()) out[p].delete(v);
  };
  while (left.size) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const v of [...left]) {
        if (!into[v].size) { take(v, first); moved = true; } // nothing left to wait for: includes nodes with no arcs
        else if (!out[v].size) { take(v, last); moved = true; }
      }
    }
    if (!left.size) break;
    let best = -1, score = -Infinity;
    for (const v of left) { const s = sum(out[v]) - sum(into[v]); if (s > score) { score = s; best = v; } }
    take(best, first);
  }
  const pos = new Array(n);
  [...first, ...last.reverse()].forEach((v, k) => { pos[v] = k; });
  return pos;
}
