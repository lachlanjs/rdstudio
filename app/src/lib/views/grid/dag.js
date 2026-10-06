// The grid Atlas's layout from the DAG among the links (T64): layers shared
// by the whole map, with each folder a box round the layers its notes sit in,
// as in a hierarchic layout with group nodes.
//
//   The DAG   An order of the notes is chosen so that as much weight of
//             requires- and uses-link as possible runs from what is required
//             to what requires it (Eades, Lin and Smyth's greedy order). Links
//             against the order are back links: left out of the layout and
//             routed last. See also links take no part.
//   Implied   A link is implied when a chain of links at least as strong joins
//             the same two notes. Implied links are marked and take no part.
//   Layers    A note sits one layer above the highest thing it requires, so
//             every link of the DAG runs north, in every folder and between
//             them, and north is later in the study order. A note that
//             requires nothing sits just under the first note that needs it;
//             a note with no links sits at the foot of its folder. Many notes
//             of one folder in one layer wrap onto several rows.
//   Columns   A link that passes rows keeps a place in each: a free column one
//             cell wide, in the deepest folder on its way that reaches the row.
//             The links up from one note share their places, so they rise as
//             one trunk and branch off where they arrive.
//   Folders   A folder spans the rows of its notes. Its items are its notes,
//             its subfolders and the places links keep in it. Folders whose
//             rows overlap stand side by side; a folder can stand on another.
//   Order     Every folder's items are put in an order, and packed: each as
//             far left, and as far right, as the items before it on its rows
//             allow, and placed half way. The orders are improved together,
//             each item moving towards the notes its links lead to anywhere on
//             the map, so a subfolder is arranged with its parent in mind.
//   Aligned   With the orders settled, each item is drawn under and over what
//             it is linked to, as far as its neighbours allow, so links run
//             straight.
//   Routes    A link of the DAG leaves the foot of the note that requires,
//             runs across in the free rows between two rows of notes, and
//             down its column, to the head of the note required. The links up
//             from one note share a run (a bus), and each run has a track of
//             its own, so no two lie on each other.
//
// The result is the plain data grid/snap.js describes. A link has `placed`
// (the DAG's), `implied`, and `path`, its route in cells, when the layout
// drew one.

import { noteSize, degrees, levelled, GAP_NOTES, GAP_FOLDERS, PAD, HEAD } from "./snap.js";

const MARGIN = 3; // free cells around the whole map
const MIN_FOLDER = 10; // a folder is at least this wide, for its title
const CHANNEL = 3; // free rows between two layers, at least
const LINE = 3; // a row of notes is as tall as the tallest note
const WRAP_GAP = 2; // between the rows of one layer, at least
const TOP = HEAD + PAD, FOOT = PAD; // what a folder adds above its highest notes and below its lowest
const ROUNDS = 12; // tries at the orders
const SWEEPS = 10; // passes of alignment

/** @param model { root, edges }: the map's plain model (layout.js `plainModel`) */
export function dagLayout(model) {
  const isDir = (n) => n.kind === "dir";
  const deg = degrees(model.edges);
  const parent = new Map(), notes = [], id = new Map(), home = [], dirs = [model.root];
  for (let k = 0; k < dirs.length; k++) {
    for (const c of dirs[k].children || []) {
      parent.set(c, dirs[k]);
      if (isDir(c)) dirs.push(c); else { id.set(c.ref, notes.length); notes.push(c); home.push(dirs[k]); }
    }
  }
  const N = notes.length;

  // ---- the DAG and its layers
  const arcs = []; // [required, requiring, weight]
  for (const [from, to, s] of model.edges) if (s >= 2 && id.has(from) && id.has(to) && from !== to) arcs.push([id.get(to), id.get(from), s]);
  const pos = greedyOrder(N, arcs);
  const forward = arcs.filter(([p, q]) => pos[p] < pos[q]);
  const needs = Array.from({ length: N }, () => []), neededBy = Array.from({ length: N }, () => []);
  for (const [p, q, s] of forward) { needs[q].push(p); neededBy[p].push([q, s]); }
  const byPos = [...Array(N).keys()].sort((x, y) => pos[x] - pos[y]);
  const rank = new Array(N).fill(0);
  for (const q of byPos) for (const p of needs[q]) rank[q] = Math.max(rank[q], rank[p] + 1);
  for (let v = 0; v < N; v++) if (!needs[v].length && neededBy[v].length) rank[v] = Math.min(...neededBy[v].map(([q]) => rank[q])) - 1;
  const linked = (v) => needs[v].length || neededBy[v].length;

  // Each folder's layers, lowest and highest; a note with no links goes to the foot of its folder.
  const span = new Map();
  const reach = (folder, inherited) => {
    let lo = Infinity, hi = -Infinity;
    const below = (n) => { for (const c of n.children || []) { if (isDir(c)) below(c); else if (linked(id.get(c.ref))) { lo = Math.min(lo, rank[id.get(c.ref)]); hi = Math.max(hi, rank[id.get(c.ref)]); } } };
    below(folder);
    const foot = lo === Infinity ? inherited : lo;
    for (const c of folder.children || []) if (!isDir(c) && !linked(id.get(c.ref))) rank[id.get(c.ref)] = foot;
    for (const c of folder.children || []) if (isDir(c)) reach(c, foot);
    lo = hi = foot;
    for (const c of folder.children || []) {
      const [a, b] = isDir(c) ? span.get(c) : [rank[id.get(c.ref)], rank[id.get(c.ref)]];
      lo = Math.min(lo, a); hi = Math.max(hi, b);
    }
    span.set(folder, [lo, hi]);
  };
  reach(model.root, 0);
  const layers = Math.max(0, ...rank) + 1;

  // ---- rows, numbered from the north: a layer has as many as its most crowded folder needs
  const rowsIn = new Array(layers).fill(1), sub = new Array(N).fill(0);
  for (const folder of dirs) {
    const own = (folder.children || []).filter((c) => !isDir(c));
    const per = Math.max(3, Math.ceil(Math.sqrt(1.5 * own.length)));
    const count = new Map();
    for (const c of own) {
      const v = id.get(c.ref), k = count.get(rank[v]) || 0;
      sub[v] = Math.floor(k / per);
      count.set(rank[v], k + 1);
      rowsIn[rank[v]] = Math.max(rowsIn[rank[v]], sub[v] + 1);
    }
  }
  const first = new Array(layers), layerOf = [];
  for (let r = layers - 1; r >= 0; r--) { first[r] = layerOf.length; for (let k = 0; k < rowsIn[r]; k++) layerOf.push(r); }
  const rows = layerOf.length;
  const topRow = (folder) => first[span.get(folder)[1]], bottomRow = (folder) => first[span.get(folder)[0]] + rowsIn[span.get(folder)[0]] - 1;
  // How many folders, one inside the next, end (cap) or start (foot) on the same layer as this one.
  const cap = new Map(), foot = new Map();
  for (let k = dirs.length - 1; k >= 0; k--) {
    let c = 0, f = 0;
    for (const kid of dirs[k].children || []) {
      if (!isDir(kid)) continue;
      if (span.get(kid)[1] === span.get(dirs[k])[1]) c = Math.max(c, cap.get(kid));
      if (span.get(kid)[0] === span.get(dirs[k])[0]) f = Math.max(f, foot.get(kid));
    }
    cap.set(dirs[k], c + 1); foot.set(dirs[k], f + 1);
  }
  const caps = new Array(layers).fill(0), feet = new Array(layers).fill(0);
  for (const folder of dirs.slice(1)) {
    const [lo, hi] = span.get(folder);
    caps[hi] = Math.max(caps[hi], cap.get(folder));
    feet[lo] = Math.max(feet[lo], foot.get(folder));
  }

  // ---- implied links: q can be reached from p by a longer chain at least as strong
  const words = (N + 31) >> 5, down = { 2: new Uint32Array(N * words), 3: new Uint32Array(N * words) };
  for (let k = N - 1; k >= 0; k--) {
    const v = byPos[k];
    for (const [m, s] of neededBy[v]) {
      for (const level of s >= 3 ? [2, 3] : [2]) {
        const D = down[level];
        D[v * words + (m >> 5)] |= 1 << (m & 31);
        for (let w = 0; w < words; w++) D[v * words + w] |= D[m * words + w];
      }
    }
  }
  const implied = (p, q, s) => {
    const level = s >= 3 ? 3 : 2, D = down[level];
    for (const [m, s2] of neededBy[p]) if (m !== q && s2 >= level && (D[m * words + (q >> 5)] >>> (q & 31)) & 1) return true;
    return false;
  };
  const kept = forward.filter(([p, q, s]) => !implied(p, q, s)).sort((x, y) => y[2] - x[2] || x[0] - y[0] || x[1] - y[1]);

  // ---- nodes: the notes, then the places links keep in the rows they pass
  const row = notes.map((_, v) => first[rank[v]] + sub[v]);
  const owner = [...home]; // the folder each node is an item of
  const up = (folder) => { const out = []; for (let f = folder; f; f = parent.get(f)) out.push(f); return out; };
  const chains = new Map(), segs = []; // p * N + q -> the nodes from q south to p; and each step [north, south]
  const most = 6 * N + 200; // links beyond this many places are left to the router
  // The links up from one note share their places (one trunk, branching), as far as they pass the same folders.
  const trunk = new Map(), stepped = new Set(), dirNo = new Map(dirs.map((d, k) => [d, k]));
  for (const [p, q] of kept) {
    if (row.length - N + (row[p] - row[q] - 1) > most) continue;
    const pa = up(home[p]), qa = up(home[q]), shared = pa.find((f) => qa.includes(f)), above = up(shared);
    const chain = [q];
    for (let r = row[q] + 1; r < row[p]; r++) {
      const within = (f) => !above.includes(f) && topRow(f) <= r && r <= bottomRow(f);
      const f = pa.find(within) || qa.find(within) || shared, key = `${p}|${r}|${dirNo.get(f)}`;
      if (!trunk.has(key)) { trunk.set(key, row.length); owner.push(f); row.push(r); }
      chain.push(trunk.get(key));
    }
    chain.push(p);
    for (let k = 1; k < chain.length; k++) {
      const step = chain[k - 1] + "|" + chain[k];
      if (!stepped.has(step)) { stepped.add(step); segs.push([chain[k - 1], chain[k]]); }
    }
    chains.set(p * N + q, chain);
  }
  const M = row.length;

  // ---- items: what each folder arranges
  const itemsOf = new Map(dirs.map((d) => [d, []])), nodeItem = new Array(M), dirItem = new Map();
  for (const d of dirs) {
    for (const c of d.children || []) {
      if (isDir(c)) { const it = { dir: c, w: 0, top: topRow(c), bottom: bottomRow(c), x: 0, pulls: [] }; dirItem.set(c, it); itemsOf.get(d).push(it); }
      else { const v = id.get(c.ref), [w, h] = noteSize(deg.get(c.ref) || 0); nodeItem[v] = { v, w, h, top: row[v], bottom: row[v], x: 0, pulls: [] }; itemsOf.get(d).push(nodeItem[v]); }
    }
  }
  for (let v = N; v < M; v++) { nodeItem[v] = { v, w: 1, pass: true, top: row[v], bottom: row[v], x: 0, pulls: [] }; itemsOf.get(owner[v]).push(nodeItem[v]); }
  // A step pulls its two ends together: each end's item, and every folder round that end up to the one both share.
  for (const [u, v] of segs) {
    const ua = up(owner[u]), va = up(owner[v]), shared = ua.find((f) => va.includes(f));
    for (const [e, o] of [[u, v], [v, u]]) {
      nodeItem[e].pulls.push([e, o]);
      for (let f = owner[e]; f !== shared; f = parent.get(f)) dirItem.get(f).pulls.push([e, o]);
    }
  }
  const gapIn = new Map(dirs.map((d) => [d, (d.children || []).some(isDir) ? GAP_FOLDERS : GAP_NOTES]));
  const innerW = new Map();

  // Pack one folder's items in their order: each as far left, and as far right,
  // as those before it on its rows allow, and half way between.
  const edge = new Int32Array(rows), passing = new Uint8Array(rows);
  function pack(d) {
    const order = itemsOf.get(d), gap = gapIn.get(d);
    edge.fill(-1);
    let width = 0;
    for (const it of order) {
      let x = 0;
      for (let r = it.top; r <= it.bottom; r++) if (edge[r] >= 0) x = Math.max(x, edge[r] + (passing[r] || it.pass ? 1 : gap));
      it.xl = x;
      for (let r = it.top; r <= it.bottom; r++) { edge[r] = x + it.w; passing[r] = it.pass ? 1 : 0; }
      width = Math.max(width, x + it.w);
    }
    edge.fill(-1);
    for (let k = order.length - 1; k >= 0; k--) {
      const it = order[k];
      let x = width;
      for (let r = it.top; r <= it.bottom; r++) if (edge[r] >= 0) x = Math.min(x, edge[r] - (passing[r] || it.pass ? 1 : gap));
      it.x = Math.floor((it.xl + x - it.w) / 2);
      for (let r = it.top; r <= it.bottom; r++) { edge[r] = x - it.w; passing[r] = it.pass ? 1 : 0; }
    }
    innerW.set(d, width);
    if (d !== model.root) dirItem.get(d).w = Math.max(MIN_FOLDER, width + 2 * PAD);
  }
  const packAll = () => { for (let k = dirs.length - 1; k >= 0; k--) pack(dirs[k]); };
  // Where everything is on the map: each item's left edge, and each node's centre cell.
  const cx = new Float64Array(M), origin = new Map();
  const locate = () => {
    origin.set(model.root, MARGIN);
    for (const d of dirs) {
      for (const it of itemsOf.get(d)) {
        it.ax = origin.get(d) + it.x;
        if (it.dir) origin.set(it.dir, it.ax + PAD); else cx[it.v] = it.ax + Math.floor((it.w - 1) / 2) + 0.5;
      }
    }
  };
  const length = () => { let t = 0; for (const [u, v] of segs) t += Math.abs(cx[u] - cx[v]); return t; };
  const lean = (it) => { let t = 0; for (const [e, o] of it.pulls) t += cx[o] - cx[e]; return it.pulls.length ? t / it.pulls.length : 0; };

  // The orders, improved together: every item moves towards what its links lead to.
  packAll(); locate();
  let least = length(), best = new Map(dirs.map((d) => [d, [...itemsOf.get(d)]]));
  for (let round = 0; round < ROUNDS && segs.length; round++) {
    for (const d of dirs) {
      const order = itemsOf.get(d), want = new Map(order.map((it, k) => [it, [it.ax + it.w / 2 + lean(it), k]]));
      order.sort((a, b) => want.get(a)[0] - want.get(b)[0] || want.get(a)[1] - want.get(b)[1]);
    }
    packAll(); locate();
    const t = length();
    if (t < least) { least = t; best = new Map(dirs.map((d) => [d, [...itemsOf.get(d)]])); }
  }
  for (const d of dirs) itemsOf.set(d, best.get(d));
  packAll(); locate();

  // Aligned: each item moves under and over what it is linked to, between
  // the items before and after it on its rows.
  const limit = new Int32Array(rows);
  for (let sweep = 0; sweep < SWEEPS && segs.length; sweep++) {
    for (const d of sweep % 2 ? [...dirs].reverse() : dirs) {
      const order = itemsOf.get(d), gap = gapIn.get(d), width = innerW.get(d), most = new Array(order.length);
      limit.fill(-1);
      for (let k = order.length - 1; k >= 0; k--) {
        const it = order[k];
        let x = width;
        for (let r = it.top; r <= it.bottom; r++) if (limit[r] >= 0) x = Math.min(x, limit[r] - (passing[r] || it.pass ? 1 : gap));
        most[k] = x - it.w;
        for (let r = it.top; r <= it.bottom; r++) { limit[r] = it.x; passing[r] = it.pass ? 1 : 0; }
      }
      limit.fill(-1);
      order.forEach((it, k) => {
        let lo = 0;
        for (let r = it.top; r <= it.bottom; r++) if (limit[r] >= 0) lo = Math.max(lo, limit[r] + (passing[r] || it.pass ? 1 : gap));
        it.x = Math.max(lo, Math.min(most[k], Math.round(it.x + lean(it))));
        for (let r = it.top; r <= it.bottom; r++) { limit[r] = it.x + it.w; passing[r] = it.pass ? 1 : 0; }
      });
      locate();
    }
  }

  // ---- routes: ports, buses and their tracks
  // The steps into each node from the south, west to east, each with its own cell on the node's foot.
  const from = Array.from({ length: M }, () => []);
  for (const [u, v] of segs) from[u].push(v);
  const port = new Map(); // north * M + south -> x
  for (let u = 0; u < M; u++) {
    const list = [...new Set(from[u])].sort((a, b) => cx[a] - cx[b]), it = nodeItem[u];
    list.forEach((v, k) => port.set(u * M + v, list.length === 1 ? cx[u] : it.ax + 0.5 + Math.max(0, Math.min(it.w - 1, Math.round(((k + 0.5) * it.w) / list.length - 0.5)))));
  }
  // A bus: the steps up from one node share a run across. Runs between the same two rows take tracks, none on another.
  const bus = new Map();
  for (const [u, v] of segs) {
    const x = port.get(u * M + v), b = bus.get(v) || { v, lo: cx[v], hi: cx[v], track: 0 };
    b.lo = Math.min(b.lo, x); b.hi = Math.max(b.hi, x);
    bus.set(v, b);
  }
  const tracks = new Array(rows).fill(0);
  const between = Array.from({ length: rows }, () => []);
  for (const b of bus.values()) if (b.hi > b.lo) between[row[b.v] - 1].push(b);
  between.forEach((list, g) => {
    const ends = []; // each track's eastmost cell so far
    for (const b of list.sort((a, c) => a.lo - c.lo || a.hi - c.hi || a.v - c.v)) {
      let t = ends.findIndex((e) => e < b.lo - 1);
      if (t < 0) { t = ends.length; ends.push(0); }
      ends[t] = b.hi;
      b.track = t;
    }
    tracks[g] = ends.length;
  });

  // ---- cells down: rows, the walls and titles of the folders that end between them, and the tracks
  const rowY = new Array(rows), trackY0 = new Array(rows);
  let y = MARGIN + TOP * caps[layerOf[0] ?? 0];
  for (let r = 0; r < rows; r++) {
    rowY[r] = y;
    y += LINE;
    if (r === rows - 1) { y += FOOT * feet[layerOf[r]]; break; }
    if (layerOf[r + 1] === layerOf[r]) { trackY0[r] = y; y += Math.max(WRAP_GAP, tracks[r] + 1); }
    else { y += FOOT * feet[layerOf[r]]; trackY0[r] = y + 1; y += Math.max(CHANNEL, tracks[r] + 2) + TOP * caps[layerOf[r + 1]]; }
  }
  const H = (rows ? y : MARGIN) + MARGIN;
  const paths = new Map();
  for (const [key, chain] of chains) {
    const pts = [[port.get(chain[0] * M + chain[1]), rowY[row[chain[0]]] + nodeItem[chain[0]].h]];
    for (let k = 1; k < chain.length; k++) {
      const u = chain[k - 1], v = chain[k], ty = trackY0[row[u]] + bus.get(v).track + 0.5;
      pts.push([port.get(u * M + v), ty], [cx[v], ty]);
    }
    const last = chain[chain.length - 1];
    pts.push([cx[last], rowY[row[last]]]);
    paths.set(key, pts.filter((p, k) => !k || p[0] !== pts[k - 1][0] || p[1] !== pts[k - 1][1]));
  }

  // ---- the layout as plain data: parents before their children
  const items = [], index = new Map(), noteIndex = new Array(N);
  for (const d of dirs) {
    const upIndex = d === model.root ? -1 : index.get(d), depth = up(d).length;
    for (const it of itemsOf.get(d)) {
      if (it.pass) continue;
      const n = it.dir || notes[it.v];
      const gy = it.dir ? rowY[it.top] - TOP * cap.get(it.dir) : rowY[it.top];
      const h = it.dir ? rowY[it.bottom] + LINE + FOOT * foot.get(it.dir) - gy : it.h;
      if (it.dir) index.set(it.dir, items.length); else noteIndex[it.v] = items.length;
      items.push({ id: n.id, ref: n.ref, kind: it.dir ? "folder" : "note", parent: upIndex, depth, gx: it.ax, gy, w: it.w, h });
    }
  }
  const links = levelled(items, model.edges, new Map(notes.map((n, v) => [n.ref, noteIndex[v]])));
  for (const l of links) {
    const p = id.get(items[l.b].ref), q = id.get(items[l.a].ref);
    l.placed = l.s >= 2 && pos[p] < pos[q];
    if (l.placed && implied(p, q, l.s)) l.implied = true;
    const path = paths.get(p * N + q);
    if (l.placed && path) l.path = path;
  }
  return { W: innerW.get(model.root) + 2 * MARGIN, H, items, links };
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
