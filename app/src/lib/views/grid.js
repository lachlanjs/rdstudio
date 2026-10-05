// The grid Atlas (T63, design/project/README.md "The grid Atlas", ported from
// design/tools/grid.mjs and gridopt.mjs). Everything sits on a coarse square
// grid.
//
// Layout   Positions come from the smooth layout (layout.js) and are snapped
//          to cells: inside each folder the children keep their relative
//          places, scaled down as far as they go and nudged apart until notes
//          have GAP_NOTES clear cells between them and folders GAP_FOLDERS. A
//          note is a block of 8 by 2 cells, larger with many links. A folder
//          has a title row, a free row and a margin inside its wall.
// Search   Optionally (searched), positions and routes are optimised together
//          by simulated annealing, and folders become free-form regions: the
//          cells within reach of their notes (freeG). Slow, so it runs in the
//          layout worker within a time budget, and its result is cached.
// Height   Nesting: 0 between folders, 1 inside one, 2 inside a subfolder.
// Routes   A* over cells with 45 degree steps. A step costs its length, plus
//          CLIMB per change of height, a little per turn, FOREIGN per cell of
//          a folder the route has no business in, and CROWD per route already
//          in the cell (NEAR per route beside it). Notes and title rows are
//          blocked. Each route is re-routed twice once the others are down.
// Lanes    Routes sharing a cell edge take different offsets and run side by
//          side; a later route is drawn over an earlier one with a gap.

const GAP_NOTES = 2, GAP_FOLDERS = 3, PAD = 2, TIGHT = 0.5, MARGIN = 3;

const isNote = (n) => n.data.kind === "concept";
const folderOf = (n) => n.data.kind === "dir" && n.children;

/**
 * Snap a laid-out hierarchy (x, y from the smooth layout) to the grid.
 * Sets gx, gy, w, h (cells) on every node. deg: links per note ref.
 */
export function build(root, deg, { gapN = GAP_NOTES, gapF = GAP_FOLDERS } = {}) {
  const size = (n) => {
    if (!folderOf(n)) { // a note, or an empty folder (drawn as a small block)
      const d = deg.get(n.data.ref) || 0;
      n.w = isNote(n) ? (d >= 6 ? 9 : 8) : 6; n.h = d >= 9 ? 3 : 2;
      return;
    }
    n.children.forEach(size);
    const kids = n.children, gap = n.depth === 0 || kids.some(folderOf) ? gapF : gapN;
    const clear = (P) => P.every((a, i) => P.every((b, j) => j <= i || !(a.x < b.x + b.c.w + gap && b.x < a.x + a.c.w + gap && a.y < b.y + b.c.h + gap && b.y < a.y + a.c.h + gap)));
    const at = (k) => kids.map((c) => ({ c, x: Math.round((c.x - n.x) * k - c.w / 2), y: Math.round((c.y - n.y) * k - c.h / 2) }));
    // The scale at which nothing touches without nudging; then tighter
    // scales, nudging apart whatever overlaps, keeping the tightest that settles.
    let kc = 0.02;
    while (kc < 40 && !clear(at(kc))) kc *= 1.05;
    const relax = (P) => {
      for (let it = 0; it < 300; it++) {
        let moved = false;
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
          const a = P[i], b = P[j];
          const px = Math.min(a.x + a.c.w, b.x + b.c.w) + gap - Math.max(a.x, b.x), py = Math.min(a.y + a.c.h, b.y + b.c.h) + gap - Math.max(a.y, b.y);
          const ox = (a.c.w + b.c.w) / 2 + gap - Math.abs(a.x + a.c.w / 2 - b.x - b.c.w / 2), oy = (a.c.h + b.c.h) / 2 + gap - Math.abs(a.y + a.c.h / 2 - b.y - b.c.h / 2);
          if (ox <= 0 || oy <= 0 || px <= 0 || py <= 0) continue;
          moved = true;
          if (ox < oy) { const d = Math.ceil(ox), s = a.x + a.c.w / 2 <= b.x + b.c.w / 2 ? 1 : -1; a.x -= s * Math.floor(d / 2); b.x += s * Math.ceil(d / 2); }
          else { const d = Math.ceil(oy), s = a.y + a.c.h / 2 <= b.y + b.c.h / 2 ? 1 : -1; a.y -= s * Math.floor(d / 2); b.y += s * Math.ceil(d / 2); }
        }
        if (!moved) return true;
      }
      return false;
    };
    let P = at(kc);
    for (let k = kc * TIGHT; k < kc; k *= 1.06) { const Q = at(k); if (relax(Q) && clear(Q)) { P = Q; break; } }
    const x0 = Math.min(...P.map((p) => p.x)), y0 = Math.min(...P.map((p) => p.y));
    for (const p of P) { p.c.rx = p.x - x0; p.c.ry = p.y - y0; }
    const bw = Math.max(...P.map((p) => p.c.rx + p.c.w)), bh = Math.max(...P.map((p) => p.c.ry + p.c.h));
    if (n.depth === 0) { n.w = bw; n.h = bh; } else { n.w = bw + 2 * PAD; n.h = bh + PAD + 2 + PAD; } // walls; title row and free row; floor
  };
  const place = (n, x, y) => {
    n.gx = x; n.gy = y;
    if (!folderOf(n)) return;
    for (const c of n.children) place(c, x + (n.depth === 0 ? 0 : PAD) + c.rx, y + (n.depth === 0 ? 0 : 2 + PAD) + c.ry);
  };
  size(root);
  place(root, MARGIN, MARGIN);
  for (const f of root.descendants()) delete f.mask;
  return cells(root, root.w + 2 * MARGIN, root.h + 2 * MARGIN);
}

// The facts the router and the drawing need, per cell.
function cells(root, W, H, titles = null) {
  const elev = new Int8Array(W * H), blocked = new Uint8Array(W * H), owner = new Array(W * H).fill(null);
  const folders = root.descendants().filter((n) => folderOf(n) && n.depth > 0).sort((a, b) => a.depth - b.depth);
  for (const f of folders) {
    for (let j = f.gy; j < f.gy + f.h; j++) for (let i = f.gx; i < f.gx + f.w; i++) {
      if (f.mask && !f.mask[j * W + i]) continue;
      elev[j * W + i] = f.depth; owner[j * W + i] = f;
    }
    if (!f.mask) { f.tx = f.gx; f.ty = f.gy; f.tw = f.w; }
  }
  for (const f of folders) for (let i = f.tx; i < f.tx + f.tw; i++) blocked[f.ty * W + i] = 2; // the title row
  for (const n of root.leaves()) for (let j = n.gy; j < n.gy + n.h; j++) for (let i = n.gx; i < n.gx + n.w; i++) blocked[j * W + i] = 1;
  return { root, W, H, elev, blocked, owner, folders };
}

// ------------------------------------------------------------- free-form folders

const reachOf = (f, spread) => Math.max(2, Math.ceil(spread / 2) + 1) + 2 * (f.height - 1);

/** Folders as regions: every cell within reach of one of their notes, with
 *  narrow notches filled; the title takes the row above the topmost note. */
export function freeG(root, spread = 2) {
  const leaves = root.leaves(), CL = 2;
  const folders = root.descendants().filter((n) => folderOf(n) && n.depth > 0).sort((a, b) => a.depth - b.depth);
  const M = Math.max(3, ...folders.map((f) => reachOf(f, spread))) + 3;
  const x0 = Math.min(...leaves.map((n) => n.gx)) - M, y0 = Math.min(...leaves.map((n) => n.gy)) - M;
  for (const n of leaves) { n.gx -= x0; n.gy -= y0; }
  const W = Math.max(...leaves.map((n) => n.gx + n.w)) + M, H = Math.max(...leaves.map((n) => n.gy + n.h)) + M;
  const owner = new Array(W * H).fill(null);
  for (const f of folders) {
    const D = reachOf(f, spread), big = new Uint8Array(W * H), tmp = new Uint8Array(W * H), mask = new Uint8Array(W * H);
    for (const n of f.leaves()) for (let j = Math.max(0, n.gy - D - CL); j < Math.min(H, n.gy + n.h + D + CL); j++) for (let i = Math.max(0, n.gx - D - CL); i < Math.min(W, n.gx + n.w + D + CL); i++) big[j * W + i] = 1;
    for (let j = 0; j < H; j++) for (let i = CL; i < W - CL; i++) { let v = 1; for (let k = -CL; k <= CL; k++) v &= big[j * W + i + k]; tmp[j * W + i] = v; }
    for (let j = CL; j < H - CL; j++) for (let i = 0; i < W; i++) { let v = 1; for (let k = -CL; k <= CL; k++) v &= tmp[(j + k) * W + i]; mask[j * W + i] = v; }
    let ax = W, ay = H, bx = 0, by = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (mask[j * W + i]) { owner[j * W + i] = f; ax = Math.min(ax, i); ay = Math.min(ay, j); bx = Math.max(bx, i); by = Math.max(by, j); }
    Object.assign(f, { mask, gx: ax, gy: ay, w: bx - ax + 1, h: by - ay + 1 });
  }
  for (const f of folders) {
    const top = f.leaves().reduce((a, b) => (b.gy < a.gy || (b.gy === a.gy && b.gx < a.gx) ? b : a)), ty = Math.max(0, top.gy - reachOf(f, spread));
    let a = top.gx, b = top.gx;
    while (a > 0 && owner[ty * W + a - 1] === f) a--;
    while (b < W - 1 && owner[ty * W + b + 1] === f && b - a < 30) b++;
    Object.assign(f, { tx: a, ty, tw: b - a + 1 });
  }
  root.gx = 0; root.gy = 0; root.w = W; root.h = H;
  return cells(root, W, H);
}

// ------------------------------------------------------------- routing

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** The grid as plain data a worker can take: cells' height, what blocks
 *  them, and which folder each lies in (its index + 1, or 0). Kept on G. */
export function plainGrid(G) {
  if (G.plain) return G.plain;
  const index = new Map(G.folders.map((f, k) => [f, k + 1]));
  const owner = new Int32Array(G.W * G.H);
  for (let c = 0; c < owner.length; c++) owner[c] = G.owner[c] ? index.get(G.owner[c]) : 0;
  G.index = index;
  G.plain = { W: G.W, H: G.H, elev: G.elev, blocked: G.blocked, owner };
  return G.plain;
}

/** One end of a route, as plain data: the free cells touching block b from
 *  outside (with the point on b's edge each leaves from), its box, and the
 *  folders it lies in (a route may cross those for free). */
export function endOf(G, b) {
  const { W, H, blocked } = G, ring = [];
  if (b.mask) {
    for (let j = b.gy; j < b.gy + b.h; j++) for (let i = b.gx; i < b.gx + b.w; i++) {
      if (!b.mask[j * W + i]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + dx, nj = j + dy;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H || b.mask[nj * W + ni] || blocked[nj * W + ni]) continue;
        ring.push(ni, nj, i + 0.5 + dx / 2, j + 0.5 + dy / 2);
      }
    }
  } else {
    const add = (i, j, x, y) => { if (i >= 0 && j >= 0 && i < W && j < H && !blocked[j * W + i]) ring.push(i, j, x, y); };
    for (let i = b.gx; i < b.gx + b.w; i++) { add(i, b.gy - 1, i + 0.5, b.gy); add(i, b.gy + b.h, i + 0.5, b.gy + b.h); }
    for (let j = b.gy; j < b.gy + b.h; j++) { add(b.gx - 1, j, b.gx, j + 0.5); add(b.gx + b.w, j, b.gx + b.w, j + 0.5); }
  }
  plainGrid(G);
  return { ring, box: [b.gx, b.gy, b.w, b.h], up: b.ancestors().map((f) => G.index.get(f)).filter(Boolean) };
}

/**
 * Route each ask ({a, b}: ends from endOf), heaviest first, each re-routed
 * once or twice after the others are down. Plain data in and out, so it runs
 * in the layout worker. Returns [{cells, pts}] in the asks' order.
 */
export function routeCells(P, asks, { climb = 5, turn45 = 0.35, turn90 = 0.9, foreign = 2.5, crowd = 0.45, near = 0.3 } = {}) {
  const { W, H, elev, blocked, owner } = P;
  const use = new Uint16Array(W * H), beside = new Uint16Array(W * H);
  const mark = (c, d) => {
    use[c] += d;
    const i = c % W, j = (c / W) | 0;
    for (let y = Math.max(0, j - 1); y <= Math.min(H - 1, j + 1); y++) for (let x = Math.max(0, i - 1); x <= Math.min(W - 1, i + 1); x++) if (x !== i || y !== j) beside[y * W + x] += d;
  };
  const dist = new Float32Array(W * H * 9), prev = new Int32Array(W * H * 9), seen = new Uint32Array(W * H * 9);
  let heapK = new Float64Array(4096), heapV = new Int32Array(4096), stamp = 0;
  function route(a, b) {
    const allowed = new Set([...a.up, ...b.up]);
    if (!a.ring.length || !b.ring.length) return null;
    const dst = new Map();
    for (let k = 0; k < b.ring.length; k += 4) dst.set(b.ring[k + 1] * W + b.ring[k], k);
    const [bgx, bgy, bw, bh] = b.box, [agx, agy, aw, ah] = a.box;
    const tx = bgx + bw / 2, ty = bgy + bh / 2;
    const hfn = (i, j) => { const dx = Math.abs(i + 0.5 - tx), dy = Math.abs(j + 0.5 - ty); return Math.max(0, Math.max(dx, dy) + 0.41 * Math.min(dx, dy) - Math.max(bw, bh)); };
    stamp++;
    // Search a window around both ends, not the whole grid.
    const span = Math.max(Math.max(agx + aw, bgx + bw) - Math.min(agx, bgx), Math.max(agy + ah, bgy + bh) - Math.min(agy, bgy));
    const pad = Math.max(12, Math.round(span * 0.4));
    const wx0 = Math.max(0, Math.min(agx, bgx) - pad), wx1 = Math.min(W - 1, Math.max(agx + aw, bgx + bw) + pad);
    const wy0 = Math.max(0, Math.min(agy, bgy) - pad), wy1 = Math.min(H - 1, Math.max(agy + ah, bgy + bh) + pad);
    let size = 0;
    const push = (k, v) => {
      if (size === heapK.length) { const K = new Float64Array(size * 2), V = new Int32Array(size * 2); K.set(heapK); V.set(heapV); heapK = K; heapV = V; }
      let i = size++;
      while (i > 0) { const p = (i - 1) >> 1; if (heapK[p] <= k) break; heapK[i] = heapK[p]; heapV[i] = heapV[p]; i = p; }
      heapK[i] = k; heapV[i] = v;
    };
    let topK = 0;
    const pop = () => {
      const v = heapV[0];
      topK = heapK[0];
      size--;
      const k = heapK[size], w = heapV[size];
      let i = 0;
      for (;;) { const l = 2 * i + 1; if (l >= size) break; const c = l + 1 < size && heapK[l + 1] < heapK[l] ? l + 1 : l; if (heapK[c] >= k) break; heapK[i] = heapK[c]; heapV[i] = heapV[c]; i = c; }
      heapK[i] = k; heapV[i] = w;
      return v;
    };
    const D = (s) => (seen[s] === stamp ? dist[s] : Infinity);
    const set = (s, g, p) => { seen[s] = stamp; dist[s] = g; prev[s] = p; };
    const start = new Map();
    for (let k = 0; k < a.ring.length; k += 4) {
      const i = a.ring[k], j = a.ring[k + 1], c = j * W + i, s = c * 9 + 8, g = 1 + crowd * use[c];
      if (g < D(s)) { set(s, g, -1); push(g + hfn(i, j), s); start.set(c, k); }
    }
    let end = -1;
    while (size) {
      const s = pop();
      const c = (s / 9) | 0, d = s % 9, g = D(s);
      if (topK - hfn(c % W, (c / W) | 0) > g + 1e-4) continue;
      if (dst.has(c)) { end = s; break; }
      const ci = c % W, cj = (c / W) | 0;
      for (let k = 0; k < 8; k++) {
        const dx = DIRS[k][0], dy = DIRS[k][1], ni = ci + dx, nj = cj + dy;
        if (ni < wx0 || nj < wy0 || ni > wx1 || nj > wy1) continue;
        const nc = nj * W + ni;
        if (blocked[nc]) continue;
        if (dx && dy) { const c1 = cj * W + ni, c2 = nj * W + ci; if (blocked[c1] || blocked[c2] || elev[c1] !== elev[c] || elev[c2] !== elev[c] || elev[nc] !== elev[c]) continue; } // no cutting corners
        let cost = (dx && dy ? 1.414 : 1) * (1 + crowd * use[nc] + near * beside[nc]) + climb * Math.abs(elev[nc] - elev[c]);
        if (d !== 8 && d !== k) { const t = Math.min((k - d + 8) % 8, (d - k + 8) % 8); cost += t === 1 ? turn45 : turn90 * (t >= 3 ? 2 : 1); }
        if (owner[nc] && !allowed.has(owner[nc])) cost += foreign;
        const ns = nc * 9 + k, ng = g + cost;
        if (ng < D(ns)) { set(ns, ng, s); push(ng + hfn(ni, nj), ns); }
      }
    }
    if (end < 0) return null;
    const cells = [];
    for (let s = end; s !== -1; s = prev[s]) cells.push((s / 9) | 0);
    cells.reverse();
    for (const c of cells) mark(c, 1);
    const ak = start.get(cells[0]), bk = dst.get(cells[cells.length - 1]);
    return { cells, pts: [[a.ring[ak + 2], a.ring[ak + 3]], ...cells.map((c) => [(c % W) + 0.5, ((c / W) | 0) + 0.5]), [b.ring[bk + 2], b.ring[bk + 3]]] };
  }
  const out = asks.map((q) => route(q.a, q.b) || { cells: [], pts: [] });
  // Each reconsiders twice once the others are down; once, or not at all, on a busy map.
  const passes = asks.length > 60 ? 0 : asks.length > 25 ? 1 : 2;
  for (let pass = 0; pass < passes; pass++) asks.forEach((q, k) => {
    if (!out[k].cells.length) return;
    for (const c of out[k].cells) mark(c, -1);
    out[k] = route(q.a, q.b) || { cells: [], pts: [] };
  });
  return out;
}

/** Route pairs ([{p, q, ...}]) here and now (tests, and without a worker). */
export function routeAll(G, list, router = {}) {
  const res = routeCells(plainGrid(G), list.map((m) => ({ a: endOf(G, m.p), b: endOf(G, m.q) })), router);
  list.forEach((m, k) => Object.assign(m, res[k]));
  lanes(list.filter((m) => m.cells.length));
  return list;
}

// Lanes: routes sharing a cell edge get different offsets (in lane steps).
export function lanes(routes) {
  const key = (a, b) => (a < b ? a + ":" + b : b + ":" + a), at = new Map();
  routes.forEach((r, i) => { r.edges = new Set(); for (let k = 1; k < r.cells.length; k++) { const e = key(r.cells[k - 1], r.cells[k]); r.edges.add(e); (at.get(e) || at.set(e, []).get(e)).push(i); } });
  const OFF = [0, 1, -1, 2, -2, 3, -3];
  routes.forEach((r, i) => { const taken = new Set(); for (const e of r.edges) for (const j of at.get(e)) if (j < i) taken.add(routes[j].lane); r.lane = OFF.find((o) => !taken.has(o)) ?? 0; });
}

/** Offset a polyline sideways by o, one normal per undirected segment direction. */
export function offsetLine(P, o) {
  if (!o) return P;
  const nrm = (a, b) => { let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; if (dx < -1e-6 || (Math.abs(dx) < 1e-6 && dy < 0)) { dx = -dx; dy = -dy; } return [-dy, dx]; };
  return P.map((p, i) => {
    const n1 = i > 0 ? nrm(P[i - 1], p) : nrm(p, P[i + 1]), n2 = i < P.length - 1 ? nrm(p, P[i + 1]) : n1, d = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    return d < 0.2 ? [p[0] + n1[0] * o, p[1] + n1[1] * o] : [p[0] + ((n1[0] + n2[0]) / d) * o, p[1] + ((n1[1] + n2[1]) / d) * o];
  });
}

/** Straight runs with rounded bends. */
export function roundPath(P, r) {
  const Q = P.filter((p, i) => i === 0 || i === P.length - 1 || Math.abs((p[0] - P[i - 1][0]) * (P[i + 1][1] - p[1]) - (p[1] - P[i - 1][1]) * (P[i + 1][0] - p[0])) > 1e-3);
  if (Q.length < 2) return "";
  let d = `M${Q[0][0].toFixed(1)} ${Q[0][1].toFixed(1)}`;
  for (let i = 1; i < Q.length - 1; i++) {
    const a = Q[i - 1], b = Q[i], c = Q[i + 1], l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]), rr = Math.min(r, l1 / 2, l2 / 2);
    d += `L${(b[0] - ((b[0] - a[0]) / l1) * rr).toFixed(1)} ${(b[1] - ((b[1] - a[1]) / l1) * rr).toFixed(1)}Q${b[0].toFixed(1)} ${b[1].toFixed(1)} ${(b[0] + ((c[0] - b[0]) / l2) * rr).toFixed(1)} ${(b[1] + ((c[1] - b[1]) / l2) * rr).toFixed(1)}`;
  }
  const z = Q[Q.length - 1];
  return d + `L${z[0].toFixed(1)} ${z[1].toFixed(1)}`;
}

// ------------------------------------------------------------- the search

const cross = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/**
 * Search note positions (simulated annealing on a stand-in for the routes).
 * The number of moves is fixed by `budget` and the size of the map (about
 * budget × 40,000 / (notes² + links² + links × notes)), so the result is the same on every
 * machine; a wall clock of four times the budget is only a safety net. Starts from the snapped grid, or from `start`
 * ({ref: [gx, gy]}) for the notes it knows, so a map keeps its places as
 * notes are added. Returns {ref: [gx, gy]} for every note.
 * Weights as the design's "loose, routes apart, north kept".
 */
export function search(root, links, { spread = 4, budget = 3000, start = null, seed = 7 } = {}) {
  const w = { len: 0.08, x: 6, over: 2, area: 1, north: 1, hold: 0.5, dense: 1 };
  const SCREEN = [1090, 836];
  const t0 = Date.now();
  const leaves = root.leaves(), n = leaves.length, idx = new Map(leaves.map((l, i) => [l, i]));
  const rand = rng(seed);
  const X = new Float64Array(n), Y = new Float64Array(n), Wd = leaves.map((l) => l.w), Ht = leaves.map((l) => l.h);
  leaves.forEach((l, i) => {
    const at = start?.[l.data.ref];
    X[i] = at ? at[0] : Math.round(l.gx * 1.25); Y[i] = at ? at[1] : Math.round(l.gy * 1.25);
  });
  const req = Array.from({ length: n }, () => new Int16Array(n));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const A = leaves[i].ancestors(), B = new Set(leaves[j].ancestors()), lca = A.find((a) => B.has(a));
    const ci = A[A.indexOf(lca) - 1], cj = leaves[j].ancestors().find((a) => a.parent === lca);
    const ei = folderOf(ci) ? reachOf(ci, spread) : 0, ej = folderOf(cj) ? reachOf(cj, spread) : 0;
    req[i][j] = req[j][i] = !ei && !ej ? spread : Math.max(spread, ei + ej + (ei && ej ? 2 : 1));
  }
  const dirs = root.descendants().filter((f) => folderOf(f) && f.depth > 0);
  const groups = dirs.map((f) => ({ ids: f.leaves().map((l) => idx.get(l)), thr: 2 * reachOf(f, spread) - 1 }));
  const folders = dirs.map((f) => f.leaves().map((l) => idx.get(l)));
  const byRef = new Map(leaves.map((l, i) => [l.data.ref, i]));
  const L = links.map(([a, b]) => [byRef.get(a), byRef.get(b)]).filter(([a, b]) => a !== undefined && b !== undefined);
  const rank = leaves.map((l) => l.data.rank || 0);
  const gap = (i, j) => Math.max(0, X[i] - X[j] - Wd[j], X[j] - X[i] - Wd[i], Y[i] - Y[j] - Ht[j], Y[j] - Y[i] - Ht[i]);
  const par = new Int32Array(n), find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  const cx = new Float64Array(n), cy = new Float64Array(n), bins = new Int16Array(4096);
  function cost() {
    let viol = 0, north = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const g = gap(i, j); if (g < req[i][j]) viol += req[i][j] - g; if (rank[i] !== rank[j] && (rank[i] - rank[j]) * (Y[j] - Y[i]) < 0) north++; }
    for (const g of groups) {
      for (const i of g.ids) par[i] = i;
      let c = g.ids.length;
      for (let a = 0; a < g.ids.length; a++) for (let b = a + 1; b < g.ids.length; b++) if (gap(g.ids[a], g.ids[b]) <= g.thr) { const p = find(g.ids[a]), q = find(g.ids[b]); if (p !== q) { par[p] = q; c--; } }
      viol += (c - 1) * 15;
    }
    let len = 0, xs = 0, over = 0, ax = Infinity, ay = Infinity, bx = -Infinity, by = -Infinity;
    for (let i = 0; i < n; i++) { cx[i] = X[i] + Wd[i] / 2; cy[i] = Y[i] + Ht[i] / 2; ax = Math.min(ax, X[i]); ay = Math.min(ay, Y[i]); bx = Math.max(bx, X[i] + Wd[i]); by = Math.max(by, Y[i] + Ht[i]); }
    for (let a = 0; a < L.length; a++) {
      const [p, q] = L[a], dx = Math.abs(cx[p] - cx[q]), dy = Math.abs(cy[p] - cy[q]);
      len += Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
      const P = [cx[p], cy[p]], Q = [cx[q], cy[q]];
      for (let b = a + 1; b < L.length; b++) { const [r, s] = L[b]; if (r === p || r === q || s === p || s === q) continue; if (cross(P, Q, [cx[r], cy[r]], [cx[s], cy[s]])) xs++; }
      const lx = Math.min(P[0], Q[0]), hx = Math.max(P[0], Q[0]), ly = Math.min(P[1], Q[1]), hy = Math.max(P[1], Q[1]);
      for (let k = 0; k < n; k++) {
        if (k === p || k === q || cx[k] < lx || cx[k] > hx || cy[k] < ly || cy[k] > hy) continue;
        const t = Math.abs((Q[0] - P[0]) * (P[1] - cy[k]) - (P[0] - cx[k]) * (Q[1] - P[1])) / (Math.hypot(Q[0] - P[0], Q[1] - P[1]) || 1);
        if (t < Ht[k] / 2 + 0.5) over++;
      }
    }
    let sprawl = 0;
    for (const f of folders) { let fx = Infinity, fy = Infinity, gx = -Infinity, gy = -Infinity; for (const i of f) { fx = Math.min(fx, X[i]); fy = Math.min(fy, Y[i]); gx = Math.max(gx, X[i] + Wd[i]); gy = Math.max(gy, Y[i] + Ht[i]); } sprawl += gx - fx + gy - fy; }
    let packed = 0;
    bins.fill(0);
    for (const [p, q] of L) {
      const k = Math.max(1, Math.ceil(Math.max(Math.abs(cx[p] - cx[q]), Math.abs(cy[p] - cy[q])) / 4));
      let last = -1;
      for (let t = 0; t <= k; t++) { const b = (((cx[p] + (cx[q] - cx[p]) * t / k) >> 3) & 63) + 64 * (((cy[p] + (cy[q] - cy[p]) * t / k) >> 3) & 63); if (b !== last) { packed += bins[b]++; last = b; } }
    }
    const cell = Math.min(SCREEN[0] / (bx - ax + 14), SCREEN[1] / (by - ay + 14));
    return { viol, total: 200 * viol + w.len * len + w.x * xs + w.over * over + w.area * 1000 / cell + w.north * 0.3 * north + w.hold * sprawl + w.dense * 0.5 * packed };
  }
  const sibs = root.descendants().filter(folderOf).map((f) => f.children.filter((c) => !folderOf(c)).map((c) => idx.get(c))).filter((s) => s.length > 1);
  const ri = (k) => Math.floor(rand() * k), rd = (k) => ri(2 * k + 1) - k;
  function move(small) {
    const r = rand();
    if (r < 0.5 || (small && r < 0.75) || !folders.length) { const i = ri(n); X[i] += rd(small ? 2 : 3); Y[i] += rd(small ? 2 : 3); }
    else if (r < 0.62 && !small) { const i = ri(n); X[i] += rd(10); Y[i] += rd(10); }
    else if (r < 0.77 && !small && sibs.length) {
      const s = sibs[ri(sibs.length)], a = s[ri(s.length)], b = s[ri(s.length)];
      const ax = X[a] + Wd[a] / 2, ay = Y[a] + Ht[a] / 2, bx = X[b] + Wd[b] / 2, by = Y[b] + Ht[b] / 2;
      X[a] = Math.round(bx - Wd[a] / 2); Y[a] = Math.round(by - Ht[a] / 2); X[b] = Math.round(ax - Wd[b] / 2); Y[b] = Math.round(ay - Ht[b] / 2);
    } else if (r < 0.95 || small) { const f = folders[ri(folders.length)], dx = rd(3), dy = rd(3); for (const i of f) { X[i] += dx; Y[i] += dy; } }
    else {
      const f = folders[ri(folders.length)], horiz = rand() < 0.5;
      let lo = Infinity, hi = -Infinity;
      for (const i of f) { lo = Math.min(lo, horiz ? X[i] : Y[i]); hi = Math.max(hi, horiz ? X[i] + Wd[i] : Y[i] + Ht[i]); }
      for (const i of f) { if (horiz) X[i] = lo + hi - X[i] - Wd[i]; else Y[i] = lo + hi - Y[i] - Ht[i]; }
    }
  }
  if (n > 1) {
    let cur = cost(), sx = X.slice(), sy = Y.slice();
    // Annealing: the temperature falls over a fixed number of moves. A warm
    // start (from places kept before) begins cooler, so it keeps them.
    // A move costs about notes² + links² + links × notes.
    // Calibrated so a search takes about its budget (about 3 ms a move for 130 notes and 250 links).
    const iters = Math.max(200, Math.min(200000, Math.round((budget * 40000) / (n * n + L.length * L.length + L.length * n + 1))));
    const T0 = start ? 4 : 25, T1 = 0.05, cap = t0 + budget * 1.5; // the clock is only a safety net, but a firm one
    for (let it = 0; it < iters; it++) {
      if (Date.now() > cap) break;
      const T = T0 * Math.pow(T1 / T0, it / iters);
      move(false);
      const c = cost();
      if (c.total <= cur.total || rand() < Math.exp((cur.total - c.total) / T)) { cur = c; sx = X.slice(); sy = Y.slice(); } else { X.set(sx); Y.set(sy); }
    }
    for (let it = 0; it < 20000 && cur.viol > 0 && Date.now() < cap; it++) { move(true); const c = cost(); if (c.total < cur.total) { cur = c; sx = X.slice(); sy = Y.slice(); } else { X.set(sx); Y.set(sy); } }
    X.set(sx); Y.set(sy);
  }
  return Object.fromEntries(leaves.map((l, i) => [l.data.ref, [X[i], Y[i]]]));
}
