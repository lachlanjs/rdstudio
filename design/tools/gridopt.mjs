// Experiment: optimise where the notes sit and how the links run together, with folders as free regions of cells.
//
// Folders   A folder is the set of cells within D cells of any of its notes, with narrow notches filled. D is 2 for a folder of
//           notes and 2 more for each level of folders inside it. The wall is the outline of that set. Its title takes the run of
//           cells on the top row above its topmost note.
// Rules     (hard) two notes with the same parent keep `spread` clear cells; notes of different folders keep enough that the two
//           regions cannot touch and 2 cells stay free between them; every folder's notes stay close enough to form one region.
// Search    Simulated annealing over note positions: move a note, swap two siblings, move or mirror a whole folder.
//           Most moves are judged by a cheap stand-in for the routes (straight lines between notes): their length, how often they
//           cross, how often they pass over another note, and how small the cells get when the map is fitted to the screen.
// Then      A second pass judges moves by the real routes: every link is routed with the same A* as the sketches, and a move is
//           kept only if the measured crossings, length, bends and trespass improve.
import fs from 'node:fs';
import { EDGES } from './atlas2.mjs';
import { build, view, makeRouter, G_CSS, GROUP_G } from './grid.mjs';
import { page, A2_CSS } from './atlas2.mjs';
import { doc } from './marginalia.mjs';
import { ATLAS_CSS } from './survey.mjs';

const LINKS = EDGES.filter((e) => e[2] >= 2);
const SCREEN = [1090, 836];
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const D2 = (spread) => Math.max(2, Math.ceil(spread / 2) + 1);
const reachOf = (f, spread) => D2(spread) + 2 * (f.height - 1);

// ---------- from note positions to the facts the router and the view need ----------
export function freeG(base, spread = 2) {
  const root = base.root, leaves = root.leaves(), CL = 2;
  const folders = root.descendants().filter((n) => n.children && n.depth > 0).sort((a, b) => a.depth - b.depth);
  const M = Math.max(...folders.map((f) => reachOf(f, spread))) + 3;
  const x0 = Math.min(...leaves.map((n) => n.gx)) - M, y0 = Math.min(...leaves.map((n) => n.gy)) - M;
  for (const n of leaves) { n.gx -= x0; n.gy -= y0; }
  const W = Math.max(...leaves.map((n) => n.gx + n.w)) + M, H = Math.max(...leaves.map((n) => n.gy + n.h)) + M;
  const elev = new Int8Array(W * H), blocked = new Uint8Array(W * H), owner = new Array(W * H).fill(null), noteAt = new Array(W * H).fill(null);
  for (const f of folders) {
    const D = reachOf(f, spread), big = new Uint8Array(W * H), tmp = new Uint8Array(W * H), mask = new Uint8Array(W * H);
    for (const n of f.leaves()) for (let j = Math.max(0, n.gy - D - CL); j < Math.min(H, n.gy + n.h + D + CL); j++) for (let i = Math.max(0, n.gx - D - CL); i < Math.min(W, n.gx + n.w + D + CL); i++) big[j * W + i] = 1;
    // shrink back by CL: what is left is the reach of the notes with notches up to 2 CL wide filled
    for (let j = 0; j < H; j++) for (let i = CL; i < W - CL; i++) { let v = 1; for (let k = -CL; k <= CL; k++) v &= big[j * W + i + k]; tmp[j * W + i] = v; }
    for (let j = CL; j < H - CL; j++) for (let i = 0; i < W; i++) { let v = 1; for (let k = -CL; k <= CL; k++) v &= tmp[(j + k) * W + i]; mask[j * W + i] = v; }
    let ax = W, ay = H, bx = 0, by = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (mask[j * W + i]) { elev[j * W + i] = f.depth; owner[j * W + i] = f; ax = Math.min(ax, i); ay = Math.min(ay, j); bx = Math.max(bx, i); by = Math.max(by, j); }
    Object.assign(f, { mask, gx: ax, gy: ay, w: bx - ax + 1, h: by - ay + 1 });
  }
  for (const n of leaves) for (let j = n.gy; j < n.gy + n.h; j++) for (let i = n.gx; i < n.gx + n.w; i++) { blocked[j * W + i] = 1; noteAt[j * W + i] = n; }
  for (const f of folders) { // the title: the run of the folder's own cells on the row above its topmost note
    const top = f.leaves().reduce((a, b) => (b.gy < a.gy || (b.gy === a.gy && b.gx < a.gx) ? b : a)), ty = top.gy - reachOf(f, spread);
    let a = top.gx, b = top.gx; while (owner[ty * W + a - 1] === f) a--; while (owner[ty * W + b + 1] === f && b - a < 30) b++;
    for (let i = a; i <= b; i++) blocked[ty * W + i] = 2;
    Object.assign(f, { tx: a, ty, tw: b - a + 1 });
  }
  const reach = new Float32Array(W * H);
  for (const n of leaves) if (n.data.level > 0) for (let j = n.gy - 1; j <= n.gy + n.h; j++) for (let i = n.gx - 1; i <= n.gx + n.w; i++) if (elev[j * W + i] && blocked[j * W + i] !== 2) reach[j * W + i] = 1;
  return { root, byName: base.byName, W, H, elev, blocked, owner, noteAt, reach, deg: base.deg, free: true };
}

// ---------- measuring a map by its real routes ----------
const cross = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
export function measure(G, passes = 2) {
  const R = makeRouter(G, G.router || {});
  const routes = LINKS.map(([a, b]) => ({ p: G.byName.get(a), q: G.byName.get(b) })).sort((m, n) => (m.p.data.id + m.q.data.id < n.p.data.id + n.q.data.id ? -1 : 1));
  for (const m of routes) Object.assign(m, R.route(m.p, m.q) || { cells: [], pts: [] });
  for (let k = 0; k < passes; k++) for (const m of routes) { if (!m.cells.length) continue; R.release(m); Object.assign(m, R.route(m.p, m.q)); }
  const use = new Uint16Array(G.W * G.H); let len = 0, bends = 0, foreign = 0, lost = 0;
  routes.forEach((m, i) => {
    if (!m.cells.length) { lost++; m.line = []; return; }
    const allowed = new Set([...m.p.ancestors(), ...m.q.ancestors()]); len += m.cells.length;
    for (const c of m.cells) { use[c]++; if (G.owner[c] && !allowed.has(G.owner[c])) foreign++; }
    // a tiny shift, different for every route, so that two routes meeting at a cell centre either cross or do not
    const e = [(i * 0.618) % 1 * 0.02 - 0.01, (i * 0.414) % 1 * 0.02 - 0.01], P = m.pts;
    m.line = P.filter((p, k) => k === 0 || k === P.length - 1 || Math.abs((p[0] - P[k - 1][0]) * (P[k + 1][1] - p[1]) - (p[1] - P[k - 1][1]) * (P[k + 1][0] - p[0])) > 1e-6).map((p) => [p[0] + e[0], p[1] + e[1]]);
    bends += Math.max(0, m.line.length - 2);
  });
  // how crowded the routes are: for each cell of route, how many other routes run through it or a cell touching it
  const who = new Map(); routes.forEach((m, i) => { for (const c of m.cells) (who.get(c) || who.set(c, new Set()).get(c)).add(i); });
  let crowd = 0, alone = 0, cellsN = 0;
  routes.forEach((m, i) => { for (const c of m.cells) { const x = c % G.W, y = (c / G.W) | 0, seen = new Set();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const o = who.get((y + dy) * G.W + x + dx); if (o) for (const k of o) if (k !== i) seen.add(k); }
    crowd += seen.size; cellsN++; if (!seen.size) alone++; } });
  let crossings = 0;
  for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++) { const A = routes[i], B = routes[j]; if (A.p === B.p || A.p === B.q || A.q === B.p || A.q === B.q) continue;
    for (let a = 1; a < A.line.length; a++) for (let b = 1; b < B.line.length; b++) if (cross(A.line[a - 1], A.line[a], B.line[b - 1], B.line[b])) crossings++; }
  const leaves = G.root.leaves(); let agree = 0, pairs = 0;
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) { const d = leaves[i].data.rank - leaves[j].data.rank; if (!d) continue; pairs++; if (d * (leaves[j].gy + leaves[j].h / 2 - leaves[i].gy - leaves[i].h / 2) > 0) agree++; }
  return { crowd: crowd / cellsN, beside: 1 - alone / cellsN, crossings, len, bends, foreign, lost, busiest: Math.max(...use), W: G.W, H: G.H, cell: Math.min(SCREEN[0] / G.W, SCREEN[1] / G.H), north: agree / pairs };
}
const realScore = (m, w) => w.x * 2 * m.crossings + w.len * m.len + 0.3 * m.bends + m.foreign + 400 * m.lost + w.area * 1000 / m.cell + (w.dense || 0) * 400 * m.crowd;

// ---------- the search ----------
export function optimise(base, { spread = 2, w = {}, router = {}, iters = 200000, real = 160, seed = 7, log = () => {} } = {}) {
  w = { len: 0.08, x: 3, over: 2, area: 2, north: 0, hold: 0.5, dense: 0, ...w };
  const bins = new Int16Array(4096);
  const rand = rng(seed), root = base.root, leaves = root.leaves(), n = leaves.length, idx = new Map(leaves.map((l, i) => [l, i]));
  const X = new Float64Array(n), Y = new Float64Array(n), Wd = leaves.map((l) => l.w), Ht = leaves.map((l) => l.h);
  leaves.forEach((l, i) => { X[i] = Math.round(l.gx * 1.25); Y[i] = Math.round(l.gy * 1.25); });
  // how far apart two notes must be
  const req = Array.from({ length: n }, () => new Int16Array(n));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const A = leaves[i].ancestors(), B = new Set(leaves[j].ancestors()), lca = A.find((a) => B.has(a));
    const ci = A[A.indexOf(lca) - 1], cj = leaves[j].ancestors().find((a) => a.parent === lca), ei = ci.children ? reachOf(ci, spread) : 0, ej = cj.children ? reachOf(cj, spread) : 0;
    req[i][j] = req[j][i] = !ei && !ej ? spread : Math.max(spread, ei + ej + (ei && ej ? 2 : 1)); }
  const groups = root.descendants().filter((f) => f.children && f.depth > 0).map((f) => ({ ids: f.leaves().map((l) => idx.get(l)), thr: 2 * reachOf(f, spread) - 1 }));
  const folders = root.descendants().filter((f) => f.children && f.depth > 0).map((f) => f.leaves().map((l) => idx.get(l)));
  const L = LINKS.map(([a, b]) => [idx.get(base.byName.get(a)), idx.get(base.byName.get(b))]);
  const rank = leaves.map((l) => l.data.rank);
  const gap = (i, j) => Math.max(0, X[i] - X[j] - Wd[j], X[j] - X[i] - Wd[i], Y[i] - Y[j] - Ht[j], Y[j] - Y[i] - Ht[i]);
  const par = new Int32Array(n), find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  const cx = new Float64Array(n), cy = new Float64Array(n);
  function parts() {
    let viol = 0, north = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const g = gap(i, j); if (g < req[i][j]) viol += req[i][j] - g; if (w.north && rank[i] !== rank[j] && (rank[i] - rank[j]) * (Y[j] - Y[i]) < 0) north++; }
    for (const g of groups) { for (const i of g.ids) par[i] = i; let c = g.ids.length;
      for (let a = 0; a < g.ids.length; a++) for (let b = a + 1; b < g.ids.length; b++) if (gap(g.ids[a], g.ids[b]) <= g.thr) { const p = find(g.ids[a]), q = find(g.ids[b]); if (p !== q) { par[p] = q; c--; } }
      viol += (c - 1) * 15; }
    return { viol, north };
  }
  function cost() {
    const { viol, north } = parts();
    let len = 0, xs = 0, over = 0, ax = Infinity, ay = Infinity, bx = -Infinity, by = -Infinity;
    for (let i = 0; i < n; i++) { cx[i] = X[i] + Wd[i] / 2; cy[i] = Y[i] + Ht[i] / 2; ax = Math.min(ax, X[i]); ay = Math.min(ay, Y[i]); bx = Math.max(bx, X[i] + Wd[i]); by = Math.max(by, Y[i] + Ht[i]); }
    for (let a = 0; a < L.length; a++) { const [p, q] = L[a], dx = Math.abs(cx[p] - cx[q]), dy = Math.abs(cy[p] - cy[q]); len += Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
      const P = [cx[p], cy[p]], Q = [cx[q], cy[q]];
      for (let b = a + 1; b < L.length; b++) { const [r, s] = L[b]; if (r === p || r === q || s === p || s === q) continue; if (cross(P, Q, [cx[r], cy[r]], [cx[s], cy[s]])) xs++; }
      const lx = Math.min(P[0], Q[0]), hx = Math.max(P[0], Q[0]), ly = Math.min(P[1], Q[1]), hy = Math.max(P[1], Q[1]);
      for (let k = 0; k < n; k++) { if (k === p || k === q || cx[k] < lx || cx[k] > hx || cy[k] < ly || cy[k] > hy) continue; // the straight line passes within the block
        const t = Math.abs((Q[0] - P[0]) * (P[1] - cy[k]) - (P[0] - cx[k]) * (Q[1] - P[1])) / (Math.hypot(Q[0] - P[0], Q[1] - P[1]) || 1); if (t < Ht[k] / 2 + 0.5) over++; } }
    let sprawl = 0; // how far each folder's notes spread: half the outline of the box around them
    for (const f of folders) { let fx = Infinity, fy = Infinity, gx = -Infinity, gy = -Infinity; for (const i of f) { fx = Math.min(fx, X[i]); fy = Math.min(fy, Y[i]); gx = Math.max(gx, X[i] + Wd[i]); gy = Math.max(gy, Y[i] + Ht[i]); } sprawl += gx - fx + gy - fy; }
    let packed = 0; // a stand-in for crowded routes: how many straight lines pass through each 8 by 8 block of cells
    if (w.dense) { bins.fill(0); for (const [p, q] of L) { const k = Math.max(1, Math.ceil(Math.max(Math.abs(cx[p] - cx[q]), Math.abs(cy[p] - cy[q])) / 4)); let last = -1;
      for (let t = 0; t <= k; t++) { const b = (((cx[p] + (cx[q] - cx[p]) * t / k) >> 3) & 63) + 64 * (((cy[p] + (cy[q] - cy[p]) * t / k) >> 3) & 63); if (b !== last) { packed += bins[b]++; last = b; } } } }
    const cell = Math.min(SCREEN[0] / (bx - ax + 14), SCREEN[1] / (by - ay + 14));
    return { viol, total: 200 * viol + w.len * len + w.x * xs + w.over * over + w.area * 1000 / cell + w.north * 0.3 * north + w.hold * sprawl + w.dense * 0.5 * packed };
  }
  const sibs = root.descendants().filter((f) => f.children).map((f) => f.children.filter((c) => !c.children).map((c) => idx.get(c))).filter((s) => s.length > 1);
  const ri = (k) => Math.floor(rand() * k), rd = (k) => ri(2 * k + 1) - k;
  function move(small) {
    const r = rand();
    if (r < 0.5 || (small && r < 0.75)) { const i = ri(n); X[i] += rd(small ? 2 : 3); Y[i] += rd(small ? 2 : 3); }
    else if (r < 0.62 && !small) { const i = ri(n); X[i] += rd(10); Y[i] += rd(10); }
    else if (r < 0.77 && !small) { const s = sibs[ri(sibs.length)], a = s[ri(s.length)], b = s[ri(s.length)]; const ax = X[a] + Wd[a] / 2, ay = Y[a] + Ht[a] / 2, bx = X[b] + Wd[b] / 2, by = Y[b] + Ht[b] / 2;
      X[a] = Math.round(bx - Wd[a] / 2); Y[a] = Math.round(by - Ht[a] / 2); X[b] = Math.round(ax - Wd[b] / 2); Y[b] = Math.round(ay - Ht[b] / 2); }
    else if (r < 0.95 || small) { const f = folders[ri(folders.length)], dx = rd(3), dy = rd(3); for (const i of f) { X[i] += dx; Y[i] += dy; } }
    else { const f = folders[ri(folders.length)], horiz = rand() < 0.5; let lo = Infinity, hi = -Infinity; for (const i of f) { lo = Math.min(lo, horiz ? X[i] : Y[i]); hi = Math.max(hi, horiz ? X[i] + Wd[i] : Y[i] + Ht[i]); }
      for (const i of f) { if (horiz) X[i] = lo + hi - X[i] - Wd[i]; else Y[i] = lo + hi - Y[i] - Ht[i]; } }
  }
  let cur = cost(), sx = X.slice(), sy = Y.slice();
  const T0 = 25, T1 = 0.05;
  for (let it = 0; it < iters; it++) {
    const T = T0 * Math.pow(T1 / T0, it / iters); move(false); const c = cost();
    if (c.total <= cur.total || rand() < Math.exp((cur.total - c.total) / T)) { cur = c; sx = X.slice(); sy = Y.slice(); } else { X.set(sx); Y.set(sy); }
  }
  for (let it = 0; it < 60000 && cur.viol > 0; it++) { move(true); const c = cost(); if (c.total < cur.total) { cur = c; sx = X.slice(); sy = Y.slice(); } else { X.set(sx); Y.set(sy); } }
  log(`  stand-in search done: rules broken ${cur.viol}, cost ${cur.total.toFixed(0)}`);
  // second pass: judge by the real routes
  const apply = () => { leaves.forEach((l, i) => { l.gx = X[i]; l.gy = Y[i]; }); return Object.assign(freeG(base, spread), { router }); };
  let best = realScore(measure(apply(), 0), w), kept = 0;
  for (let it = 0; it < real; it++) { move(true); if (parts().viol > 0) { X.set(sx); Y.set(sy); continue; }
    const s = realScore(measure(apply(), 0), w); if (s < best) { best = s; kept++; sx = X.slice(); sy = Y.slice(); } else { X.set(sx); Y.set(sy); } }
  log(`  real-route pass: kept ${kept} of ${real} moves`);
  apply();
  return { pos: leaves.map((l) => [l.data.ref, l.gx, l.gy]), viol: cur.viol, kept };
}

// ---------- the variants ----------
const CACHE = new URL('./gridopt-cache.json', import.meta.url);
const VARIANTS = [
  { key: 'now', name: 'As published', what: 'Rectangular folders placed from the smooth layout. No search.' },
  { key: 'spread', name: 'Spread only', what: 'The same with twice the room (4 cells between notes, 6 between folders). No search.', gaps: { gapN: 4, gapF: 6 } },
  { key: 'opt', name: 'Searched, tight', what: 'Free-form folders; positions searched for short, uncrossed routes.', spread: 2, w: {} },
  { key: 'optwide', name: 'Searched, loose', what: '4 clear cells between notes; crossings weighted over size.', spread: 4, w: { x: 6, area: 1 } },
  { key: 'thin', name: 'Loose, routes kept apart', what: 'Loose, and both the search and the router are charged for routes running side by side.', spread: 4, w: { x: 6, area: 1, dense: 1 }, router: { near: 0.3 } },
  { key: 'north', name: 'Loose, routes apart, north kept', what: 'The same, with later-in-study-order pulled north.', spread: 4, w: { x: 6, area: 1, dense: 1, north: 1 }, router: { near: 0.3 } },
];
export function variants(log = () => {}) {
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { /* first run */ }
  const out = VARIANTS.map((v) => {
    const base = build(v.gaps || {});
    if (v.spread === undefined) return { ...v, G: base };
    const id = JSON.stringify(v.router ? [v.spread, v.w, v.router, 5] : [v.spread, v.w, 4]);
    if (!cache[v.key] || cache[v.key].id !== id) { log(`optimising "${v.name}"`); cache[v.key] = { id, ...optimise(base, { spread: v.spread, w: v.w, router: v.router || {}, real: v.router ? 220 : 160, log }) }; fs.writeFileSync(CACHE, JSON.stringify(cache)); }
    for (const [ref, x, y] of cache[v.key].pos) { const l = base.byName.get(ref); l.gx = x; l.gy = y; }
    return { ...v, G: Object.assign(freeG(base, v.spread), { router: v.router || {} }), viol: cache[v.key].viol, kept: cache[v.key].kept };
  });
  for (const v of out) v.m = measure(v.G);
  return out;
}

const X_CSS = `
.gx{position:absolute;inset:0;padding:16px 28px;font-family:var(--font-ui)}
.gx h1{font-family:var(--font-read);font-size:24px;margin:0 0 4px}
.gx .lede{font-family:var(--font-read);color:var(--text-soft);margin:0 0 10px;max-width:1150px;line-height:1.4;font-size:15px}
.gx .grid4{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 20px}
.gx figure{margin:0;border:1px solid var(--rule);border-radius:var(--radius-md);overflow:hidden;background:var(--surface)}
.gx figure svg.atlas{position:static}
.gx figcaption{padding:7px 10px 8px;border-top:1px solid var(--rule);background:var(--surface-1);font-size:12px;line-height:1.45;color:var(--text-soft)}
.gx figcaption b{color:var(--text);font-weight:600}
.gx .nums{font-family:var(--font-map);font-variation-settings:"wdth" 88;color:var(--text);display:block;margin-top:2px}
`;

export function gridOptDocs(log = () => {}) {
  const V = variants(log);
  const card = (subtitle, h = 900) => `@dsCard group="${GROUP_G}" width=1440 height=${h} subtitle="${subtitle}"`;
  const css = ATLAS_CSS + A2_CSS + G_CSS;
  const PW = 448, PH = 300;
  const panel = (v) => { const C = Math.min((PW - 12) / v.G.W, (PH - 12) / v.G.H), m = v.m;
    const s = view(v.G, { C, ox: (PW - v.G.W * C) / 2, oy: (PH - v.G.H * C) / 2, mode: 'all', W: PW, H: PH, left: -1 }).svg;
    return `<figure>${s}<figcaption><b>${v.name}.</b> ${v.what}<span class="nums">${m.crossings} crossings · ${m.len} cells of route · ${Math.round(m.beside * 100)}% beside another route · ${m.cell.toFixed(1)}px cells · north ${Math.round(m.north * 100)}%</span></figcaption></figure>`; };
  const full = (key, Name, what) => {
    const pick = V.find((v) => v.key === key);
  const G = pick.G, C = Math.floor(Math.min((1440 - 330 - 20) / G.W, (852 - 44) / G.H) * 10) / 10, O = { C, ox: 330 + (1440 - 330 - G.W * C) / 2, oy: (852 - 36 - G.H * C) / 2 };
    const over = view(G, { ...O, mode: 'trunks' }), all = view(G, { ...O, mode: 'all' });
    const man = G.root.children.find((c) => c.data.ref === 'Manifolds'), Cz = Math.floor(Math.min((1440 - 330 - 60) / (man.w + 4), (852 - 60) / (man.h + 3)));
    const zoom = view(G, { C: Cz, ox: 330 + (1440 - 330 - man.w * Cz) / 2 - man.gx * Cz, oy: (852 - man.h * Cz) / 2 - man.gy * Cz, mode: 'focus', focus: 'Manifolds', labels: true });
    const base = `${G.root.leaves().length} notes on a ${G.W} by ${G.H} grid. Positions searched together with the routes; folders take the shape of their contents.`;
    const m = pick.m;
  return {
      [Name]: doc({ marker: card(`${what} at overview: free-form folders, one trunk per pair of folders.`), title: `Atlas on a grid, ${what}`, css, js: '',
        body: page(over, { zoomed: false, compact: true, north: m.north > 0.85, stats: `${base} All ${LINKS.length} links, as ${over.routes.length} trunks.` }) }),
      [Name + 'All']: doc({ marker: card(`${what} with every link drawn on its own.`), title: `Atlas on a grid, ${what}, every link`, css, js: '',
        body: page(all, { zoomed: false, compact: true, north: m.north > 0.85, stats: `${base} All ${LINKS.length} links drawn singly: ${m.crossings} crossings, ${Math.round(m.beside * 100)}% of route beside another.` }) }),
      [Name + 'Folder']: doc({ marker: card(`${what} zoomed into Manifolds, with every link that touches it.`), title: `Atlas on a grid, ${what}, a folder in focus`, css, js: '',
        body: page(zoom, { zoomed: true, showCard: false, compact: true, north: false, stats: `${zoom.routes.filter((r) => r.solo).length} links touch Manifolds. Double green rule: understood. Red frame: needs work.` }) }),
    }; };
  return {
    metrics: Object.fromEntries(V.map((v) => [v.key, { ...v.m, viol: v.viol, kept: v.kept }])),
    docs: {
      GridExperiment: doc({ marker: card('Six ways to lay out the same 63 notes and 98 links, every link drawn singly and measured: as published, spread only, and four searched layouts with free-form folders.'),
        title: 'Grid Atlas: layout experiment', css: css + X_CSS, js: '',
        body: `<div class="screen"><div class="gx"><h1>Layout and routes, optimised together</h1><p class="lede">Each panel shows all 98 links drawn one by one, with no merging, routed by the same router. The numbers under each are measured on those routes. Fewer crossings, less route beside another route and larger cells are better.</p><div class="grid4">${V.map(panel).join('')}</div></div></div>` }),
      ...full('opt', 'GridFreeAtlas', 'The tight searched layout'),
      ...full('north', 'GridLooseAtlas', 'The loose searched layout, north kept'),
    },
  };
}
