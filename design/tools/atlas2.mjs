// The Atlas on the previous app's own layout and router (tools/old/), with the terrain drawn over it.
// Positions: old/layout.mjs (circle packing, then a per-folder force pass), plus one added force: later in the study order sits further north.
// Routes: old/router.mjs (gates on each folder's wall, corridors between siblings, bundling), merged to one route per pair of shown items.
// Terrain: a height field of understanding, baked per layout, clipped to the top-level walls.
//
// CONTENT: folder and note names that are labelled come from the screenshots of the previous app (Differential geometry).
// The links, the understanding levels, the unlabelled notes and the Foundations subfolders are invented for the sketch.
import * as d3 from 'd3';
import { layoutPositions, start, applyPositions } from './old/layout.mjs';
import { makeRouter, lowestCommon } from './old/router.mjs';
import { doc, topbar } from './marginalia.mjs';
import { ATLAS_CSS } from './survey.mjs';
import { organic, folderFields } from './organic.mjs';

export const GROUP_AT = 'Atlas · structure and routes (differential geometry)';
const DG = { name: 'Differential geometry', mode: 'Learning' };

// [name, level 0-3, landmark?]  ('' = a note the map does not label)
const KIND = { "Stokes' theorem": 'theorem', 'Gauss–Bonnet theorem': 'theorem', 'Theorema Egregium': 'theorem', 'Partitions of unity': 'theorem', 'Submanifolds and the regular value theorem': 'theorem', 'Integral curves and flows': 'theorem', 'Levi-Civita connection': 'theorem',
  'The Möbius band as a line bundle': 'example', m1: 'example', s2: 'example', k4: 'example', b1: 'trick', 'Compute in normal coordinates': 'trick', a3: 'trick', x1: 'reference', x2: 'reference', x3: 'reference' };
export const N = (name, level = 0, big = false) => ({ name, level, big, type: KIND[name] || 'definition' });
const TREE = ['Differential geometry', [
  ['Foundations', [
    ['Analysis', [N('a1', 3), N('a2', 3), N('a3', 3)]],
    ['Topology', [N('t1', 3), N('t2', 3), N('t3', 2), N('t4', 3)]],
    ['Linear algebra', [N('l1', 3), N('l2', 3), N('l3', 3)]],
  ]],
  ['Manifolds', [
    N('Smooth manifold', 3, true), N('Smooth maps and diffeomorphisms', 3), N('Partitions of unity', 1, true), N('Submanifolds and the regular value theorem', 2),
    N('Immersions, submersions and embeddings', 1), N('m1', 2), N('m2', 3),
    ['Tangent', [N('Tangent space', 3, true), N('Tangent bundle', 2), N('Vector fields', 2), N('Differential of a smooth map', 3), N('Integral curves and flows', 1), N('Lie bracket', 0)]],
    ['Bundles', [N('Vector bundle', 1, true), N('Cotangent bundle and differentials', 1), N('Tensor fields', 0), N('The Möbius band as a line bundle', 0), N('b1', 0)]],
  ]],
  ['Forms', [N('Differential forms', 1, true), N('Pullback of forms', 0), N("Stokes' theorem", 0, true), N('Integration on manifolds', 0), N('Orientation', 0), N('De Rham cohomology', 0, true), N('f1', 0), N('f2', 0)]],
  ['Surfaces', [N('Gauss–Bonnet theorem', 0, true), N('Gaussian curvature', 0, true), N('Theorema Egregium', 0, true), N('s1', 1), N('s2', 0)]],
  ['Riemannian', [
    N('Riemannian metric', 0, true), N('Isometries', 0), N('Length and Riemannian distance', 0), N('r1', 0),
    ['Connections', [N('Geodesics', 0, true), N('Affine connection', 0), N('Parallel transport', 0), N('Levi-Civita connection', 0, true), N('Riemannian exponential map', 0), N('Covariant derivative along a curve', 0), N('Compute in normal coordinates', 0), N('c1', 0)]],
    ['Curvature', [N('k1', 0), N('k2', 0), N('k3', 0), N('k4', 0), N('k5', 0)]],
  ]],
  ['Lie groups', [N('g1', 0), N('g2', 0)]],
  ['References', [N('x1', 0), N('x2', 0), N('x3', 0)]],
]];
// a -> what it requires (3) or uses (2)
export const E = (a, bs, s = 3) => bs.map((b) => [a, b, s]);
const EDGES = [
  ...E('Smooth manifold', ['t1', 't2', 'a1']), ...E('Smooth maps and diffeomorphisms', ['Smooth manifold', 'a1']), ...E('m2', ['Smooth manifold']), ...E('m1', ['Smooth manifold'], 2),
  ...E('Partitions of unity', ['Smooth manifold', 't4']), ...E('Submanifolds and the regular value theorem', ['Differential of a smooth map', 'a2']), ...E('Immersions, submersions and embeddings', ['Differential of a smooth map', 'Submanifolds and the regular value theorem']),
  ...E('Tangent space', ['Smooth manifold', 'l1']), ...E('Differential of a smooth map', ['Tangent space', 'Smooth maps and diffeomorphisms']), ...E('Tangent bundle', ['Tangent space']), ...E('Vector fields', ['Tangent bundle']),
  ...E('Integral curves and flows', ['Vector fields', 'a3']), ...E('Lie bracket', ['Vector fields', 'Integral curves and flows']),
  ...E('Vector bundle', ['Tangent bundle', 'l2']), ...E('Cotangent bundle and differentials', ['Vector bundle', 'Tangent space']), ...E('Tensor fields', ['Vector bundle', 'Cotangent bundle and differentials', 'l3']), ...E('The Möbius band as a line bundle', ['Vector bundle'], 2), ...E('b1', ['Tensor fields'], 2),
  ...E('Differential forms', ['Tensor fields', 'Cotangent bundle and differentials']), ...E('f1', ['Differential forms']), ...E('f2', ['Differential forms', 'l3']), ...E('Pullback of forms', ['Differential forms', 'Differential of a smooth map']),
  ...E('Orientation', ['Differential forms', 'Smooth manifold']), ...E('Integration on manifolds', ['Orientation', 'Partitions of unity', 'Pullback of forms']), ...E("Stokes' theorem", ['Integration on manifolds', 'f1']), ...E('De Rham cohomology', ['f1', "Stokes' theorem"]),
  ...E('Riemannian metric', ['Tensor fields', 'Partitions of unity']), ...E('Isometries', ['Riemannian metric', 'Smooth maps and diffeomorphisms']), ...E('Length and Riemannian distance', ['Riemannian metric']), ...E('r1', ['Riemannian metric'], 2),
  ...E('Affine connection', ['Vector fields', 'Tensor fields']), ...E('Covariant derivative along a curve', ['Affine connection']), ...E('Parallel transport', ['Covariant derivative along a curve', 'a3']), ...E('Levi-Civita connection', ['Affine connection', 'Riemannian metric']),
  ...E('Geodesics', ['Levi-Civita connection', 'Covariant derivative along a curve', 'Length and Riemannian distance']), ...E('Riemannian exponential map', ['Geodesics', 'Integral curves and flows']), ...E('Compute in normal coordinates', ['Riemannian exponential map'], 2), ...E('c1', ['Parallel transport'], 2),
  ...E('k1', ['Levi-Civita connection', 'Lie bracket']), ...E('k2', ['k1']), ...E('k3', ['k1', 'Tensor fields']), ...E('k4', ['k2']), ...E('k5', ['k3', 'Geodesics'], 2),
  ...E('Gaussian curvature', ['s1', 'Submanifolds and the regular value theorem']), ...E('Theorema Egregium', ['Gaussian curvature', 'Riemannian metric', 'k1']), ...E('Gauss–Bonnet theorem', ['Gaussian curvature', 'Integration on manifolds', 'Geodesics']), ...E('s2', ['Gaussian curvature'], 2), ...E('s1', ['Tangent space', 'a2']),
  ...E('g1', ['Smooth manifold', 'Vector fields']), ...E('g2', ['g1', 'Lie bracket']), ...E('x1', ['Smooth manifold'], 1), ...E('x2', ['Riemannian metric'], 1), ...E('x3', ['Differential forms'], 1),
  ...E('t3', ['t1']), ...E('t4', ['t2']), ...E('a2', ['a1', 'l1']), ...E('a3', ['a1']), ...E('l3', ['l2']), ...E('l2', ['l1']),
];
const STRUGGLING = 'Vector fields';

function model(ds) {
  const { tree: TREE, edges: EDGES } = ds;
  const rank = new Map();
  const out = new Map(); for (const [a, b, s] of EDGES) if (s >= 2) (out.get(a) || out.set(a, []).get(a)).push(b);
  const depth = (n, seen = new Set()) => { if (rank.has(n)) return rank.get(n); if (seen.has(n)) return 0; seen.add(n); const d = 1 + Math.max(-1, ...(out.get(n) || []).map((m) => depth(m, seen))); rank.set(n, d); return d; };
  const build = (t, path) => Array.isArray(t)
    ? { kind: 'dir', id: 'd:' + path + t[0], ref: t[0], children: t[1].map((c) => build(c, path + t[0] + '/')) }
    : { kind: 'concept', id: 'c:' + t.name, ref: t.name, weight: t.big ? 2.6 : 1, level: t.level, big: t.big, type: t.type, rank: depth(t.name) };
  return { root: build(TREE, ''), edges: EDGES };
}

const SETTINGS = { room: 0.34, spread: 1, outward: 1, spacing: 80, margin: 60, north: 5, dot: 0.6, bundle: 0.3, detour: 8 };

export function layout(ds = { tree: TREE, edges: EDGES, struggling: STRUGGLING }, settings = SETTINGS) {
  const mdl = model(ds);
  const xyr = layoutPositions(mdl, settings);
  const { root, byId } = start(mdl.root);
  applyPositions(root, xyr);
  return { root, byId, edges: mdl.edges, struggling: ds.struggling, rings: ds.rings || 'green', review: ds.review || new Set() };
}

// ---- terrain: baked once per layout, in layout units ----
const STEP = 3, SIZE = 1000, G = Math.ceil(SIZE / STEP);
// mask: pass folderFields(L).inside to keep the terrain inside contour outlines (the contour folder shape); leave out for circles
export function terrain(L, mask = null) {
  const leaves = L.root.leaves(); // every note counts: height is the mean level of the notes nearby, not their sum
  // kernel width follows the spacing of a note's own folder, so nested folders get finer terrain
  const sigma = (n) => { const sib = n.parent.children.filter((c) => c !== n); const d = Math.min(...sib.map((c) => Math.hypot(c.x - n.x, c.y - n.y)), n.parent.r); return Math.max(9, d * 0.62); };
  const pts = leaves.map((n) => ({ x: n.x, y: n.y, l: n.data.level, s: sigma(n) }));
  // normalised: one note alone gives its own level at its centre; a crowd gives the crowd's mean level, however many notes it holds
  const field = (x, y) => { let v = 0, D = 0; for (const p of pts) { const dx = x - p.x, dy = y - p.y, k = Math.exp(-(dx * dx + dy * dy) / (2 * p.s * p.s)); v += p.l * k; D += k; } return (v / Math.pow(1 + D ** 4, 0.25)) * (mask ? mask(x, y) : 1); };
  const vals = new Float64Array(G * G);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) vals[j * G + i] = field(i * STEP, j * STEP);
  const gen = d3.contours().size([G, G]);
  return { field, levels: [0.4, 0.9, 1.6, 2.3].map((t) => gen.contour(vals, t)) };
}

const f1 = (v) => v.toFixed(1);
export function shapeSvg(type, x, y, r, cls) {
  if (type === 'theorem') return `<path d="M${f1(x)} ${f1(y - r * 1.3)}L${f1(x + r * 1.05)} ${f1(y)}L${f1(x)} ${f1(y + r * 1.3)}L${f1(x - r * 1.05)} ${f1(y)}Z" class="${cls}"/>`;
  if (type === 'example') return `<path d="M${f1(x)} ${f1(y - r * 1.2)}L${f1(x + r * 1.15)} ${f1(y + r * 0.85)}L${f1(x - r * 1.15)} ${f1(y + r * 0.85)}Z" class="${cls}"/>`;
  if (type === 'trick') return `<rect x="${f1(x - r * 0.88)}" y="${f1(y - r * 0.88)}" width="${f1(r * 1.76)}" height="${f1(r * 1.76)}" class="${cls}"/>`;
  if (type === 'reference') return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" class="${cls}"/><path d="M${f1(x - r)} ${f1(y)}H${f1(x + r)}" class="m-bar"/>`;
  return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 0.92)}" class="${cls}"/>`;
}

// ---- one view of the map ----
// links implied by a chain of other requires-links (a transitive reduction, as the previous app does)
function impliedSet(edges) {
  const out = new Map(); for (const [a, b, s] of edges) if (s === 3) (out.get(a) || out.set(a, []).get(a)).push(b);
  const imp = new Set();
  for (const [a, c, s] of edges) { if (s !== 3) continue;
    const seen = new Set([a]), stack = (out.get(a) || []).filter((b) => b !== c); stack.forEach((b) => seen.add(b));
    while (stack.length) { const v = stack.pop(); if (v === c) { imp.add(a + '\n' + c); break; } for (const w of out.get(v) || []) if (!seen.has(w)) { seen.add(w); stack.push(w); } } }
  return imp;
}

// links: 'all' every link at the shown scale | 'none' | 'trunks' one route per pair of top-level folders | 'focus' the focused folder's inside links plus trunks
// terrain: 'full' | 'overview' frontier and one contour | 'reduced' fog and frontier only
export function view(L, T, { k, cx, cy, sx, sy, openAt, selected, avoid = [], links = 'all', terrain = 'full', focus = null, org = null, W = 1440, H = 852 }) {
  const X = (x) => (x - cx) * k + sx, Y = (y) => (y - cy) * k + sy;
  const root = L.root, tops = root.children;
  const open = new Set([root]);
  root.each((n) => { if (n.data.kind === 'dir' && n.parent && open.has(n.parent) && n.r * k >= openAt) open.add(n); });
  const shownRep = (leaf) => { for (const a of leaf.ancestors().reverse()) if (!(a.data.kind === 'dir' && open.has(a))) return a; return leaf; };
  const shown = []; root.each((n) => { if (n.parent && open.has(n.parent)) shown.push(n); });

  // merge links to one route per pair of shown items; route heavier ones first so lighter ones follow their corridors
  const implied = impliedSet(L.edges), topOf = (n) => n.ancestors().find((a) => a.depth === 1);
  const merged = new Map();
  const add = (ra, rb, cls) => { if (ra === rb) return; const [p, q] = ra.data.id < rb.data.id ? [ra, rb] : [rb, ra]; const key = p.data.id + '|' + q.data.id + '|' + cls;
    const m = merged.get(key) || { key, p, q, count: 0, cls }; m.count++; merged.set(key, m); };
  for (const [a, b, s] of L.edges) {
    const na = L.byId.get('c:' + a), nb = L.byId.get('c:' + b); if (!na || !nb) throw new Error('edge ' + a + ' / ' + b);
    if (L.review.has(a + '\n' + b)) { add(shownRep(na), shownRep(nb), 'req'); continue; } // a change in review is always drawn
    const mine = selected && (a === selected || b === selected);
    if (links === 'all') { if (s >= 2) add(shownRep(na), shownRep(nb), mine ? 'req' : selected ? 'quiet' : ''); continue; }
    if (mine && s >= 2) { add(shownRep(na), shownRep(nb), a === selected ? 'req' : 'dep'); continue; } // a selected note always shows its own links
    if (links === 'none' || s < 3 || implied.has(a + '\n' + b)) continue;
    const ta = topOf(na), tb = topOf(nb);
    if (links === 'trunks') { add(ta, tb, ''); continue; }
    const fa = ta.data.ref === focus, fb = tb.data.ref === focus;
    if (fa && fb) add(shownRep(na), shownRep(nb), ''); else add(ta, tb, fa || fb ? '' : 'quiet');
  }
  const router = makeRouter(SETTINGS);
  const routes = [...merged.values()].sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1));
  for (const m of routes) m.pts = (org ? org.route(m.p, m.q) : router.route(m.p, m.q)).map(([x, y]) => [X(x), Y(y)]);

  const radius = (n) => (n.data.kind === 'dir' ? n.r * k : n.data.big ? 9 : 6);
  const trim = (a, b, r) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + ((b[0] - a[0]) / d) * r, a[1] + ((b[1] - a[1]) / d) * r]; };
  const curve = d3.line().curve(d3.curveBasis);
  const pathFor = (m) => {
    let s = m.pts.slice();
    if (org) { // a dense, already smooth line: drop what lies under a note's marker, then draw it as it is
      for (const [e, end] of [[m.p, 0], [m.q, 1]]) { if (e.data.kind !== 'concept') continue; const c = [X(e.x), Y(e.y)], r = radius(e) + 4;
        while (s.length > 2 && Math.hypot(s[end ? s.length - 1 : 0][0] - c[0], s[end ? s.length - 1 : 0][1] - c[1]) < r) end ? s.pop() : s.shift(); }
      return 'M' + s.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L');
    }
    if (s.length === 2) {
      const f = trim(s[0], s[1], radius(m.p) + 3), g = trim(s[1], s[0], radius(m.q) + 3);
      const dx = g[0] - f[0], dy = g[1] - f[1], d = Math.hypot(dx, dy) || 1, bow = Math.min(d * 0.1, 28);
      return `M${f[0].toFixed(1)} ${f[1].toFixed(1)}Q${((f[0] + g[0]) / 2 - (dy / d) * bow).toFixed(1)} ${((f[1] + g[1]) / 2 + (dx / d) * bow).toFixed(1)} ${g[0].toFixed(1)} ${g[1].toFixed(1)}`;
    }
    s[0] = trim(s[0], s[1], radius(m.p) + 3); s[s.length - 1] = trim(s[s.length - 1], s[s.length - 2], radius(m.q) + 3);
    return curve(s).replace(/(\.\d)\d+/g, '$1');
  };
  const wid = (c) => (1 + Math.log2(c) * 0.9).toFixed(2);

  // terrain in screen space
  const proj = d3.geoPath(d3.geoIdentity().scale(STEP * k).translate([X(0), Y(0)]));
  const [front, ...lv] = T.levels.map((c) => proj(c).replace(/(\.\d)\d+/g, '$1'));
  const hach = [];
  { const e = 1.5; let tick = 0;
    for (const poly of T.levels[0].coordinates) for (const ring of poly) { let acc = 0;
      for (let i = 1; i < ring.length; i++) {
        const x0 = X(ring[i - 1][0] * STEP), y0 = Y(ring[i - 1][1] * STEP), x1 = X(ring[i][0] * STEP), y1 = Y(ring[i][1] * STEP);
        const seg = Math.hypot(x1 - x0, y1 - y0); if (!seg) continue; let d = 0;
        while (acc + (seg - d) >= 11) { d += 11 - acc; acc = 0;
          const x = x0 + (x1 - x0) * (d / seg), y = y0 + (y1 - y0) * (d / seg);
          if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
          const lx = (x - sx) / k + cx, ly = (y - sy) / k + cy;
          const gx = T.field(lx + e, ly) - T.field(lx - e, ly), gy = T.field(lx, ly + e) - T.field(lx, ly - e), gl = Math.hypot(gx, gy) || 1, len = tick++ % 2 ? 4 : 8;
          hach.push(`M${x.toFixed(1)} ${y.toFixed(1)}l${((-gx / gl) * len).toFixed(1)} ${((-gy / gl) * len).toFixed(1)}`); }
        acc += seg - d; } } }

  const circ = (n, cls, extra = '') => `<circle cx="${X(n.x).toFixed(1)}" cy="${Y(n.y).toFixed(1)}" r="${(n.r * k).toFixed(1)}" class="${cls}"${extra}/>`;
  const blob = (n, cls) => `<path d="${proj(org.shape.get(n)).replace(/(\.\d)\d+/g, '$1')}" class="${cls}"/>`;
  const walls = tops.map((n) => (org ? blob(n, 'a-land') : circ(n, 'a-land'))).join('');
  const clip = tops.map((n) => (org ? blob(n, '') : circ(n, ''))).join('');
  const arcLabel = (n, i, cls) => {
    const r = n.r * k + 9, x = X(n.x), y = Y(n.y), a0 = -Math.PI * 0.78, a1 = -Math.PI * 0.22;
    return `<path id="arc${i}" d="M${(x + r * Math.cos(a0)).toFixed(1)} ${(y + r * Math.sin(a0)).toFixed(1)}A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(x + r * Math.cos(a1)).toFixed(1)} ${(y + r * Math.sin(a1)).toFixed(1)}" fill="none"/><text class="${cls}"><textPath href="#arc${i}" startOffset="50%" text-anchor="middle">${n.data.ref} <tspan class="a-count">${n.leaves().length}</tspan></textPath></text>`;
  };
  const folders = shown.filter((n) => n.data.kind === 'dir');
  const folderSvg = folders.map((n, i) => {
    if (org) {
      const b = org.box(n), x = X((b.x0 + b.x1) / 2), top = Y(b.y0);
      if (open.has(n)) return blob(n, n.depth > 1 ? 'w-sub' : 'w-top') + `<text x="${x.toFixed(1)}" y="${(top - 7).toFixed(1)}" text-anchor="middle" class="a-folder${n.depth > 1 ? ' sub' : ''}">${n.data.ref} <tspan class="a-count">${n.leaves().length}</tspan></text>`;
      const y = Y((b.y0 + b.y1) / 2);
      return blob(n, 'w-closed') + `<text x="${x.toFixed(1)}" y="${(y - 2).toFixed(1)}" text-anchor="middle" class="a-folder">${n.data.ref}</text><text x="${x.toFixed(1)}" y="${(y + 13).toFixed(1)}" text-anchor="middle" class="a-label dim">${n.leaves().length} notes</text>`;
    }
    if (open.has(n)) return (n.depth > 1 ? circ(n, 'w-sub') : circ(n, 'w-top')) + arcLabel(n, i, n.depth > 1 ? 'a-folder sub' : 'a-folder');
    const x = X(n.x), y = Y(n.y);
    return circ(n, 'w-closed') + `<text x="${x.toFixed(1)}" y="${(y - 2).toFixed(1)}" text-anchor="middle" class="a-folder">${n.data.ref}</text><text x="${x.toFixed(1)}" y="${(y + 13).toFixed(1)}" text-anchor="middle" class="a-label dim">${n.leaves().length} notes</text>`;
  }).join('');

  // shape = the kind of note (as on the previous map); fill and ring = understanding
  const marker = (n) => {
    const x = X(n.x), y = Y(n.y), l = n.data.level, r = (n.data.big ? 7.5 : 5.5) * (l ? 1 : 0.8), cls = l >= 2 ? 'm-fill' : l === 1 ? 'm-open' : 'm-none';
    const ring = n.data.ref === L.struggling ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 6).toFixed(1)}" class="ring-red"/>` : l === 3 && L.rings === 'plain' ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 5).toFixed(1)}" class="ring-plain"/>` : l === 3 ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 6.5).toFixed(1)}" class="ring-green-out"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 4).toFixed(1)}" class="ring-green-in"/>` : '';
    return ring + shapeSvg(n.data.type, x, y, r, cls);
  };
  const notes = shown.filter((n) => n.data.kind === 'concept');
  const inView = (n) => X(n.x) > 300 && X(n.x) < W - 20 && Y(n.y) > 10 && Y(n.y) < H - 10;
  // labels: landmarks always, the rest once zoomed in; each tries right then left of its marker and is dropped if both collide
  const want = notes.filter((n) => inView(n) && n.data.ref.length > 2 && (n.data.big || k > 1.4 || n.data.ref === selected))
    .sort((a, b) => (b.data.ref === selected) - (a.data.ref === selected) || b.data.big - a.data.big || b.data.level - a.data.level);
  const boxes = [...notes.map((n) => ({ n, x0: X(n.x) - 11, x1: X(n.x) + 11, y0: Y(n.y) - 11, y1: Y(n.y) + 11 })), ...avoid.map(([x0, y0, x1, y1]) => ({ x0, y0, x1, y1 }))];
  const hits = (b, self) => boxes.filter((o) => o.n !== self && b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0).length;
  const labels = want.map((n) => {
    const words = n.data.ref.split(' '), lines = []; let line = '';
    for (const w of words) { if (line && (line + ' ' + w).length > 22) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w; } lines.push(line);
    const w = Math.max(...lines.map((t) => t.length)) * 6.7 + 4, h = lines.length * 13 + 2;
    const cand = [n.x >= n.parent.x, n.x < n.parent.x].map((right) => { const x = X(n.x) + (right ? 16 : -16); return { right, x, box: { x0: right ? x : x - w, x1: right ? x + w : x, y0: Y(n.y) - h / 2, y1: Y(n.y) + h / 2 } }; });
    const free = cand.find((c) => !hits(c.box, n));
    const must = n.data.big || n.data.ref === selected;
    const pick = free || (must ? cand.sort((a, b) => hits(a.box, n) - hits(b.box, n))[0] : null);
    if (!pick) return '';
    boxes.push(pick.box);
    const y = Y(n.y) + 4;
    return `<text class="a-label${n.data.level ? '' : ' dim'}${n.data.ref === selected ? ' sel' : ''}" text-anchor="${pick.right ? 'start' : 'end'}">${lines.map((t, i) => `<tspan x="${pick.x.toFixed(1)}" y="${(y + (i - (lines.length - 1) / 2) * 13).toFixed(1)}">${t}</tspan>`).join('')}</text>`;
  }).join('');
  const selNode = selected ? L.byId.get('c:' + selected) : null;

  const own = (m) => m.cls === 'req' || m.cls === 'dep', plain = routes.filter((m) => !own(m));
  // where a trunk's count sits: half way along the part of its route that lies outside both folders
  // with contour folders the route already ends on both outlines: try several places along it and take the one furthest from notes, labels and other counts
  const taken = notes.map((n) => [X(n.x), Y(n.y), 26]);
  const mid = (m) => { const P = m.pts, out = [];
    if (org) { let best = P[Math.floor(P.length / 2)], bd = -1;
      for (const t of [0.5, 0.35, 0.65, 0.22, 0.78]) { const c = P[Math.min(P.length - 1, Math.floor(P.length * t))]; let d = Math.min(...taken.map(([x, y, r]) => Math.hypot(c[0] - x, c[1] - y) - r), 1e9); if (boxes.some((b) => c[0] > b.x0 - 10 && c[0] < b.x1 + 10 && c[1] > b.y0 - 10 && c[1] < b.y1 + 10)) d = -1; if (d > bd) { bd = d; best = c; } if (d > 14) break; }
      taken.push([best[0], best[1], 12]); return best; }
    for (let i = 0; i < P.length - 1; i++) for (let t = 0; t < 1; t += 0.04) { const x = P[i][0] + (P[i + 1][0] - P[i][0]) * t, y = P[i][1] + (P[i + 1][1] - P[i][1]) * t;
      if ([m.p, m.q].every((c) => Math.hypot(x - X(c.x), y - Y(c.y)) > c.r * k + 6)) out.push([x, y]); }
    return out.length ? out[Math.floor(out.length / 2)] : P[Math.floor(P.length / 2)]; };
  const svg = `<svg class="atlas" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Atlas of Differential geometry: nested folders, routes through their gates, and the terrain of your understanding">
  <defs><clipPath id="walls">${clip}</clipPath><pattern id="fogdots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.8" class="fogdot"/></pattern></defs>
  <rect width="${W}" height="${H}" class="a-sea"/>
  ${walls}
  <g clip-path="url(#walls)">
    ${terrain === 'full' ? `<path d="${lv[0]}" class="a-tint t1"/><path d="${lv[1]}" class="a-tint t2"/><path d="${lv[2]}" class="a-tint t3"/>` : terrain === 'overview' ? `<path d="${lv[1]}" class="a-tint t2"/>` : ''}
    <path d="M0 0H${W}V${H}H0Z${front}" fill-rule="evenodd" class="a-fogdots"/>
    ${terrain === 'full' ? `<path d="${lv[0]}" class="a-contour c1"/><path d="${lv[1]}" class="a-contour c2"/><path d="${lv[2]}" class="a-contour c3"/>` : terrain === 'overview' ? `<path d="${lv[1]}" class="a-contour c2"/>` : ''}
    <path d="${front}" class="a-front${terrain === 'reduced' ? ' thin' : ''}"/>${terrain === 'reduced' ? '' : `<path d="${hach.join('')}" class="a-hach"/>`}
  </g>
  ${plain.map((m) => `<path d="${pathFor(m)}" class="rt-halo" stroke-width="${(+wid(m.count) + 3).toFixed(2)}"/>`).join('')}
  ${plain.map((m) => `<path d="${pathFor(m)}" class="rt${m.cls ? ' quiet' : ''}" stroke-width="${wid(m.count)}"/>`).join('')}
  ${folderSvg}
  ${plain.filter((m) => m.p.depth === 1 && m.q.depth === 1 && !m.cls && links !== 'all').map((m) => { const c = mid(m); return `<text x="${c[0].toFixed(1)}" y="${(c[1] + 4).toFixed(1)}" text-anchor="middle" class="a-stopno">${m.count}</text>`; }).join('')}
  ${routes.filter(own).map((m) => `<path d="${pathFor(m)}" class="rt-halo" stroke-width="7"/><path d="${pathFor(m)}" class="${m.cls === 'dep' ? 'rt-dep' : 'rt-sel'}"/>`).join('')}
  ${notes.map(marker).join('')}
  ${selNode ? `<circle cx="${X(selNode.x).toFixed(1)}" cy="${Y(selNode.y).toFixed(1)}" r="16" class="stop-ring"/>` : ''}
  ${labels}
</svg>`;
  return { svg, routes, open, selNode, X, Y };
}

export const A2_CSS = `
.a-land{fill:var(--surface-1)}
.w-top{fill:none;stroke:var(--rule-strong);stroke-width:1;stroke-dasharray:7 5}
.w-sub{fill:none;stroke:var(--rule-strong);stroke-width:1;stroke-dasharray:2 4}
.w-closed{fill:var(--surface-2);fill-opacity:.9;stroke:var(--rule-strong);stroke-width:1.25}
.rt{fill:none;stroke:var(--text-soft);stroke-linecap:round;opacity:.9}
.rt.quiet{opacity:.45}
.rt-halo{fill:none;stroke:var(--surface);stroke-linecap:round;opacity:.75}
.rt-sel{fill:none;stroke:var(--pen-blue);stroke-width:3.2;stroke-linecap:round;stroke-dasharray:.1 7.5}
.rt-dep{fill:none;stroke:var(--pen-blue);stroke-width:1.9;stroke-linecap:round;stroke-dasharray:.1 4.2}
.a-front.thin{stroke-width:1;opacity:.8}
.m-land{fill:none;stroke:var(--text-soft);stroke-width:1}
.m-bar{stroke:var(--text-faint);stroke-width:1.25;fill:none}
.kinds{display:flex;flex-wrap:wrap;gap:4px 14px;margin:12px 0 0;padding:10px 0 0;border-top:1px solid var(--rule)}
.kinds span{display:inline-flex;align-items:center;gap:6px}
.kinds svg{overflow:visible;flex:none}
.a-folder.sub{font-weight:500;font-size:11px}
.a-label.sel{font-weight:700}
.a-fogdots{fill:url(#fogdots)}
.crumbs{position:absolute;right:16px;top:16px;background:var(--surface-1);border:1px solid var(--rule);border-radius:var(--radius-md);padding:7px 12px;font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft)}
.crumbs b{color:var(--text)}
.selcard{position:absolute;width:264px}
.selcard .pin{position:relative}
.selcard .row{display:flex;gap:8px;margin-top:8px}
.selcard .btn{height:28px;padding:0 10px;font-size:12px}
.lens .legend .rtk{display:block}
.north{right:28px;bottom:64px}
`;

export const lg = {
  understood: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="10" class="ring-green-out"/><circle r="7.6" class="ring-green-in"/><circle r="4" class="m-fill"/></svg>`,
  worked: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="5" class="m-fill"/></svg>`,
  opened: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="4.5" class="m-open"/></svg>`,
  none: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="3.2" class="m-none"/></svg>`,
  needs: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="10" class="ring-red"/><circle r="4.5" class="m-fill"/></svg>`,
  land: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle cx="-4" r="3.6" class="m-open"/><circle cx="5" r="5.6" class="m-open"/></svg>`,
  frontier: `<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 12H20" class="a-front"/><path d="M4 12v-6M8 12v-3M12 12v-6M16 12v-3M20 12v-6" class="a-hach"/></svg>`,
  route: `<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 7H20" class="rt" stroke-width="1"/><path d="M2 15H20" class="rt" stroke-width="3.2"/></svg>`,
  sel: `<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 11H20" class="rt-sel"/></svg>`,
  dep: `<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 11H20" class="rt-dep"/></svg>`,
  fog: `<svg width="22" height="22" viewBox="0 0 22 22"><rect x="1" y="4" width="20" height="14" class="a-fogdots"/></svg>`,
  front: `<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 11H20" class="a-front thin"/></svg>`,
  trunk: `<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 11H20" class="rt" stroke-width="3.2"/></svg>`,
  wall: `<svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" class="w-top"/></svg>`,
};
const CARD = [1150, 420];
const NORTH = `<div class="north"><svg width="28" height="56" viewBox="0 0 28 56" aria-hidden="true"><path d="M14 54V8" stroke="var(--text-soft)" stroke-width="1.5" fill="none"/><path d="M14 2L21 17H14Z" fill="var(--text-soft)"/><path d="M14 2L7 17H14Z" fill="none" stroke="var(--text-soft)" stroke-width="1.25"/></svg><span>N · later in the study order</span></div>`;

const MARKS = [[lg.understood, 'Understood: filled, double green ring'], [lg.worked, 'Worked through: filled'], [lg.opened, 'Opened: outline'], [lg.none, 'Not reached: faint, in fog'], [lg.needs, 'The teacher says: needs work'], [lg.land, 'Landmark: drawn larger']];
const KINDS = `<div class="kinds">${[['definition', 'Definition'], ['theorem', 'Theorem'], ['example', 'Example'], ['trick', 'Trick'], ['reference', 'Reference']].map(([t, n]) => `<span><svg width="14" height="16" viewBox="-7 -8 14 16">${shapeSvg(t, 0, 0, 5, 'm-open')}</svg>${n}</span>`).join('')}</div>`;
export function page(v, { zoomed, stats, legend, on = ['Links', 'Understanding'], showCard = zoomed, proj = DG, north = true, kinds = true, chips = ['Links', 'Understanding', 'Study path', 'Tour', 'Goal'], hint = 'Click a note to open it, a region to zoom in, empty space to step out.', note = '' }) {
  legend = legend || [...MARKS, [lg.frontier, 'Frontier: hachures face the fog'], [lg.wall, 'A folder’s wall; routes leave by gates on it'], [lg.route, 'One route per pair of places; wider = more links'], ...(zoomed ? [[lg.sel, 'Links of the selected note']] : [])];
  const lens = `<aside class="lens" aria-label="Lenses"><h2>Lenses</h2>
    <div class="chips">${chips.map((n) => `<button class="btn" type="button"${on.includes(n) ? ' aria-pressed="true"' : ''}>${n}</button>`).join('')}</div>
    ${kinds ? KINDS : ''}
    <ul class="legend" style="list-style:none;margin:14px 0 0;padding:10px 0 0;border-top:1px solid var(--rule)">${legend.map(([i, t]) => `<li>${i}<span>${t}</span></li>`).join('')}</ul>
    <p class="note">${stats}</p>${note ? `<p class="note">${note}</p>` : ''}</aside>`;
  let card = '';
  if (showCard && v.selNode) {
    const nx = v.X(v.selNode.x), ny = v.Y(v.selNode.y);
    card = `<svg class="leaders" width="1440" height="852" aria-hidden="true"><path class="ld-red" d="M${(nx + 15).toFixed(0)} ${(ny - 8).toFixed(0)}L${CARD[0] - 26} ${CARD[1] + 16}H${CARD[0]}"/><circle class="dot-red" r="3.5" cx="${CARD[0]}" cy="${CARD[1] + 16}"/></svg>
    <div class="selcard" style="left:${CARD[0]}px;top:${CARD[1]}px"><aside class="pin pin-red"><div class="pin-head"><b>Vector fields</b></div><p>Needs work. Requires 1 note; 4 notes build on it.</p><div class="row"><button class="btn" type="button">Open the note</button><button class="btn" type="button">Exercise 2</button></div></aside></div>`;
  }
  return `<div class="screen">
${topbar('Atlas', false, proj)}
<div class="atlas-wrap">
${v.svg}
${lens}
${zoomed ? '<div class="crumbs">Differential geometry / <b>Manifolds</b></div>' : ''}
${card}
${north ? NORTH : ''}
<div class="hint">${hint}</div>
<div class="fabs"><button class="btn" type="button">New note</button><button class="btn" type="button">New folder</button></div>
</div>
</div>`;
}

export function atlas2Docs() {
  const L = layout(), T = terrain(L);
  const links = L.edges.filter((e) => e[2] >= 2).length, n = L.root.leaves().length;
  // fit the top-level regions into the space right of the lens panel (see fit() for the reusable form)
  const tops = L.root.children, x0 = Math.min(...tops.map((t) => t.x - t.r)), x1 = Math.max(...tops.map((t) => t.x + t.r)), y0 = Math.min(...tops.map((t) => t.y - t.r)), y1 = Math.max(...tops.map((t) => t.y + t.r));
  const k0 = Math.min((1440 - 330 - 40) / (x1 - x0), (852 - 70) / (y1 - y0));
  const over = view(L, T, { k: k0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, sx: 330 + (1440 - 330 - 20) / 2, sy: 852 / 2 + 6, openAt: 70 });
  const man = L.byId.get('d:Differential geometry/Manifolds');
  const zoom = view(L, T, { k: 2.05, cx: man.x, cy: man.y, sx: 800, sy: 440, openAt: 60, selected: 'Vector fields', avoid: [[CARD[0] - 10, CARD[1] - 10, CARD[0] + 274, CARD[1] + 110]] });
  // ---- one question at a time: four states of the same map ----
  const O = { k: k0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, sx: 330 + (1440 - 330 - 20) / 2, sy: 852 / 2 + 6, openAt: 70 };
  const Z = { k: 2.05, cx: man.x, cy: man.y, sx: 800, sy: 440, openAt: 60 };
  const rest = view(L, T, { ...O, links: 'none', terrain: 'overview' });
  const trunks = view(L, T, { ...O, links: 'trunks', terrain: 'overview' });
  const folder = view(L, T, { ...Z, links: 'focus', terrain: 'reduced', focus: 'Manifolds' });
  const note = view(L, T, { ...Z, links: 'none', terrain: 'full', selected: 'Vector fields', avoid: [[CARD[0] - 10, CARD[1] - 10, CARD[0] + 274, CARD[1] + 110]] });
  const req = L.edges.filter((e) => e[2] === 3).length, imp = impliedSet(L.edges).size;
  const G4 = 'Atlas · one question at a time';
  const c4 = (subtitle) => `@dsCard group="${G4}" width=1440 height=900 subtitle="${subtitle}"`;
  const four = {
    AtlasResting: doc({ marker: c4('Links switched off: terrain and structure only. Marker shape is the kind of note; fill and ring are understanding.'), title: 'Atlas, resting', css: ATLAS_CSS + A2_CSS, js: '',
      body: page(rest, { zoomed: false, on: ['Understanding'], stats: `${n} notes in 7 folders. Links are off.`, legend: [...MARKS, [lg.frontier, 'Frontier: hachures face the fog'], [lg.wall, 'A folder’s wall']] }) }),
    AtlasLinks: doc({ marker: c4('The default view. Links are on, filtered to stay calm: requires-links only, implied ones hidden, one trunk per pair of folders with its count.'), title: 'Atlas, links on', css: ATLAS_CSS + A2_CSS, js: '',
      body: page(trunks, { zoomed: false, stats: `${req - imp} requires-links between and inside folders (${imp} implied ones hidden); ${trunks.routes.length} trunks drawn.`, legend: [[lg.trunk, 'Trunk: every link between two folders, with its count'], [lg.wall, 'A folder’s wall; trunks leave by gates on it'], [lg.frontier, 'Frontier: hachures face the fog'], ...MARKS.slice(0, 5)] }) }),
    AtlasFolder: doc({ marker: c4('A folder in focus: how does this part fit together? Its inside links appear, its trunks stay, other trunks fade.'), title: 'Atlas, a folder in focus', css: ATLAS_CSS + A2_CSS, js: '',
      body: page(folder, { zoomed: true, showCard: false, stats: `Manifolds in focus: ${folder.routes.filter((m) => !m.cls && m.p.depth > 1).length} routes inside, ${folder.routes.filter((m) => !m.cls && m.p.depth === 1).length} trunks out.`, legend: [[lg.route, 'Inside the folder: one route per pair of places'], [lg.trunk, 'Trunk to another folder, with its count'], [lg.wall, 'A folder’s wall; routes leave by gates on it'], [lg.front, 'Frontier of what you have reached'], [lg.fog, 'Not reached, in fog'], ...MARKS.slice(0, 3), MARKS[4]] }) }),
    AtlasNote: doc({ marker: c4('A note selected: what does this one need, and what needs it? Only its own links, in the blue pen. Links lens off, so the terrain is back in full.'), title: 'Atlas, a note selected', css: ATLAS_CSS + A2_CSS, js: '',
      body: page(note, { zoomed: true, on: ['Understanding'], stats: 'Vector fields selected. Its links show whether or not the Links lens is on.', legend: [[lg.sel, 'What the selected note requires or uses'], [lg.dep, 'What builds on the selected note'], ...MARKS, [lg.frontier, 'Frontier: hachures face the fog']] }) }),
  };
  // ---- exploration: folders as contours, routes that cross contours at right angles ----
  const GO = 'Atlas · exploration: contour folders, downhill routes';
  const co = (subtitle) => `@dsCard group="${GO}" width=1440 height=900 subtitle="${subtitle}"`;
  const Tm = terrain(L, folderFields(L).inside);
  const mk = (opts) => { const org = organic(L, Tm); const v = view(L, Tm, { ...opts, org }); return { v, st: org.stats() }; };
  const oRest = mk({ ...O, links: 'none', terrain: 'overview' }), oLinks = mk({ ...O, links: 'trunks', terrain: 'overview' });
  const oFolder = mk({ ...Z, links: 'focus', terrain: 'reduced', focus: 'Manifolds' }), oNote = mk({ ...Z, links: 'none', terrain: 'full', selected: 'Vector fields', avoid: [[CARD[0] - 10, CARD[1] - 10, CARD[0] + 274, CARD[1] + 110]] });
  const ang = (st) => `Routes meet folder outlines a median ${st.median.toFixed(0)}° off a right angle (${st.n} crossings; 9 in 10 within ${st.p90.toFixed(0)}°).`;
  const WALL = [lg.wall, 'A folder’s outline: a contour of where its contents sit'];
  const explore = {
    OrganicResting: doc({ marker: co('Exploration, links off. Folders are contours of where their contents sit, not circles; the understanding contours nest inside them. Same positions as before.'), title: 'Atlas exploration, resting', css: ATLAS_CSS + A2_CSS, js: '',
      body: page(oRest.v, { zoomed: false, on: ['Understanding'], stats: 'Same positions as the circle map. Only the outlines changed.', legend: [...MARKS, [lg.frontier, 'Frontier: hachures face the fog'], WALL] }) }),
    OrganicLinks: doc({ marker: co('Exploration, the default view. Trunks leave each folder straight down its slope, so they cross the outline at a right angle, and travel sideways only on the flat ground between folders.'), title: 'Atlas exploration, links on', css: ATLAS_CSS + A2_CSS, js: '',
      body: page(oLinks.v, { zoomed: false, stats: ang(oLinks.st), legend: [[lg.trunk, 'Trunk: every link between two folders, with its count'], WALL, [lg.frontier, 'Frontier: hachures face the fog'], ...MARKS.slice(0, 5)] }) }),
    OrganicFolder: doc({ marker: co('Exploration, a folder in focus. Routes inside Manifolds run up and down the slopes and gather where earlier routes went.'), title: 'Atlas exploration, a folder in focus', css: ATLAS_CSS + A2_CSS, js: '',
      body: page(oFolder.v, { zoomed: true, showCard: false, stats: ang(oFolder.st), legend: [[lg.route, 'Inside the folder: one route per pair of places'], [lg.trunk, 'Trunk to another folder, with its count'], WALL, [lg.front, 'Frontier of what you have reached'], [lg.fog, 'Not reached, in fog'], ...MARKS.slice(0, 3), MARKS[4]] }) }),
    OrganicNote: doc({ marker: co('Exploration, a note selected. Its links leave it downhill, across the understanding contours and the folder outlines.'), title: 'Atlas exploration, a note selected', css: ATLAS_CSS + A2_CSS, js: '',
      body: page(oNote.v, { zoomed: true, on: ['Understanding'], stats: ang(oNote.st), legend: [[lg.sel, 'What the selected note requires or uses'], [lg.dep, 'What builds on the selected note'], ...MARKS, [lg.frontier, 'Frontier: hachures face the fog'], WALL] }) }),
  };
  console.log('organic angles', oLinks.st, oFolder.st, oNote.st);
  const card = (subtitle) => `@dsCard group="${GROUP_AT}" width=1440 height=900 subtitle="${subtitle}"`;
  return {
    ...four,
    ...explore,
    AtlasStructure: doc({ marker: card('Before: everything at once. The whole field, laid out and routed by the previous app’s own code, with the terrain of understanding on top. Subfolders are closed; links merge into one route per pair of places.'),
      title: 'Atlas, structure and routes', css: ATLAS_CSS + A2_CSS, body: page(over, { zoomed: false, stats: `${n} notes, ${links} links, drawn as ${over.routes.length} routes.` }), js: '' }),
    AtlasStructureOpen: doc({ marker: card('Before: everything at once. Zoomed into Manifolds: subfolders open, the same routes split to their notes, and one note selected so its own links stand out.'),
      title: 'Atlas, zoomed into a folder', css: ATLAS_CSS + A2_CSS, body: page(zoom, { zoomed: true, stats: `Zoomed in: ${zoom.routes.length} routes. Select a note to see its own links.` }), js: '' }),
  };
}

// the view that fits every top-level folder into the space right of the lens panel
export function fit(L, openAt = 70) {
  const tops = L.root.children, x0 = Math.min(...tops.map((t) => t.x - t.r)), x1 = Math.max(...tops.map((t) => t.x + t.r)), y0 = Math.min(...tops.map((t) => t.y - t.r)), y1 = Math.max(...tops.map((t) => t.y + t.r));
  return { k: Math.min((1440 - 330 - 40) / (x1 - x0), (852 - 70) / (y1 - y0)), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, sx: 330 + (1440 - 330 - 20) / 2, sy: 852 / 2 + 6, openAt };
}
export const BASE_SETTINGS = SETTINGS;
