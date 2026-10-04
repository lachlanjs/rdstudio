// The Atlas drawing, shared by direction B and by A+B. Output is an inline SVG string plus the list of labelled notes.
// PLACEHOLDER CONTENT: folder and note names are invented around the DMFT material in 03-real-content.md; the three
// study-path notes, the two review notes and Clark & Abbott are the only names that come from the real content.
import { contours } from 'd3-contour';
import { geoPath, geoIdentity } from 'd3-geo';
import { line, curveBasisClosed, curveCatmullRom } from 'd3-shape';

export const W = 1440, H = 852, STEP = 6;

function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// understanding: 0 not reached, 1 opened, 2 worked through, 3 understood
const DEF_FOLDERS = [
  { id: 'mfd', name: 'Mean-field dynamics', c: [1000, 215], r: 135, p: 0.7, notes: [
    ['Dynamical mean-field theory', 0, [958, 205]], ['Rate networks', 0], ['Path-integral formulation', 0], ['Effective single-neuron process', 0],
    ['Response function', 0], ['Noise autocorrelation', 0], ['Self-averaging', 0], ['Large-N limit', 0] ] },
  { id: 'chaos', name: 'Chaos in random networks', c: [1275, 345], r: 95, p: 2.1, notes: [
    ['Lyapunov exponent', 0], ['Transition to chaos', 0], ['Autocorrelation decay', 0], ['Edge of chaos', 0], ['Timescales', 0] ] },
  { id: 'cav', name: 'Cavity method', c: [808, 452], r: 125, p: 1.3, notes: [
    ['The cavity method', 2, [778, 492]], ['Self-consistent autocorrelation', 1, [838, 408]], ['Cavity field', 0], ['Order parameters', 0],
    ['Dynamic cavity', 0], ['Linear response', 0], ['Fixed points', 0] ] },
  { id: 'rmt', name: 'Random matrices', c: [478, 300], r: 92, p: 3.3, notes: [
    ['Circular law', 0], ['Eigenvalue spectrum', 0], ['Gaussian ensembles', 0], ['Spectral radius', 0], ['Elliptic law', 0] ] },
  { id: 'prob', name: 'Probability', c: [560, 600], r: 150, p: 0.2, notes: [
    ['Variance scaling', 1, [676, 512]], ['Gaussian fields', 3, [545, 565]], ['Central limit theorem', 3, [520, 665]], ['Gaussian integrals', 3, [640, 622]], ['Independence', 3],
    ['Moments and cumulants', 2], ['Law of large numbers', 1], ['Characteristic functions', 0], ['Large deviations', 0] ] },
  { id: 'papers', name: 'Papers', c: [1010, 700], r: 80, p: 1.7, notes: [
    ['Clark and Abbott, 2023', 0], ['Sompolinsky, Crisanti and Sommers, 1988', 0], ['Rajan and Abbott, 2006', 0] ] },
];

const DEF_STRUGGLING = new Set(['Variance scaling']);
const DEF_PATH = ['Variance scaling', 'The cavity method', 'Self-consistent autocorrelation'];
const DEF_LINKS = [
  ['Variance scaling', 'The cavity method'], ['Gaussian fields', 'The cavity method'], ['Central limit theorem', 'Variance scaling'],
  ['Gaussian integrals', 'Gaussian fields'], ['Independence', 'Central limit theorem'], ['Moments and cumulants', 'Central limit theorem'],
  ['Law of large numbers', 'Central limit theorem'], ['The cavity method', 'Self-consistent autocorrelation'],
  ['The cavity method', 'Cavity field'], ['Self-consistent autocorrelation', 'Order parameters'], ['Self-consistent autocorrelation', 'Dynamical mean-field theory'],
  ['The cavity method', 'Dynamical mean-field theory'], ['Dynamical mean-field theory', 'Autocorrelation decay'], ['Dynamical mean-field theory', 'Rate networks'],
  ['Dynamical mean-field theory', 'Path-integral formulation'], ['Dynamical mean-field theory', 'Effective single-neuron process'],
  ['Circular law', 'Eigenvalue spectrum'], ['Eigenvalue spectrum', 'Spectral radius'], ['Spectral radius', 'Transition to chaos'], ['Gaussian ensembles', 'Circular law'],
  ['Transition to chaos', 'Lyapunov exponent'], ['Lyapunov exponent', 'Edge of chaos'], ['Gaussian fields', 'Characteristic functions'],
  ['Clark and Abbott, 2023', 'Dynamical mean-field theory'], ['Sompolinsky, Crisanti and Sommers, 1988', 'Transition to chaos'], ['Dynamic cavity', 'Linear response'],
  ['Large deviations', 'Law of large numbers'], ['Response function', 'Linear response'], ['Noise autocorrelation', 'Autocorrelation decay'],
];
const DEF_LABELLED = new Set(['Variance scaling', 'The cavity method', 'Self-consistent autocorrelation', 'Gaussian fields', 'Central limit theorem', 'Gaussian integrals',
  'Dynamical mean-field theory', 'Clark and Abbott, 2023', 'Circular law', 'Transition to chaos']);

const refOf = (x, y) => 'ABCDEFGHIJKL'[Math.min(11, Math.max(0, Math.floor(x / 120)))] + (Math.min(7, Math.max(1, Math.floor(y / 122) + 1)));

export function buildAtlas(data = {}) {
  const { FOLDERS = DEF_FOLDERS, STRUGGLING = DEF_STRUGGLING, PATH = DEF_PATH, LINKS = DEF_LINKS, LABELLED = DEF_LABELLED, seed = 7, sig = 58 } = data;
  const rand = rng(seed);
  const blob = (f) => {
    const pts = []; const [cx, cy] = f.c;
    for (let k = 0; k < 36; k++) { const th = (k / 36) * Math.PI * 2;
      const r = f.r * (1 + 0.07 * Math.sin(3 * th + f.p) + 0.045 * Math.sin(5 * th + 2 * f.p) + 0.03 * Math.sin(2 * th + 3 * f.p));
      pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]); }
    return pts;
  };
  const inside = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

  const notes = []; const byName = new Map();
  for (const f of FOLDERS) {
    f.poly = blob(f);
    for (const [name, level, pos] of f.notes) {
      let x, y;
      if (pos) [x, y] = pos;
      else for (let tries = 0; tries < 400; tries++) {
        const th = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * f.r * 0.78;
        x = f.c[0] + rr * Math.cos(th); y = f.c[1] + rr * Math.sin(th);
        if (inside(f.poly, x, y) && notes.every((n) => Math.hypot(n.x - x, n.y - y) > 44)) break;
      }
      const n = { name, level, x, y, folder: f.id, ref: refOf(x, y), struggling: STRUGGLING.has(name) };
      notes.push(n); byName.set(name, n);
    }
  }

  // height field of understanding
  const cols = Math.ceil(W / STEP), rows = Math.ceil(H / STEP);
  const field = (x, y) => { let v = 0; for (const n of notes) if (n.level) { const dx = x - n.x, dy = y - n.y; v += n.level * Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig)); } return v; };
  const vals = new Float64Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) vals[j * cols + i] = field(i * STEP, j * STEP);
  const gen = contours().size([cols, rows]);
  const toPath = geoPath(geoIdentity().scale(STEP));
  const FRONT = 0.4;
  const levels = [1.0, 1.9, 2.8];
  const front = gen.contour(vals, FRONT);
  const frontD = toPath(front);
  const lvlD = levels.map((t) => toPath(gen.contour(vals, t)));

  // hachures along the frontier, pointing out of the reached area
  const hach = [];
  const grad = (x, y) => { const e = 1.5; return [(field(x + e, y) - field(x - e, y)) / (2 * e), (field(x, y + e) - field(x, y - e)) / (2 * e)]; };
  let tick = 0;
  for (const poly of front.coordinates) for (const ring of poly) {
    let acc = 0;
    for (let k = 1; k < ring.length; k++) {
      const [x0, y0] = [ring[k - 1][0] * STEP, ring[k - 1][1] * STEP], [x1, y1] = [ring[k][0] * STEP, ring[k][1] * STEP];
      const seg = Math.hypot(x1 - x0, y1 - y0); if (!seg) continue;
      let d = 0;
      while (acc + (seg - d) >= 11) {
        d += 11 - acc; acc = 0;
        const x = x0 + (x1 - x0) * (d / seg), y = y0 + (y1 - y0) * (d / seg);
        if (x < 4 || y < 4 || x > W - 4 || y > H - 4) continue;
        const g = grad(x, y), gl = Math.hypot(g[0], g[1]) || 1, nx = -g[0] / gl, ny = -g[1] / gl, len = tick++ % 2 ? 4 : 8;
        hach.push(`M${x.toFixed(1)} ${y.toFixed(1)}l${(nx * len).toFixed(1)} ${(ny * len).toFixed(1)}`);
      }
      acc += seg - d;
    }
  }

  const fogD = `M0 0H${W}V${H}H0Z` + frontD;
  const ln = line().curve(curveBasisClosed);
  const landD = FOLDERS.map((f) => ln(f.poly) + 'Z').join('');
  const routeD = LINKS.map(([a, b]) => {
    const A = byName.get(a), B = byName.get(b); if (!A || !B) throw new Error('link ' + a + ' / ' + b);
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y, k = 0.12;
    return `M${A.x.toFixed(1)} ${A.y.toFixed(1)}Q${(mx - dy * k).toFixed(1)} ${(my + dx * k).toFixed(1)} ${B.x.toFixed(1)} ${B.y.toFixed(1)}`;
  }).join('');
  const pathPts = PATH.map((n) => byName.get(n));
  const pathD = pathPts.length ? line().curve(curveCatmullRom.alpha(0.5))(pathPts.map((n) => [n.x, n.y])) : '';

  return { notes, byName, FOLDERS, frontD, lvlD, hachD: hach.join(''), fogD, landD, routeD, pathD, pathPts, LABELLED, W, H };
}

// Marker shapes: understanding is neutral, state is pen-coloured with a line style.
function markerSvg(n, neutral) {
  const { x, y } = n;
  if (n.struggling) return `<g class="a-note struggling"><circle cx="${x}" cy="${y}" r="9" class="ring-red"/><circle cx="${x}" cy="${y}" r="4.5" class="m-open"/></g>`;
  if (n.level === 3 && neutral) return `<g class="a-note l3"><circle cx="${x}" cy="${y}" r="9" class="ring-plain"/><circle cx="${x}" cy="${y}" r="4.5" class="m-fill"/></g>`;
  if (n.level === 3) return `<g class="a-note l3"><circle cx="${x}" cy="${y}" r="9.5" class="ring-green-out"/><circle cx="${x}" cy="${y}" r="7" class="ring-green-in"/><circle cx="${x}" cy="${y}" r="3.5" class="m-fill"/></g>`;
  if (n.level === 2) return `<circle cx="${x}" cy="${y}" r="5" class="a-note m-fill"/>`;
  if (n.level === 1) return `<circle cx="${x}" cy="${y}" r="4.5" class="a-note m-open"/>`;
  return `<circle cx="${x}" cy="${y}" r="3.2" class="a-note m-none"/>`;
}

export function atlasSvg(a, { graticule = true, labelRefs = true, stage = 'full', labelLeft = new Set(), labelBelow = new Set(['Variance scaling']), neutral = false, aria = 'Atlas of the knowledge base: six regions, the understanding lens on, a study path of three notes', labelAbove = new Set() } = {}) {
  const { notes, FOLDERS: F, frontD, lvlD, hachD, fogD, landD, routeD, pathD, pathPts, LABELLED: L } = a;
  const grat = [];
  if (graticule) {
    for (let i = 1; i < 12; i++) grat.push(`M${i * 120} 0V${H}`);
    for (let j = 1; j < 7; j++) grat.push(`M0 ${j * 122}H${W}`);
  }
  const ticks = [];
  for (let i = 0; i <= 12; i++) { ticks.push(`M${i * 120} 0v8M${i * 120} ${H}v-8`); }
  for (let j = 0; j <= 7; j++) { ticks.push(`M0 ${j * 122}h8M${W} ${j * 122}h-8`); }
  const edgeLabels = [];
  for (let i = 0; i < 12; i++) edgeLabels.push(`<text x="${i * 120 + 60}" y="22" class="a-edge" text-anchor="middle">${'ABCDEFGHIJKL'[i]}</text>`);
  for (let j = 0; j < 7; j++) edgeLabels.push(`<text x="${W - 14}" y="${j * 122 + 65}" class="a-edge" text-anchor="middle">${j + 1}</text>`);

  const folderLabels = F.map((f) => {
    const top = f.c[1] - f.r - 10;
    return `<text x="${f.c[0]}" y="${top}" class="a-folder" text-anchor="middle">${f.name} <tspan class="a-count">${f.notes.length}</tspan></text>`;
  }).join('');

  const labels = notes.filter((n) => L.has(n.name)).map((n) => {
    const right = n.x < 1180 && !labelLeft.has(n.name);
    if (labelAbove.has(n.name)) return `<text x="${n.x}" y="${n.y - 16}" class="a-label" text-anchor="middle">${labelRefs ? `<tspan class="a-ref">${n.ref}</tspan> ` : ''}${n.name}</text>`;
    if (labelBelow.has(n.name)) return `<text x="${n.x}" y="${n.y + 30}" class="a-label" text-anchor="middle">${labelRefs ? `<tspan class="a-ref">${n.ref}</tspan> ` : ''}${n.name}</text>`;
    const lx = right ? n.x + 14 : n.x - 14;
    const cls = n.level === 0 ? 'a-label dim' : 'a-label';
    const ref = labelRefs ? `<tspan class="a-ref">${n.ref}</tspan> ` : '';
    return `<text x="${lx}" y="${n.y + 4}" class="${cls}" text-anchor="${right ? 'start' : 'end'}">${ref}${n.name}</text>`;
  }).join('');

  const stops = pathPts.map((n, i) => `<g class="a-stop"><circle cx="${n.x}" cy="${n.y}" r="15" class="stop-ring"/><text x="${n.x}" y="${n.y - 22}" text-anchor="middle" class="a-stopno">${i + 1}</text></g>`).join('');

  return `<svg class="atlas" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">
  <defs><clipPath id="landclip"><path d="${landD}"/></clipPath><pattern id="fogdots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.8" class="fogdot"/></pattern></defs>
  <rect width="${W}" height="${H}" class="a-sea"/>
  ${graticule ? `<path d="${grat.join('')}" class="a-grat"/>` : ''}
  <path d="${landD}" class="a-land"/>
  <path d="${lvlD[0]}" class="a-tint t1"/><path d="${lvlD[1]}" class="a-tint t2"/><path d="${lvlD[2]}" class="a-tint t3"/>
  <path d="${routeD}" class="a-route"/>
  <path d="${fogD}" fill-rule="evenodd" class="a-fog"/>
  <path d="${fogD}" fill-rule="evenodd" class="a-fogdots" clip-path="url(#landclip)"/>
  <path d="${lvlD[0]}" class="a-contour c1"/><path d="${lvlD[1]}" class="a-contour c2"/><path d="${lvlD[2]}" class="a-contour c3"/>
  <path d="${frontD}" class="a-front"/>
  <path d="${hachD}" class="a-hach"/>
  <path d="${landD}" class="a-outline"/>
  ${stage === 'full' && pathD ? `<path d="${pathD}" class="a-path-halo"/><path d="${pathD}" class="a-path"/>` : ''}
  ${notes.map((n) => markerSvg(n, neutral)).join('')}
  ${stage === 'full' ? stops : ''}
  ${folderLabels}
  ${labels}
  ${graticule ? `<path d="${ticks.join('')}" class="a-tick"/>${edgeLabels.join('')}` : ''}
</svg>`;
}
