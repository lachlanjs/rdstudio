// The grid Atlas (prototype). Everything sits on a coarse square grid.
//
// Layout    Notes are blocks of cells (4 by 2; more for notes with many links, so their links have more edge to leave from).
//           A folder is a block holding a title row, a free row under it, and its children packed in shelves with one-cell
//           corridors. Folders nest. Later in the study order is packed further north.
// Height    A cell's height is how deeply nested it is: 0 between folders, 1 inside a folder, 2 inside a subfolder.
//           The only contours are folder walls, drawn on grid lines with the corners cut.
// Reached   Understanding is tone, not height: the ground within one cell of a reached note is lighter.
// Routes    A* over cells with 45 degree steps. A step costs its length, plus a penalty for each change of height, each turn,
//           each cell of a folder the route has no business in, and each route already in the cell. Notes and title rows are
//           blocked. A route ends on the edge of the block it joins.
// Lanes     Routes that share a cell edge are given different offsets, so they run side by side; a later route is drawn over an
//           earlier one with a gap, so crossings read as over and under.
import * as d3 from 'd3';
import { layout, EDGES, STRUGGLING, page, A2_CSS, shapeSvg } from './atlas2.mjs';
import { doc } from './marginalia.mjs';
import { ATLAS_CSS } from './survey.mjs';

export const GROUP_G = 'Atlas · grid (prototype)';

// ---------- layout ----------
// Positions come from the smooth layout (the previous app's packing and forces, with later study pulled north), then snap to the grid:
// inside each folder the children keep their relative places, spread just far enough apart that every pair has a clear gap.
const GAP_NOTES = 2, GAP_FOLDERS = 3, PAD = 2, TIGHT = 0.5;
export function build({ gapN = GAP_NOTES, gapF = GAP_FOLDERS } = {}) {
  const L = layout(), root = L.root;
  const byName = new Map(); root.leaves().forEach((n) => byName.set(n.data.ref, n));
  const deg = new Map();
  for (const [a, b, s] of EDGES) if (s >= 2) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
  // bottom up: size every block, and place each folder's children relative to it
  const size = (n) => {
    if (!n.children) { const d = deg.get(n.data.ref) || 0; n.w = d >= 6 ? 9 : 8; n.h = d >= 9 ? 3 : 2; return; }
    n.children.forEach(size);
    const kids = n.children, gap = n.depth === 0 || kids.some((c) => c.children) ? gapF : gapN;
    const clear = (P) => P.every((a, i) => P.every((b, j) => j <= i || !(a.x < b.x + b.c.w + gap && b.x < a.x + a.c.w + gap && a.y < b.y + b.c.h + gap && b.y < a.y + a.c.h + gap)));
    const at = (k) => kids.map((c) => ({ c, x: Math.round((c.x - n.x) * k - c.w / 2), y: Math.round((c.y - n.y) * k - c.h / 2) }));
    // the scale at which nothing touches with no nudging at all; then try tighter scales, nudging apart whatever overlaps, and keep the tightest that settles
    let kc = 0.02; while (kc < 4 && !clear(at(kc))) kc *= 1.05;
    const relax = (P) => { for (let it = 0; it < 300; it++) { let moved = false;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const a = P[i], b = P[j];
        const px = Math.min(a.x + a.c.w, b.x + b.c.w) + gap - Math.max(a.x, b.x), py = Math.min(a.y + a.c.h, b.y + b.c.h) + gap - Math.max(a.y, b.y);
        const ox = (a.c.w + b.c.w) / 2 + gap - Math.abs(a.x + a.c.w / 2 - b.x - b.c.w / 2), oy = (a.c.h + b.c.h) / 2 + gap - Math.abs(a.y + a.c.h / 2 - b.y - b.c.h / 2);
        if (ox <= 0 || oy <= 0 || px <= 0 || py <= 0) continue; moved = true;
        if (ox < oy) { const d = Math.ceil(ox), s = a.x + a.c.w / 2 <= b.x + b.c.w / 2 ? 1 : -1; a.x -= s * Math.floor(d / 2); b.x += s * Math.ceil(d / 2); }
        else { const d = Math.ceil(oy), s = a.y + a.c.h / 2 <= b.y + b.c.h / 2 ? 1 : -1; a.y -= s * Math.floor(d / 2); b.y += s * Math.ceil(d / 2); } }
      if (!moved) return true; } return false; };
    let P = at(kc);
    for (let k = kc * TIGHT; k < kc; k *= 1.06) { const Q = at(k); if (relax(Q) && clear(Q)) { P = Q; break; } }
    const x0 = Math.min(...P.map((p) => p.x)), y0 = Math.min(...P.map((p) => p.y));
    for (const p of P) { p.c.rx = p.x - x0; p.c.ry = p.y - y0; }
    const bw = Math.max(...P.map((p) => p.c.rx + p.c.w)), bh = Math.max(...P.map((p) => p.c.ry + p.c.h));
    if (n.depth === 0) { n.w = bw; n.h = bh; } else { n.w = bw + 2 * PAD; n.h = bh + PAD + 2 + PAD; } // side walls; title row, free row, then the contents; floor
  };
  const place = (n, x, y) => { n.gx = x; n.gy = y; if (!n.children) return; for (const c of n.children) place(c, x + (n.depth === 0 ? 0 : PAD) + c.rx, y + (n.depth === 0 ? 0 : 2 + PAD) + c.ry); };
  size(root); const M = 3; place(root, M, M);
  const W = root.w + 2 * M, H = root.h + 2 * M;
  // per-cell facts
  const elev = new Int8Array(W * H), blocked = new Uint8Array(W * H), owner = new Array(W * H).fill(null), noteAt = new Array(W * H).fill(null);
  root.descendants().filter((n) => n.children && n.depth > 0).sort((a, b) => a.depth - b.depth).forEach((f) => {
    for (let j = f.gy; j < f.gy + f.h; j++) for (let i = f.gx; i < f.gx + f.w; i++) { elev[j * W + i] = f.depth; owner[j * W + i] = f; }
    for (let i = f.gx; i < f.gx + f.w; i++) blocked[f.gy * W + i] = 2; // the title row
  });
  root.leaves().forEach((n) => { for (let j = n.gy; j < n.gy + n.h; j++) for (let i = n.gx; i < n.gx + n.w; i++) { blocked[j * W + i] = 1; noteAt[j * W + i] = n; } });
  // understanding as tone: reached ground is every folder cell within one cell of a reached note
  const leaves = root.leaves(), reach = new Float32Array(W * H);
  for (const n of leaves) if (n.data.level > 0) for (let j = n.gy - 1; j <= n.gy + n.h; j++) for (let i = n.gx - 1; i <= n.gx + n.w; i++) if (elev[j * W + i] && blocked[j * W + i] !== 2) reach[j * W + i] = 1;
  return { root, byName, W, H, elev, blocked, owner, noteAt, reach, deg };
}

// ---------- routing ----------
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
export function makeRouter(G, { climb = 5, turn45 = 0.35, turn90 = 0.9, foreign = 2.5, crowd = 0.45, near = 0 } = {}) {
  const { W, H, elev, blocked, owner } = G;
  const use = new Uint16Array(W * H), beside = new Uint16Array(W * H); // routes in each cell, and routes in the eight cells around it
  const mark = (c, d) => { use[c] += d; const i = c % W, j = (c / W) | 0; for (let y = Math.max(0, j - 1); y <= Math.min(H - 1, j + 1); y++) for (let x = Math.max(0, i - 1); x <= Math.min(W - 1, i + 1); x++) if (x !== i || y !== j) beside[y * W + x] += d; };
  const ring = (b) => { const out = []; // free cells touching block b from outside, with the point on b's edge they leave from
    if (b.mask) { // a folder that is a region of cells, not a rectangle
      for (let j = b.gy; j < b.gy + b.h; j++) for (let i = b.gx; i < b.gx + b.w; i++) { if (!b.mask[j * W + i]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + dx, nj = j + dy; if (ni < 0 || nj < 0 || ni >= W || nj >= H || b.mask[nj * W + ni] || blocked[nj * W + ni]) continue; out.push([ni, nj, i + 0.5 + dx / 2, j + 0.5 + dy / 2]); } }
      return out; }
    for (let i = b.gx; i < b.gx + b.w; i++) { out.push([i, b.gy - 1, i + 0.5, b.gy]); out.push([i, b.gy + b.h, i + 0.5, b.gy + b.h]); }
    for (let j = b.gy; j < b.gy + b.h; j++) { out.push([b.gx - 1, j, b.gx, j + 0.5]); out.push([b.gx + b.w, j, b.gx + b.w, j + 0.5]); }
    return out.filter(([i, j]) => i >= 0 && j >= 0 && i < W && j < H && !blocked[j * W + i]); };
  function route(a, b) {
    const allowed = new Set([...a.ancestors(), ...b.ancestors()]);
    const src = ring(a), dst = new Map(ring(b).map((r) => [r[1] * W + r[0], r]));
    const tx = b.gx + b.w / 2, ty = b.gy + b.h / 2;
    const hfn = (i, j) => { const dx = Math.abs(i + 0.5 - tx), dy = Math.abs(j + 0.5 - ty); return Math.max(0, Math.max(dx, dy) + 0.41 * Math.min(dx, dy) - Math.max(b.w, b.h)); };
    const dist = new Float32Array(W * H * 9).fill(Infinity), prev = new Int32Array(W * H * 9).fill(-1);
    const heap = []; const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const start = new Map();
    for (const r of src) { const c = r[1] * W + r[0], s = c * 9 + 8; const g = (1 + crowd * use[c]); if (g < dist[s]) { dist[s] = g; push([g + hfn(r[0], r[1]), s]); start.set(c, r); } }
    let end = -1;
    while (heap.length) {
      const [f, s] = pop(); const c = (s / 9) | 0, d = s % 9, g = dist[s]; if (f - hfn(c % W, (c / W) | 0) > g + 1e-4) continue;
      if (dst.has(c)) { end = s; break; }
      const ci = c % W, cj = (c / W) | 0;
      for (let k = 0; k < 8; k++) {
        const [dx, dy] = DIRS[k], ni = ci + dx, nj = cj + dy; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const nc = nj * W + ni; if (blocked[nc]) continue;
        if (dx && dy) { const c1 = cj * W + ni, c2 = nj * W + ci; if (blocked[c1] || blocked[c2] || elev[c1] !== elev[c] || elev[c2] !== elev[c] || elev[nc] !== elev[c]) continue; } // no cutting corners of walls or blocks
        let cost = (dx && dy ? 1.414 : 1) * (1 + crowd * use[nc] + near * beside[nc]) + climb * Math.abs(elev[nc] - elev[c]);
        if (d !== 8 && d !== k) { const t = Math.min((k - d + 8) % 8, (d - k + 8) % 8); cost += t === 1 ? turn45 : turn90 * (t >= 3 ? 2 : 1); }
        if (owner[nc] && !allowed.has(owner[nc])) cost += foreign;
        const ns = nc * 9 + k, ng = g + cost;
        if (ng < dist[ns]) { dist[ns] = ng; prev[ns] = s; push([ng + hfn(ni, nj), ns]); }
      }
    }
    if (end < 0) return null;
    const cells = []; for (let s = end; s !== -1; s = prev[s]) cells.push((s / 9) | 0); cells.reverse();
    for (const c of cells) mark(c, 1);
    const a0 = start.get(cells[0]), b0 = dst.get(cells[cells.length - 1]);
    return { cells, pts: [[a0[2], a0[3]], ...cells.map((c) => [(c % W) + 0.5, ((c / W) | 0) + 0.5]), [b0[2], b0[3]]] };
  }
  const release = (r) => { for (const c of r.cells) mark(c, -1); };
  return { route, release };
}

// lanes: routes sharing a cell edge get different offsets
function lanes(routes, step) {
  const key = (a, b) => (a < b ? a + ':' + b : b + ':' + a), at = new Map();
  routes.forEach((r, i) => { r.edges = new Set(); for (let k = 1; k < r.cells.length; k++) { const e = key(r.cells[k - 1], r.cells[k]); r.edges.add(e); (at.get(e) || at.set(e, []).get(e)).push(i); } });
  const OFF = [0, 1, -1, 2, -2, 3, -3];
  routes.forEach((r, i) => { const taken = new Set(); for (const e of r.edges) for (const j of at.get(e)) if (j < i) taken.add(routes[j].lane); r.lane = OFF.find((o) => !taken.has(o)) ?? 0; r.off = r.lane * step; });
}
// offset a polyline sideways by o, using one normal per undirected segment direction so opposite-running routes do not collide
function offsetLine(P, o) {
  if (!o) return P;
  const nrm = (a, b) => { let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; if (dx < -1e-6 || (Math.abs(dx) < 1e-6 && dy < 0)) { dx = -dx; dy = -dy; } return [-dy, dx]; };
  return P.map((p, i) => { const n1 = i > 0 ? nrm(P[i - 1], p) : nrm(p, P[i + 1]), n2 = i < P.length - 1 ? nrm(p, P[i + 1]) : n1; const d = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    return d < 0.2 ? [p[0] + n1[0] * o, p[1] + n1[1] * o] : [p[0] + ((n1[0] + n2[0]) / d) * o, p[1] + ((n1[1] + n2[1]) / d) * o]; });
}
// straight runs with rounded bends
function roundPath(P, r) {
  const Q = P.filter((p, i) => i === 0 || i === P.length - 1 || Math.abs((p[0] - P[i - 1][0]) * (P[i + 1][1] - p[1]) - (p[1] - P[i - 1][1]) * (P[i + 1][0] - p[0])) > 1e-3);
  let d = `M${Q[0][0].toFixed(1)} ${Q[0][1].toFixed(1)}`;
  for (let i = 1; i < Q.length - 1; i++) { const a = Q[i - 1], b = Q[i], c = Q[i + 1], l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]), rr = Math.min(r, l1 / 2, l2 / 2);
    d += `L${(b[0] - ((b[0] - a[0]) / l1) * rr).toFixed(1)} ${(b[1] - ((b[1] - a[1]) / l1) * rr).toFixed(1)}Q${b[0].toFixed(1)} ${b[1].toFixed(1)} ${(b[0] + ((c[0] - b[0]) / l2) * rr).toFixed(1)} ${(b[1] + ((c[1] - b[1]) / l2) * rr).toFixed(1)}`; }
  const z = Q[Q.length - 1]; return d + `L${z[0].toFixed(1)} ${z[1].toFixed(1)}`;
}

// ---------- one view ----------
export function view(G, { C, ox, oy, mode = 'trunks', focus = null, labels = false, W = 1440, H = 852, left = 300 }) {
  const X = (x) => ox + x * C, Y = (y) => oy + y * C;
  const { root } = G, topOf = (n) => n.ancestors().find((a) => a.depth === 1);
  // which links to draw. Nothing is filtered out here: every requires and uses link counts, implied ones included.
  // 'trunks' merges them per pair of top-level folders; 'all' draws every link on its own; 'focus' draws the focused folder's own links and trunks elsewhere
  const merged = new Map();
  const add = (a, b, cls, solo) => { if (a === b) return; const [p, q] = a.data.id < b.data.id ? [a, b] : [b, a], key = p.data.id + '|' + q.data.id; const m = merged.get(key) || { p, q, count: 0, cls, solo }; m.count++; merged.set(key, m); };
  for (const [a, b, s] of EDGES) { if (s < 2) continue; const na = G.byName.get(a), nb = G.byName.get(b), ta = topOf(na), tb = topOf(nb);
    if (mode === 'trunks') { add(ta, tb, ''); continue; }
    if (mode === 'all') { add(na, nb, '', true); continue; }
    const fa = ta.data.ref === focus, fb = tb.data.ref === focus;
    if (fa && fb) add(na, nb, '', true); else if (fa || fb) add(fa ? na : ta, fb ? nb : tb, '', true); else add(ta, tb, 'quiet'); }
  let routes = [...merged.values()].sort((a, b) => b.count - a.count || (a.p.data.id + a.q.data.id < b.p.data.id + b.q.data.id ? -1 : 1));
  const R = makeRouter(G, G.router || {});
  for (const m of routes) Object.assign(m, R.route(m.p, m.q) || { cells: [], pts: [] });
  for (let pass = 0; pass < 2; pass++) for (const m of routes) { if (!m.cells.length) continue; R.release(m); Object.assign(m, R.route(m.p, m.q)); } // let each route reconsider once the others are down
  routes = routes.filter((m) => m.cells.length);
  lanes(routes, Math.max(2.2, Math.min(5, C / 4.2)));
  const line = (m) => roundPath(offsetLine(m.pts.map(([x, y]) => [X(x), Y(y)]), m.off), Math.min(7, C * 0.45));
  const wid = (c) => (1 + Math.log2(c) * 0.8).toFixed(2);
  const kindAt = (n) => { const big = n.h * C > 44; if (labels && !big) return shapeSvg(n.data.type, X(n.gx + n.w) - 11, Y(n.gy) + n.h * C / 2 - (n.data.level === 3 ? 2 : 0), 3.8, 'g-kind'); return big ? shapeSvg(n.data.type, X(n.gx + n.w) - 11, Y(n.gy) + 11, 4.2, 'g-kind') : shapeSvg(n.data.type, X(n.gx) + n.w * C / 2, Y(n.gy) + n.h * C / 2 - (n.data.level === 3 ? 2 : 0), Math.min(3.6, C * 0.42), 'g-kind'); };

  // walls: a rectangle on grid lines with its corners cut
  const cut = (b, c, inset = 0) => { const x0 = X(b.gx) + inset, y0 = Y(b.gy) + inset, x1 = X(b.gx + b.w) - inset, y1 = Y(b.gy + b.h) - inset; return `M${x0 + c} ${y0}H${x1 - c}L${x1} ${y0 + c}V${y1 - c}L${x1 - c} ${y1}H${x0 + c}L${x0} ${y1 - c}V${y0 + c}Z`.replace(/(\.\d)\d+/g, '$1'); };
  const proj = d3.geoPath(d3.geoIdentity().scale(C).translate([ox, oy]));
  const outline = (f) => (f.mask ? proj(d3.contours().size([G.W, G.H]).contour(Array.from(f.mask), 0.5)).replace(/(\.\d)\d+/g, '$1') : cut(f, C / 2));
  const folders = root.descendants().filter((n) => n.children && n.depth > 0).sort((a, b) => a.depth - b.depth);
  const reached = (f) => `${f.leaves().filter((l) => l.data.level > 0).length}/${f.leaves().length}`;
  const reachD = proj(d3.contours().size([G.W, G.H]).contour(Array.from(G.reach), 0.5)).replace(/(\.\d)\d+/g, '$1');
  const dots = []; for (let j = 0; j <= G.H; j++) for (let i = 0; i <= G.W; i++) { const x = X(i), y = Y(j); if (x > left && x < W && y > 0 && y < H) dots.push(`M${x.toFixed(1)} ${y.toFixed(1)}h.01`); }
  const fsz = Math.max(10, Math.min(12, C * 0.72));
  const titles = folders.map((f) => { const max = Math.floor(((f.tw ?? f.w) * C - 14) / (fsz * 0.62)); let t = f.data.ref; const cnt = ' ' + reached(f); if (t.length + cnt.length > max) t = t.slice(0, Math.max(3, max - cnt.length - 1)) + '…';
    return `<text x="${(X(f.tx ?? f.gx) + 8).toFixed(1)}" y="${(Y(f.ty ?? f.gy) + Math.max(C / 2 + fsz * 0.36, fsz + 3)).toFixed(1)}" class="g-title" style="font-size:${fsz.toFixed(1)}px">${t}<tspan class="a-count">${cnt}</tspan></text>`; }).join('');
  const notes = root.leaves().map((n) => {
    const l = n.data.level, cls = n.data.ref === STRUGGLING ? 'gn bad l' + l : 'gn l' + l, x0 = X(n.gx), y0 = Y(n.gy), w = n.w * C, h = n.h * C;
    let s = `<path d="${cut(n, Math.min(4, C * 0.22), 1.5)}" class="${cls}"/>`;
    if (l === 3) s += `<path d="M${(x0 + 5).toFixed(1)} ${(y0 + h - 5.5).toFixed(1)}h${(w - 10).toFixed(1)}M${(x0 + 5).toFixed(1)} ${(y0 + h - 8.5).toFixed(1)}h${(w - 10).toFixed(1)}" class="gn-ok"/>`;
    s += kindAt(n);
    if (labels && n.data.ref.length > 2 && x0 > left && x0 < W) { const per = Math.floor((w - 28) / 7.4), maxL = Math.max(1, Math.floor((h - (l === 3 ? 16 : 8)) / 13)), lines = []; let cur = '';
      if (maxL >= 1 && per >= 4) {
      for (let word of n.data.ref.split(' ')) { if (word.length > per) word = word.slice(0, per - 1) + '…'; if (cur && (cur + ' ' + word).length > per) { lines.push(cur); cur = word; } else cur = cur ? cur + ' ' + word : word; } lines.push(cur);
      const shown = lines.slice(0, maxL); if (lines.length > maxL) shown[maxL - 1] = shown[maxL - 1].slice(0, per - 1) + '…';
      s += `<text class="g-note${l ? '' : ' dim'}">${shown.map((t, i) => `<tspan x="${(x0 + 7).toFixed(1)}" y="${(y0 + (shown.length === 1 && h < 40 ? h / 2 + (l === 3 ? 2 : 4.5) : 15 + i * 13)).toFixed(1)}">${t}</tspan>`).join('')}</text>`; } }
    return s; }).join('');
  const mid = (m) => { const p = m.pts[Math.floor(m.pts.length / 2)]; const q = offsetLine([[X(p[0]), Y(p[1])], [X(p[0]) + 1, Y(p[1])]], 0)[0]; return q; };
  const svg = `<svg class="atlas gridmap" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Atlas of Differential geometry on a grid: folders as nested blocks, links routed along the cells between them">
  <defs><pattern id="fogdots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.8" class="fogdot"/></pattern><clipPath id="gland">${folders.filter((f) => f.depth === 1).map((f) => `<path d="${outline(f)}"/>`).join('')}</clipPath></defs>
  <rect width="${W}" height="${H}" class="a-sea"/>
  <path d="${dots.join('')}" class="g-dots"/>
  ${folders.map((f) => `<path d="${outline(f)}" class="g-floor d${f.depth}"/>`).join('')}
  <g clip-path="url(#gland)"><path d="${reachD}" class="a-reach"/><path d="${reachD}" class="g-front"/></g>
  ${folders.map((f) => `<path d="${outline(f)}" class="g-wall d${f.depth}"/>`).join('')}
  ${routes.map((m) => `<path d="${line(m)}" class="rt-halo" stroke-width="${(+wid(m.count) + 3.5).toFixed(2)}"/><path d="${line(m)}" class="rt${m.cls ? ' quiet' : ''}" stroke-width="${wid(m.count)}"/>`).join('')}
  ${notes}
  ${titles}
  ${routes.filter((m) => m.p.depth === 1 && m.q.depth === 1 && !m.cls && !m.solo).map((m) => { const c = mid(m); return `<text x="${c[0].toFixed(1)}" y="${(c[1] + 4).toFixed(1)}" text-anchor="middle" class="a-stopno">${m.count}</text>`; }).join('')}
</svg>`;
  return { svg, routes, X, Y };
}

export const G_CSS = `
.g-dots{stroke:var(--rule-strong);stroke-width:1.4;stroke-linecap:round;opacity:.45;fill:none}
.g-floor.d1{fill:var(--surface-1)}.g-floor.d2{fill:var(--surface-2)}.g-floor.d3{fill:var(--surface-3)}
.g-wall{fill:none;stroke:var(--rule-strong);stroke-width:1.25}
.g-wall.d2{stroke-width:1}
.g-front{fill:none;stroke:var(--text-soft);stroke-width:1;stroke-dasharray:1 3;stroke-linecap:round}
.g-title{font-family:var(--font-map);font-variation-settings:"wdth" 88;font-weight:600;fill:var(--text)}
.g-title .a-count{font-weight:400;fill:var(--text-soft)}
.gn{stroke:var(--rule-strong);stroke-width:1;fill:var(--surface)}
.gn.l1{stroke:var(--text);fill:var(--surface-1)}
.gn.l2,.gn.l3{stroke:var(--text);stroke-width:1.25;fill:var(--surface-3)}
.gn.bad{stroke:var(--pen-red);stroke-width:2}
.gn-ok{stroke:var(--pen-green);stroke-width:1.5;fill:none}
.g-note{font-family:var(--font-map);font-variation-settings:"wdth" 84;font-size:11px;fill:var(--text)}
.g-note.dim{fill:var(--text-faint)}
.gridmap .rt{stroke-linejoin:round}
.g-kind{fill:none;stroke:var(--text-soft);stroke-width:1.1}
.gridmap .m-bar{stroke:var(--text-soft)}
`;

export function gridDocs() {
  const G = build();
  const C = Math.floor(Math.min((1440 - 330 - 20) / G.W, (852 - 16) / G.H) * 10) / 10;
  const O = { C, ox: 330 + (1440 - 330 - G.W * C) / 2, oy: (852 - G.H * C) / 2 };
  const over = view(G, { ...O, mode: 'trunks' }), all = view(G, { ...O, mode: 'all' });
  const man = G.root.children.find((c) => c.data.ref === 'Manifolds'), Cz = Math.floor(Math.min((1440 - 330 - 60) / (man.w + 4), (852 - 60) / (man.h + 3)));
  const zoom = view(G, { C: Cz, ox: 330 + (1440 - 330 - man.w * Cz) / 2 - man.gx * Cz, oy: (852 - man.h * Cz) / 2 - man.gy * Cz, mode: 'focus', focus: 'Manifolds', labels: true });
  const card = (subtitle) => `@dsCard group="${GROUP_G}" width=1440 height=900 subtitle="${subtitle}"`;
  const n = G.root.leaves().length, links = EDGES.filter((e) => e[2] >= 2).length, laned = (v) => v.routes.filter((m) => m.lane).length;
  const base = `${n} notes on a ${G.W} by ${G.H} grid, placed from the smooth layout. Bigger blocks are notes with more links. Lighter ground is reached.`;
  return {
    GridAtlas: doc({ marker: card('The Atlas on a square grid, with folders placed as in the smooth layout and room between them. Height is nesting; reached ground is a lighter tone; the glyph in each block is the kind of note. Every link counts: one trunk per pair of folders.'),
      title: 'Atlas on a grid', css: ATLAS_CSS + A2_CSS + G_CSS, js: '',
      body: page(over, { zoomed: false, compact: true, stats: `${base} All ${links} links, as ${over.routes.length} trunks.` }) }),
    GridAtlasAll: doc({ marker: card('Stress test: the same map with every link drawn on its own, note to note, with nothing merged or hidden.'),
      title: 'Atlas on a grid, every link', css: ATLAS_CSS + A2_CSS + G_CSS, js: '',
      body: page(all, { zoomed: false, compact: true, stats: `${base} All ${all.routes.length} links drawn singly; ${laned(all)} of them run in a side lane.` }) }),
    GridAtlasFolder: doc({ marker: card('Zoomed into Manifolds, with every one of its links: those inside it, and each note’s links out to other folders. Titles sit inside their blocks, with the kind of note at the corner.'),
      title: 'Atlas on a grid, a folder in focus', css: ATLAS_CSS + A2_CSS + G_CSS, js: '',
      body: page(zoom, { zoomed: true, showCard: false, compact: true, stats: `${zoom.routes.filter((m) => m.solo).length} links touch Manifolds; ${laned(zoom)} run in a side lane. Double green rule: understood. Red frame: needs work.` }) }),
  };
}
