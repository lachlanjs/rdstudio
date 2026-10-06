// The grid Atlas's routes (T62): shortest paths over cells with 45 degree
// steps, ported from the sketch's `makeRouter` (design/tools/grid.mjs).
//
// A step costs its length, more in a cell other routes use (`crowd`) or run
// beside (`near`), plus `climb` for each change of height (a folder's wall),
// a little for each turn, and `foreign` for each cell of a folder the route
// has no business in, and `hug` for each cell within the clearance of a note
// or a wall (cells.js `close`), so a route going round something stands off
// it. Notes are closed. A route ends on the edge of the block it joins.
//
// Unlike the sketch, the search's arrays are made once per layout and reused,
// and each search is held to a window around its two ends, so a map of a
// thousand notes routes in the time the sketch took for sixty.

import { foldersOf } from "./cells.js";

// Turns are dear (the sketch charged 0.35 and 0.9): the router draws back links and the links lit under the
// pointer, a few at a time, and each should take few turns.
export const ROUTER_DEFAULTS = { climb: 5, turn45: 1.5, turn90: 3, foreign: 2.5, crowd: 0.2, near: 0, hug: 2.5, haste: 3.2 };

const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1];
const BUSY = 3; // routes in a cell beyond this cost no more: a full corridor is full, and the search stays short
const START = 8; // the direction of a search's first cell: none yet

export function makeRouter(layout, cells, opts = {}) {
  const { climb, turn45, turn90, foreign, crowd, near, hug, haste } = { ...ROUTER_DEFAULTS, ...opts };
  const { W, H, elev, blocked, owner } = cells, close = cells.close || new Uint8Array(W * H), N = W * H, items = layout.items;
  const use = new Uint16Array(N), beside = new Uint16Array(N); // routes in each cell, and in the eight around it
  // A search's state is a cell and the direction it was entered by. `seen`
  // says which entries belong to the current search, so nothing is cleared.
  const dist = new Float32Array(N * 9), prev = new Int32Array(N * 9), seen = new Uint32Array(N * 9);
  const allow = new Uint32Array(items.length); // folders the current route may cross freely
  let gen = 0;

  // A binary heap of [estimate, cost so far, state], in typed arrays.
  let hf = new Float32Array(4096), hg = new Float32Array(4096), hs = new Int32Array(4096), hn = 0;
  const push = (f, g, s) => {
    if (hn === hf.length) {
      const grow = (old, Type) => { const next = new Type(old.length * 2); next.set(old); return next; };
      hf = grow(hf, Float32Array); hg = grow(hg, Float32Array); hs = grow(hs, Int32Array);
    }
    let i = hn++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= f) break;
      hf[i] = hf[p]; hg[i] = hg[p]; hs[i] = hs[p];
      i = p;
    }
    hf[i] = f; hg[i] = g; hs[i] = s;
  };
  const pop = () => { // leaves the top in (topG, topS)
    topG = hg[0]; topS = hs[0];
    const f = hf[--hn], g = hg[hn], s = hs[hn];
    let i = 0;
    for (;;) {
      let m = 2 * i + 1;
      if (m >= hn) break;
      if (m + 1 < hn && hf[m + 1] < hf[m]) m++;
      if (hf[m] >= f) break;
      hf[i] = hf[m]; hg[i] = hg[m]; hs[i] = hs[m];
      i = m;
    }
    hf[i] = f; hg[i] = g; hs[i] = s;
  };
  let topG = 0, topS = 0;

  const mark = (c, d) => {
    use[c] += d;
    const x = c % W, y = (c / W) | 0;
    for (let j = Math.max(0, y - 1); j <= Math.min(H - 1, y + 1); j++) {
      for (let i = Math.max(0, x - 1); i <= Math.min(W - 1, x + 1); i++) if (i !== x || j !== y) beside[j * W + i] += d;
    }
  };

  // The free cells touching a block from outside, each with the point on the
  // block's edge it leaves from: [cell, x, y].
  const ring = (b) => {
    const out = [];
    const add = (x, y, ex, ey) => { if (x >= 0 && y >= 0 && x < W && y < H && !blocked[y * W + x]) out.push([y * W + x, ex, ey]); };
    for (let x = b.gx; x < b.gx + b.w; x++) { add(x, b.gy - 1, x + 0.5, b.gy); add(x, b.gy + b.h, x + 0.5, b.gy + b.h); }
    for (let y = b.gy; y < b.gy + b.h; y++) { add(b.gx - 1, y, b.gx, y + 0.5); add(b.gx + b.w, y, b.gx + b.w, y + 0.5); }
    return out;
  };

  // `goal`: in place of an item b, the cells a route may end on, each with the point it is drawn to
  // ({ ends: Map(cell -> [cell, x, y]), folder }): a feeder ends on a trunk's foot inside `folder`,
  // or on a feeder already running to it.
  function search(a, b, x0, y0, x1, y1, goal = null) {
    gen++;
    hn = 0;
    for (const f of foldersOf(items, a)) allow[f] = gen;
    if (goal) { allow[goal.folder] = gen; for (const f of foldersOf(items, goal.folder)) allow[f] = gen; }
    else for (const f of foldersOf(items, b)) allow[f] = gen;
    const A = items[a], B = goal ? null : items[b];
    const ends = goal ? goal.ends : new Map(ring(B).map((r) => [r[0], r]));
    // What is left at least: the steps to the block's edge, overstated by
    // `haste`. With turns as dear as they are, a search at 1.6 took 130 ms on a
    // grid of a thousand notes (1,045 by 1,185 cells); at 3.2 it takes 9.
    let bx0, bx1, by0, by1;
    if (goal) {
      bx0 = by0 = Infinity; bx1 = by1 = -Infinity;
      for (const c of ends.keys()) { const x = c % W, y = (c / W) | 0; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
    } else { bx0 = B.gx - 1; bx1 = B.gx + B.w; by0 = B.gy - 1; by1 = B.gy + B.h; }
    const guess = (x, y) => { const dx = Math.max(bx0 - x, x - bx1, 0), dy = Math.max(by0 - y, y - by1, 0); return haste * (Math.max(dx, dy) + 0.414 * Math.min(dx, dy)); };
    const starts = new Map();
    for (const r of ring(A)) {
      const c = r[0], s = c * 9 + START, g = Math.fround(1 + crowd * Math.min(use[c], BUSY));
      if (seen[s] === gen && dist[s] <= g) continue;
      seen[s] = gen; dist[s] = g; prev[s] = -1;
      push(g + guess(c % W, (c / W) | 0), g, s);
      starts.set(c, r);
    }
    let end = -1;
    while (hn) {
      pop();
      const s = topS, g = topG;
      if (g !== dist[s]) continue; // a better way here was found since
      const c = (s / 9) | 0, d = s % 9;
      if (ends.has(c)) { end = s; break; }
      const cx = c % W, cy = (c / W) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k], ny = cy + DY[k];
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
        const nc = ny * W + nx;
        if (blocked[nc]) continue;
        if (DX[k] && DY[k]) { // no cutting the corners of walls or blocks
          const c1 = cy * W + nx, c2 = ny * W + cx;
          if (blocked[c1] || blocked[c2] || elev[c1] !== elev[c] || elev[c2] !== elev[c] || elev[nc] !== elev[c]) continue;
        }
        let cost = (DX[k] && DY[k] ? 1.414 : 1) * (1 + crowd * Math.min(use[nc], BUSY) + near * Math.min(beside[nc], BUSY)) + climb * Math.abs(elev[nc] - elev[c]);
        if (d !== START && d !== k) {
          const turn = Math.min((k - d + 8) % 8, (d - k + 8) % 8);
          cost += turn === 1 ? turn45 : turn90 * (turn >= 3 ? 2 : 1);
        }
        if (owner[nc] >= 0 && allow[owner[nc]] !== gen) cost += foreign;
        if (close[nc]) cost += hug;
        const ns = nc * 9 + k, ng = Math.fround(g + cost);
        if (seen[ns] === gen && dist[ns] <= ng) continue;
        seen[ns] = gen; dist[ns] = ng; prev[ns] = s;
        push(ng + guess(nx, ny), ng, ns);
      }
    }
    if (end < 0) return null;
    const path = [];
    for (let s = end; s !== -1; s = prev[s]) path.push((s / 9) | 0);
    path.reverse();
    for (const c of path) mark(c, 1);
    const from = starts.get(path[0]), to = ends.get(path[path.length - 1]);
    const pts = [[from[1], from[2]]];
    for (const c of path) pts.push([(c % W) + 0.5, ((c / W) | 0) + 0.5]);
    pts.push([to[1], to[2]]);
    return { cells: Int32Array.from(path), pts };
  }

  /** A route between two items (by index), or null when there is no way. */
  function route(a, b) {
    const A = items[a], B = items[b];
    const span = Math.max(Math.abs(A.gx - B.gx), Math.abs(A.gy - B.gy));
    const pad = Math.max(12, Math.ceil(span * 0.4));
    const x0 = Math.max(0, Math.min(A.gx, B.gx) - pad), y0 = Math.max(0, Math.min(A.gy, B.gy) - pad);
    const x1 = Math.min(W - 1, Math.max(A.gx + A.w, B.gx + B.w) + pad), y1 = Math.min(H - 1, Math.max(A.gy + A.h, B.gy + B.h) + pad);
    return search(a, b, x0, y0, x1, y1) || (x0 || y0 || x1 < W - 1 || y1 < H - 1 ? search(a, b, 0, 0, W - 1, H - 1) : null);
  }
  /** A route from an item to one of the cells of `to` (see `search`), within the folder's own ground. */
  function routeTo(a, to) {
    const A = items[a], F = items[to.folder];
    return search(a, -1, Math.max(0, Math.min(A.gx, F.gx) - 2), Math.max(0, Math.min(A.gy, F.gy) - 2), Math.min(W - 1, Math.max(A.gx + A.w, F.gx + F.w) + 2), Math.min(H - 1, Math.max(A.gy + A.h, F.gy + F.h) + 2), to);
  }
  /** Count a path that was not found here (a trunk the layout drew) as in use, so routes keep off it. */
  function occupy(pts) {
    const seen = new Set();
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
      for (let s = 0; s <= n; s++) {
        const x = Math.floor(x0 + ((x1 - x0) * s) / n), y = Math.floor(y0 + ((y1 - y0) * s) / n);
        if (x < 0 || y < 0 || x >= W || y >= H || blocked[y * W + x] || seen.has(y * W + x)) continue;
        seen.add(y * W + x);
        mark(y * W + x, 1);
      }
    }
  }
  const release = (r) => { for (const c of r.cells) mark(c, -1); };
  const hold = (r) => { for (const c of r.cells) mark(c, 1); }; // put back a route that was released
  return { route, routeTo, occupy, release, hold };
}

// Lanes: routes that share a cell edge take different offsets, so they run
// side by side. Each route gets `lane`, a whole number of steps to one side.
const OFFSETS = [0, 1, -1, 2, -2, 3, -3];
export function lanes(routes, cellCount) {
  const at = new Map();
  routes.forEach((r, i) => {
    r.edges = new Set();
    for (let k = 1; k < r.cells.length; k++) {
      const p = r.cells[k - 1], q = r.cells[k], e = p < q ? p * cellCount + q : q * cellCount + p;
      r.edges.add(e);
      if (!at.has(e)) at.set(e, []);
      at.get(e).push(i);
    }
  });
  routes.forEach((r, i) => {
    const taken = new Set();
    for (const e of r.edges) for (const j of at.get(e)) if (j < i) taken.add(routes[j].lane);
    r.lane = OFFSETS.find((o) => !taken.has(o)) ?? 0;
    delete r.edges;
  });
}

const cross = (a, b, c, d) => {
  const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
};

/**
 * How the routes read, as the sketch's GridExperiment measures them: how
 * often two cross, how many cells of route there are, and what share of
 * those have another route in the same cell or one touching it.
 */
export function measureRoutes(routes, W) {
  const who = new Map();
  routes.forEach((r, i) => { for (const c of r.cells) { if (!who.has(c)) who.set(c, new Set()); who.get(c).add(i); } });
  let length = 0, alone = 0;
  routes.forEach((r, i) => {
    for (const c of r.cells) {
      length++;
      let other = false;
      const x = c % W;
      for (let dy = -1; dy <= 1 && !other; dy++) for (let dx = -1; dx <= 1 && !other; dx++) {
        if (x + dx < 0 || x + dx >= W) continue;
        const o = who.get(c + dy * W + dx);
        if (o) for (const k of o) if (k !== i) { other = true; break; }
      }
      if (!other) alone++;
    }
  });
  // The bends of each route, with a tiny shift of its own, so that two routes
  // meeting at a cell's centre either cross or do not.
  const lines = routes.map((r, i) => {
    const e = [((i * 0.618) % 1) * 0.02 - 0.01, ((i * 0.414) % 1) * 0.02 - 0.01], P = r.pts;
    return P.filter((p, k) => k === 0 || k === P.length - 1 || Math.abs((p[0] - P[k - 1][0]) * (P[k + 1][1] - p[1]) - (p[1] - P[k - 1][1]) * (P[k + 1][0] - p[0])) > 1e-6)
      .map((p) => [p[0] + e[0], p[1] + e[1]]);
  });
  let crossings = 0;
  for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++) {
    const A = routes[i], B = routes[j];
    if (A.a === B.a || A.a === B.b || A.b === B.a || A.b === B.b) continue; // routes that share an end meet, they do not cross
    for (let p = 1; p < lines[i].length; p++) for (let q = 1; q < lines[j].length; q++) if (cross(lines[i][p - 1], lines[i][p], lines[j][q - 1], lines[j][q])) crossings++;
  }
  return { routes: routes.length, crossings, length, beside: length ? 1 - alone / length : 0 };
}

/**
 * Route every ask ({a, b}: item indices) in the order given, then let each
 * reconsider twice once the others are down (once, or not at all, when
 * there are hundreds). Returns one entry per ask
 * ({pts, lane}, or null where there is no way), and the measures.
 */
export function routeAll(router, asks, W, H, passes = asks.length <= 100 ? 2 : asks.length <= 300 ? 1 : 0) {
  const out = asks.map(({ a, b }) => { const r = router.route(a, b); return r && { a, b, ...r }; });
  for (let pass = 0; pass < passes; pass++) {
    out.forEach((r, i) => {
      if (!r) return;
      router.release(r);
      const again = router.route(r.a, r.b);
      if (again) Object.assign(r, again); else router.hold(r);
    });
  }
  const found = out.filter(Boolean);
  lanes(found, W * H);
  const measures = { ...measureRoutes(found, W), lost: out.length - found.length };
  for (const r of found) router.release(r); // the router is kept for the next set of asks
  return { routes: out.map((r) => r && { pts: r.pts, lane: r.lane }), measures };
}
