// Contour folders and downhill routes (T60, design/project/README.md "Atlas ·
// exploration"), the options beside circles and gates.
//
// Folder outlines. Each folder has a field with one bump per child (a note,
// or a soft disc for a subfolder), as wide as 0.6 of the median spacing
// between its children; the outline is that field's contour at THR. A
// parent's field contains its children's, so outlines nest. Positions are
// those of the circle layout.
//
// Routes. A line that meets every contour at a right angle runs straight up
// or down the slope, so routes are shortest paths on a grid where a step
// along the slope is cheap and a step across it (along a contour) costs up
// to 1 + LAMBDA times more, high ground a little more than low, and another
// folder's interior DETOUR times more. The slope is that of the folder fields
// plus half the understanding field. Cells a route uses get cheaper, so later
// routes gather onto earlier ones, like streams.
//
// The heavy parts run in the layout worker (layout-worker.js).

import { contours } from "d3";

export const THR = 0.5;
const SIZE = 1000;
const CELLS = 96; // across a folder's outline grid
const RS = 5; // the routing grid's step, in layout units
const LAMBDA = 6, MU = 0.7, DETOUR = 6, BUNDLE = 0.25, U_WEIGHT = 0.5, G0 = 0.004;

/** What a folder's field needs, as plain data: from a laid-out hierarchy. */
export function folderSpecs(root) {
  const out = [];
  root.each((f) => {
    if (f.data.kind !== "dir" || !f.parent || !f.children) return;
    const kids = f.children;
    const nn = kids.map((c) => Math.min(...kids.filter((o) => o !== c).map((o) => Math.hypot(o.x - c.x, o.y - c.y)))).filter(Number.isFinite).sort((a, b) => a - b);
    // Wider than the spacing's half, so an outline is round and leaves room
    // around what it holds rather than hugging each child.
    const sigma = Math.max(f.r * 0.06, nn.length ? nn[Math.floor(nn.length / 2)] * 0.85 : f.r * 0.5);
    const pts = [];
    for (const c of kids) pts.push(c.x, c.y, c.data.kind === "dir" ? c.r * 0.8 : 0);
    out.push({ id: f.data.id, depth: f.depth, x: f.x, y: f.y, r: f.r, sigma, kids: pts });
  });
  return out;
}

/** How much of a folder's field is kept at (x, y): all of it well inside
 *  the folder's circle, none at its edge, so a round outline never spills
 *  into a neighbour the layout packed beside it. */
export function discAt(spec, x, y) {
  const t = Math.max(0, Math.min(1, (spec.r - Math.hypot(x - spec.x, y - spec.y)) / (0.18 * spec.r)));
  return t * t * (3 - 2 * t);
}

/** A folder's field at (x, y). */
export function fieldAt(spec, x, y) {
  const two = 2 * spec.sigma * spec.sigma, k = spec.kids;
  let v = 0;
  for (let i = 0; i < k.length; i += 3) {
    const d = Math.max(0, Math.hypot(x - k[i], y - k[i + 1]) - k[i + 2]);
    v += Math.exp(-(d * d) / two);
  }
  return v * discAt(spec, x, y);
}

// Keep a stamped field within the folder's circle (discAt), cell by cell.
export function clampToDisc(spec, grid, x0, y0, cell, n, m) {
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) grid[j * n + i] *= discAt(spec, x0 + i * cell, y0 + j * cell);
}

// Add a folder's field onto a grid (x0, y0, cell, n wide, m high), each
// child's bump cut off at three widths beyond its disc.
export function stamp(spec, grid, x0, y0, cell, n, m, weight = 1) {
  const two = 2 * spec.sigma * spec.sigma, k = spec.kids;
  for (let c = 0; c < k.length; c += 3) {
    const cx = k[c], cy = k[c + 1], rho = k[c + 2], reach = rho + 3 * spec.sigma;
    const i0 = Math.max(0, Math.floor((cx - reach - x0) / cell)), i1 = Math.min(n - 1, Math.ceil((cx + reach - x0) / cell));
    const j0 = Math.max(0, Math.floor((cy - reach - y0) / cell)), j1 = Math.min(m - 1, Math.ceil((cy + reach - y0) / cell));
    for (let j = j0; j <= j1; j++) {
      const dy = y0 + j * cell - cy;
      for (let i = i0; i <= i1; i++) {
        const d = Math.max(0, Math.hypot(x0 + i * cell - cx, dy) - rho);
        grid[j * n + i] += weight * Math.exp(-(d * d) / two);
      }
    }
  }
}

/** Every folder's outline, in layout units: [{ id, shape: MultiPolygon coordinates, box: [x0, y0, x1, y1] }]. */
export function outlines(specs) {
  return specs.map((s) => {
    const half = s.r * 1.05, cell = (2 * half) / CELLS, x0 = s.x - half, y0 = s.y - half;
    const vals = new Float64Array(CELLS * CELLS);
    stamp(s, vals, x0 + cell / 2, y0 + cell / 2, cell, CELLS, CELLS);
    clampToDisc(s, vals, x0 + cell / 2, y0 + cell / 2, cell, CELLS, CELLS);
    const shape = contours().size([CELLS, CELLS]).contour(vals, THR).coordinates
      .map((poly) => poly.map((ring) => ring.map(([x, y]) => [round(x0 + x * cell), round(y0 + y * cell)])));
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const poly of shape) for (const [x, y] of poly[0]) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
    return { id: s.id, shape, box: shape.length ? [bx0, by0, bx1, by1] : [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r] };
  });
}

const round = (v) => Math.round(v * 100) / 100;

// ------------------------------------------------------------- routing

/** The routing grid for a layout and its understanding values: built once per key, in the worker.
 *  @param {{ specs: any[], notes: number[] }} input notes holds [x, y, value, width] per note. */
export function routingGrid({ specs, notes }) {
  const N = Math.ceil(SIZE / RS) + 1;
  const H = new Float64Array(N * N);
  for (const s of specs) stamp(s, H, 0, 0, RS, N, N);
  // Half the understanding field, normalised as the terrain is.
  const num = new Float64Array(N * N), den = new Float64Array(N * N);
  for (let p = 0; p < notes.length; p += 4) {
    const px = notes[p], py = notes[p + 1], v = notes[p + 2], s = notes[p + 3], reach = 3 * s, two = 2 * s * s;
    if (!v) continue;
    const i0 = Math.max(0, Math.floor((px - reach) / RS)), i1 = Math.min(N - 1, Math.ceil((px + reach) / RS));
    const j0 = Math.max(0, Math.floor((py - reach) / RS)), j1 = Math.min(N - 1, Math.ceil((py + reach) / RS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = i * RS - px, dy = j * RS - py, k = Math.exp(-(dx * dx + dy * dy) / two);
      num[j * N + i] += v * k; den[j * N + i] += k;
    }
  }
  for (let i = 0; i < H.length; i++) if (num[i]) H[i] += (U_WEIGHT * num[i]) / Math.pow(1 + den[i] ** 4, 0.25);
  const gx = new Float64Array(N * N), gy = new Float64Array(N * N);
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const id = j * N + i;
    gx[id] = (H[id + 1] - H[id - 1]) / (2 * RS);
    gy[id] = (H[id + N] - H[id - N]) / (2 * RS);
  }
  // Which folders each cell lies inside (by index into specs), so a route
  // can be charged for cutting through one it has no business in.
  const owners = new Map();
  specs.forEach((s, si) => {
    const R = s.r * 1.4;
    for (let j = Math.max(0, Math.floor((s.y - R) / RS)); j < Math.min(N, Math.ceil((s.y + R) / RS)); j++)
      for (let i = Math.max(0, Math.floor((s.x - R) / RS)); i < Math.min(N, Math.ceil((s.x + R) / RS)); i++) {
        if (fieldAt(s, i * RS, j * RS) <= THR) continue;
        const id = j * N + i;
        const list = owners.get(id);
        if (list) list.push(si); else owners.set(id, [si]);
      }
  });
  return { N, H, gx, gy, owners, specs, index: new Map(specs.map((s, i) => [s.id, i])) };
}

// Moves: the eight neighbours and the eight knight's moves, so lines are not
// held to eight directions.
const MOVES = [];
for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
  if ((!dx && !dy) || (Math.abs(dx) === 2 && Math.abs(dy) === 2) || (dx % 2 === 0 && dy % 2 === 0 && (Math.abs(dx) === 2 || Math.abs(dy) === 2))) continue;
  const l = Math.hypot(dx, dy);
  MOVES.push([dx, dy, l, dx / l, dy / l]);
}

/**
 * Routes on a grid, heaviest first, gathering as they go.
 * @param grid from routingGrid
 * @param {{ key: string, a: [number, number], b: [number, number], allowed: string[], ends: [string|null, string|null] }[]} asks
 *   ends: the folder each end is (cut on its outline), or null for a note.
 * @returns {{ routes: { key: string, pts: number[][], mid: number }[], angles: number[] }}
 */
export function routeAll(grid, asks) {
  const { N, H, gx, gy, owners, specs, index } = grid;
  const discount = new Float32Array(N * N).fill(1);
  const dist = new Float64Array(N * N), prev = new Int32Array(N * N), seen = new Uint32Array(N * N);
  let stampNo = 0;
  const closed = new Uint32Array(N * N);
  let heapK = new Float64Array(4096), heapV = new Int32Array(4096);
  const angles = [];
  const routes = asks.map((ask) => {
    const allowed = new Set(ask.allowed.map((id) => index.get(id)));
    const cellOf = ([x, y]) => Math.min(N - 2, Math.max(1, Math.round(y / RS))) * N + Math.min(N - 2, Math.max(1, Math.round(x / RS)));
    const s = cellOf(ask.a), t = cellOf(ask.b), ti = t % N, tj = (t / N) | 0;
    // Search a window around both ends (and the folders they are), not the whole map.
    let wx0 = Math.min(ask.a[0], ask.b[0]), wy0 = Math.min(ask.a[1], ask.b[1]), wx1 = Math.max(ask.a[0], ask.b[0]), wy1 = Math.max(ask.a[1], ask.b[1]);
    const pad = Math.max(60, 0.35 * Math.hypot(wx1 - wx0, wy1 - wy0));
    const i0 = Math.max(1, Math.floor((wx0 - pad) / RS)), i1 = Math.min(N - 2, Math.ceil((wx1 + pad) / RS));
    const j0 = Math.max(1, Math.floor((wy0 - pad) / RS)), j1 = Math.min(N - 2, Math.ceil((wy1 + pad) / RS));
    stampNo++;
    let size = 0;
    const push = (k, v) => {
      if (size === heapK.length) { const K = new Float64Array(size * 2), V = new Int32Array(size * 2); K.set(heapK); V.set(heapV); heapK = K; heapV = V; }
      let i = size++;
      while (i > 0) { const p = (i - 1) >> 1; if (heapK[p] <= k) break; heapK[i] = heapK[p]; heapV[i] = heapV[p]; i = p; }
      heapK[i] = k; heapV[i] = v;
    };
    const pop = () => {
      const top = heapV[0];
      size--;
      const k = heapK[size], w = heapV[size];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= size) break;
        const c = l + 1 < size && heapK[l + 1] < heapK[l] ? l + 1 : l;
        if (heapK[c] >= k) break;
        heapK[i] = heapK[c]; heapV[i] = heapV[c]; i = c;
      }
      heapK[i] = k; heapV[i] = w;
      return top;
    };
    const h = (u) => 0.4 * RS * Math.hypot((u % N) - ti, ((u / N) | 0) - tj); // never more than the true cost
    dist[s] = 0; prev[s] = -1; seen[s] = stampNo;
    push(h(s), s);
    while (size) {
      const u = pop();
      if (closed[u] === stampNo) continue; // a stale entry
      closed[u] = stampNo;
      if (u === t) break;
      const du = dist[u], ui = u % N, uj = (u / N) | 0;
      for (const [dx, dy, l, ux, uy] of MOVES) {
        const vi = ui + dx, vj = uj + dy;
        if (vi < i0 || vj < j0 || vi > i1 || vj > j1) continue;
        const v = vj * N + vi;
        const mgx = (gx[u] + gx[v]) / 2, mgy = (gy[u] + gy[v]) / 2, mm = Math.hypot(mgx, mgy);
        const along = mm > 1e-9 ? (ux * mgx + uy * mgy) / mm : 0, cross = 1 - along * along, w = mm / (mm + G0);
        const high = Math.min(3, (H[u] + H[v]) / 2) / 3;
        const own = owners.get(v);
        const foreign = own && own.some((f) => !allowed.has(f)) ? DETOUR : 1;
        const nd = du + l * RS * (1 + LAMBDA * cross * w) * (1 + MU * high) * discount[v] * foreign;
        if (closed[v] === stampNo) continue;
        if (seen[v] !== stampNo || nd < dist[v]) { seen[v] = stampNo; dist[v] = nd; prev[v] = u; push(nd + h(v), v); }
      }
    }
    let P = [];
    for (let u = t; u !== -1 && seen[u] === stampNo; u = prev[u]) {
      P.push([(u % N) * RS, ((u / N) | 0) * RS]);
      discount[u] = Math.max(0.4, discount[u] * (1 - BUNDLE));
      if (u === s) break;
    }
    P.reverse();
    if (P.length < 2) P = [ask.a, ask.b];
    P[0] = ask.a; P[P.length - 1] = ask.b;
    P = chaikin(chaikin(chaikin(rdp(P, RS * 0.9))));
    // How far from a right angle the route meets each outline it crosses.
    for (const id of ask.allowed) { const si = index.get(id); if (si !== undefined && specs[si].depth >= 1) measure(P, specs[si], angles); }
    // A folder end stops exactly on the folder's outline.
    const [ea, eb] = ask.ends.map((id) => (id && index.has(id) ? specs[index.get(id)] : null));
    if (ea) P = cut(P, ea);
    if (eb) P = cut(P.slice().reverse(), eb).reverse();
    // Where a count sits: half way along the part outside both end folders.
    const outside = P.map((p, i) => [i, [ea, eb].every((e) => !e || fieldAt(e, p[0], p[1]) < THR)]).filter(([, o]) => o).map(([i]) => i);
    const mid = outside.length ? outside[Math.floor(outside.length / 2)] : Math.floor(P.length / 2);
    return { key: ask.key, pts: P.map(([x, y]) => [round(x), round(y)]), mid };
  });
  return { routes, angles };
}

// Q runs from inside folder f outward: start it where it leaves the outline.
function cut(Q, f) {
  const i = Q.findIndex((p) => fieldAt(f, p[0], p[1]) < THR);
  if (i <= 0) return Q;
  let a = Q[i - 1], b = Q[i];
  for (let n = 0; n < 12; n++) {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (fieldAt(f, m[0], m[1]) < THR) b = m; else a = m;
  }
  return [b, ...Q.slice(i)];
}

function measure(P, f, out) {
  for (let i = 1; i < P.length; i++) {
    const a = fieldAt(f, P[i - 1][0], P[i - 1][1]) - THR, b = fieldAt(f, P[i][0], P[i][1]) - THR;
    if (a * b >= 0) continue;
    const j0 = Math.max(0, i - 3), j1 = Math.min(P.length - 1, i + 2), ux = P[j1][0] - P[j0][0], uy = P[j1][1] - P[j0][1], ul = Math.hypot(ux, uy) || 1;
    const x = (P[i - 1][0] + P[i][0]) / 2, y = (P[i - 1][1] + P[i][1]) / 2, e = 1.5;
    const fx = fieldAt(f, x + e, y) - fieldAt(f, x - e, y), fy = fieldAt(f, x, y + e) - fieldAt(f, x, y - e), fl = Math.hypot(fx, fy) || 1;
    out.push((Math.acos(Math.min(1, Math.abs((ux * fx + uy * fy) / (ul * fl)))) * 180) / Math.PI);
  }
}

// Straighten the grid's staircase before rounding it: drop points within eps
// of the line through their neighbours (Ramer–Douglas–Peucker), then cut
// corners (Chaikin).
function rdp(P, eps) {
  if (P.length < 3) return P;
  const a = P[0], b = P[P.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let dm = 0, im = 0;
  for (let i = 1; i < P.length - 1; i++) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - P[i][1]) - (a[0] - P[i][0]) * (b[1] - a[1])) / L;
    if (d > dm) { dm = d; im = i; }
  }
  return dm > eps ? [...rdp(P.slice(0, im + 1), eps).slice(0, -1), ...rdp(P.slice(im), eps)] : [a, b];
}
function chaikin(P) {
  const o = [P[0]];
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1];
    o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  o.push(P[P.length - 1]);
  return o;
}
