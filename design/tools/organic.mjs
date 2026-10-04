// Exploration: folders drawn as contours of where their contents sit, and routes solved to cross contours at right angles.
//
// Folder outline. Each folder gets a field: one bump per child (a note, or a soft disc for a subfolder), as wide as about half the
// spacing between its children. The outline is that field's contour at 0.6. No circle is drawn; positions still come from the packing.
//
// Routes. A line that meets every contour at a right angle is a line that runs straight up or down the slope (along the gradient).
// So routes are shortest paths on a grid where a step ALONG the slope is cheap and a step ACROSS it (along a contour) is dear,
// and where high ground costs a little more than low ground. Sideways travel then happens on flat ground between folders,
// and every wall is crossed going straight downhill. Used cells get cheaper, so later routes gather onto earlier ones.
import * as d3 from 'd3';

const SIZE = 1000;
export const THR = 0.5;

// The folder fields alone: F(folder, x, y), and the folders. The terrain uses them to stay inside the outlines.
export function folderFields(L) {
  const dirs = L.root.descendants().filter((n) => n.data.kind === 'dir' && n.parent);
  const spec = new Map();
  for (const f of dirs) {
    const kids = f.children;
    const nn = kids.map((c) => Math.min(...kids.filter((o) => o !== c).map((o) => Math.hypot(o.x - c.x, o.y - c.y)))).filter(Number.isFinite).sort((a, b) => a - b);
    const sigma = Math.max(10, nn.length ? nn[Math.floor(nn.length / 2)] * 0.6 : f.r * 0.5);
    spec.set(f, { sigma, kids: kids.map((c) => ({ x: c.x, y: c.y, rho: c.data.kind === 'dir' ? c.r * 0.7 : 0 })) });
  }
  const F = (f, x, y) => { const s = spec.get(f); let v = 0; for (const c of s.kids) { const d = Math.max(0, Math.hypot(x - c.x, y - c.y) - c.rho); v += Math.exp(-(d * d) / (2 * s.sigma * s.sigma)); } return v; };
  // 0 on and outside every top-level outline, rising to 1 a little way inside: multiplying the terrain by this keeps every
  // understanding contour inside the folder outline and running alongside it, so the two families of lines never cross
  const tops = L.root.children.filter((n) => n.data.kind === 'dir');
  const inside = (x, y) => { let m = 0; for (const f of tops) { if (Math.hypot(x - f.x, y - f.y) > f.r * 1.8) continue; const t = Math.max(0, Math.min(1, (F(f, x, y) - THR) / 0.45)); m = Math.max(m, t * t * (3 - 2 * t)); } return m; };
  return { dirs, F, inside };
}

export function organic(L, T, { STEP = 3, RS = 4, lambda = 6, mu = 0.7, uWeight = 0.5, bundle = 0.25, detour = 6 } = {}) {
  const G = Math.ceil(SIZE / STEP);
  const { dirs, F } = folderFields(L);
  const gen = d3.contours().size([G, G]);
  const shape = new Map();
  for (const f of dirs) {
    const vals = new Float64Array(G * G), R = f.r * 1.6;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const x = i * STEP, y = j * STEP; if (Math.abs(x - f.x) < R && Math.abs(y - f.y) < R) vals[j * G + i] = F(f, x, y); }
    shape.set(f, gen.contour(vals, THR));
  }
  // ---- the routing field and its slope ----
  const N = Math.ceil(SIZE / RS) + 1;
  const Hf = (x, y) => { let v = uWeight * T.field(x, y); for (const f of dirs) if (Math.hypot(x - f.x, y - f.y) < f.r * 1.8) v += F(f, x, y); return v; };
  const Hg = new Float64Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) Hg[j * N + i] = Hf(i * RS, j * RS);
  const gx = new Float64Array(N * N), gy = new Float64Array(N * N), gm = new Float64Array(N * N);
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const id = j * N + i; gx[id] = (Hg[id + 1] - Hg[id - 1]) / (2 * RS); gy[id] = (Hg[id + N] - Hg[id - N]) / (2 * RS); gm[id] = Math.hypot(gx[id], gy[id]); }
  const G0 = 0.004;
  const NB = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { if ((!dx && !dy) || (Math.abs(dx) === 2 && Math.abs(dy) === 2) || (dx % 2 === 0 && dy % 2 === 0 && (Math.abs(dx) === 2 || Math.abs(dy) === 2))) continue; const l = Math.hypot(dx, dy); NB.push([dx, dy, l, dx / l, dy / l]); }
  const discount = new Float32Array(N * N).fill(1);
  // which folders each grid cell lies inside, so a route can be charged for cutting through a folder it has no business in
  const owners = Array.from({ length: N * N }, () => []);
  for (const f of dirs) for (let j = Math.max(0, Math.floor((f.y - f.r * 1.5) / RS)); j < Math.min(N, (f.y + f.r * 1.5) / RS); j++) for (let i = Math.max(0, Math.floor((f.x - f.r * 1.5) / RS)); i < Math.min(N, (f.x + f.r * 1.5) / RS); i++) if (F(f, i * RS, j * RS) > THR) owners[j * N + i].push(f);

  function path(ax, ay, bx, by, allowed) {
    const s = Math.round(ay / RS) * N + Math.round(ax / RS), t = Math.round(by / RS) * N + Math.round(bx / RS);
    const dist = new Float64Array(N * N).fill(Infinity), prev = new Int32Array(N * N).fill(-1);
    const heap = [[0, s]]; dist[s] = 0;
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [d, u] = pop(); if (d > dist[u]) continue; if (u === t) break;
      const ui = u % N, uj = (u / N) | 0;
      for (const [dx, dy, l, ux, uy] of NB) {
        const vi = ui + dx, vj = uj + dy; if (vi < 1 || vj < 1 || vi >= N - 1 || vj >= N - 1) continue;
        const v = vj * N + vi;
        const mgx = (gx[u] + gx[v]) / 2, mgy = (gy[u] + gy[v]) / 2, mm = Math.hypot(mgx, mgy);
        const along = mm > 1e-9 ? (ux * mgx + uy * mgy) / mm : 0, cross = 1 - along * along, w = mm / (mm + G0);
        const h = Math.min(3, (Hg[u] + Hg[v]) / 2) / 3;
        const foreign = owners[v].some((f) => !allowed.has(f)) ? detour : 1;
        const nd = d + l * RS * (1 + lambda * cross * w) * (1 + mu * h) * discount[v] * foreign;
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push([nd, v]); }
      }
    }
    const out = []; for (let u = t; u !== -1; u = prev[u]) { out.push([(u % N) * RS, ((u / N) | 0) * RS]); if (bundle) discount[u] = Math.max(0.4, discount[u] * (1 - bundle)); }
    out.reverse(); out[0] = [ax, ay]; out[out.length - 1] = [bx, by];
    return out;
  }
  // straighten the grid's staircase before rounding it: drop points that sit within eps of the line through their neighbours
  const rdp = (P, eps) => { if (P.length < 3) return P; let dm = 0, im = 0; const [a, b] = [P[0], P[P.length - 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    for (let i = 1; i < P.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - P[i][1]) - (a[0] - P[i][0]) * (b[1] - a[1])) / L; if (d > dm) { dm = d; im = i; } }
    return dm > eps ? [...rdp(P.slice(0, im + 1), eps).slice(0, -1), ...rdp(P.slice(im), eps)] : [a, b]; };
  const chaikin = (P) => { const o = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(P[P.length - 1]); return o; };

  const angles = [];
  // how far from a right angle a route meets folder f's outline (degrees)
  function measure(P, f) {
    for (let i = 1; i < P.length; i++) {
      const a = F(f, P[i - 1][0], P[i - 1][1]) - THR, b = F(f, P[i][0], P[i][1]) - THR;
      if (a * b < 0) {
        const j0 = Math.max(0, i - 3), j1 = Math.min(P.length - 1, i + 2), ux = P[j1][0] - P[j0][0], uy = P[j1][1] - P[j0][1], ul = Math.hypot(ux, uy) || 1;
        const x = (P[i - 1][0] + P[i][0]) / 2, y = (P[i - 1][1] + P[i][1]) / 2, e = 1.5;
        const fx = F(f, x + e, y) - F(f, x - e, y), fy = F(f, x, y + e) - F(f, x, y - e), fl = Math.hypot(fx, fy) || 1;
        angles.push((Math.acos(Math.min(1, Math.abs((ux * fx + uy * fy) / (ul * fl)))) * 180) / Math.PI);
      }
    }
  }

  // a route between two shown items (notes or folders), in layout units; folder ends are cut just inside the outline so the crossing shows
  function route(p, q) {
    let P = path(p.x, p.y, q.x, q.y, new Set([...p.ancestors(), ...q.ancestors()]));
    P = chaikin(chaikin(chaikin(rdp(P, RS * 0.9))));
    for (const f of new Set([...p.ancestors(), ...q.ancestors()].filter((n) => n.depth >= 1 && n.data.kind === 'dir'))) measure(P, f);
    // a folder end stops exactly on the folder's outline
    const cut = (Q, f) => { // Q runs from inside f outward
      const i = Q.findIndex((pt) => F(f, pt[0], pt[1]) < THR); if (i <= 0) return Q;
      let a = Q[i - 1], b = Q[i]; for (let n = 0; n < 12; n++) { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (F(f, m[0], m[1]) < THR) b = m; else a = m; }
      return [b, ...Q.slice(i)]; };
    if (p.data.kind === 'dir') P = cut(P, p);
    if (q.data.kind === 'dir') P = cut(P.slice().reverse(), q).reverse();
    return P;
  }
  const stats = () => { const a = angles.slice().sort((x, y) => x - y); return { n: a.length, median: a.length ? a[Math.floor(a.length / 2)] : 0, p90: a.length ? a[Math.floor(a.length * 0.9)] : 0 }; };
  const box = (f) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const poly of shape.get(f).coordinates) for (const [x, y] of poly[0]) { x0 = Math.min(x0, x * STEP); x1 = Math.max(x1, x * STEP); y0 = Math.min(y0, y * STEP); y1 = Math.max(y1, y * STEP); } return { x0, y0, x1, y1 }; };
  return { shape, F, route, stats, box };
}
