// The Atlas's terrain (T57): a height field over each top-level folder,
// contoured once in layout units and drawn by transforming the paths, never
// worked out per frame. Height is a note's lens value (understanding 0 to 3)
// near it, normalised so that a crowd of notes gives the crowd's mean level,
// however many notes it holds; unreached notes count as zero. The field is a
// pure function of positions and values: no randomness, so it is cached by
// them, and when one note's value changes only its folder is baked again.
//
// Runs in the layout worker (layout-worker.js), or here when there is none.

import { contours } from "d3";
import { stamp, clampToDisc, THR } from "./contours.js";

// Contours: the frontier (where reached ground meets the fog), then two steps
// of understanding, spaced so lines do not crowd (four were too many).
export const LEVELS = [0.4, 1.3, 2.3];
const CELLS = 112; // across a folder; cost follows the grid, not the notes

/**
 * One top-level folder's terrain.
 * @param {{ key: string, cx: number, cy: number, r: number, pts: number[], mask?: any }} f
 *   pts holds [x, y, value, width] per note, in layout units. mask: with
 *   contour folders, the folder's field (contours.js), so the terrain falls
 *   to nothing on its outline and the two families of contours never cross.
 * @returns {{ key: string, levels: number[][][][][], front: number[][] }}
 *   levels: a MultiPolygon's coordinates per contour, in layout units;
 *   front: the frontier's rings as [x, y, nx, ny, ...], (nx, ny) pointing downhill, towards the fog.
 */
export function bake(f) {
  const half = f.r * 1.05; // an outline stays within the circle (contours.js, discAt)
  const n = CELLS, cell = (2 * half) / n, x0 = f.cx - half, y0 = f.cy - half;
  const num = new Float64Array(n * n), den = new Float64Array(n * n);
  // Stamp each note: a Gaussian as wide as its own spacing, cut off at three widths.
  for (let p = 0; p < f.pts.length; p += 4) {
    const px = f.pts[p], py = f.pts[p + 1], v = f.pts[p + 2], s = f.pts[p + 3];
    const reach = 3 * s, two = 2 * s * s;
    const i0 = Math.max(0, Math.floor((px - reach - x0) / cell)), i1 = Math.min(n - 1, Math.ceil((px + reach - x0) / cell));
    const j0 = Math.max(0, Math.floor((py - reach - y0) / cell)), j1 = Math.min(n - 1, Math.ceil((py + reach - y0) / cell));
    for (let j = j0; j <= j1; j++) {
      const dy = y0 + (j + 0.5) * cell - py;
      for (let i = i0; i <= i1; i++) {
        const dx = x0 + (i + 0.5) * cell - px, k = Math.exp(-(dx * dx + dy * dy) / two);
        num[j * n + i] += v * k; den[j * n + i] += k;
      }
    }
  }
  const vals = new Float64Array(n * n);
  for (let i = 0; i < vals.length; i++) vals[i] = num[i] / Math.pow(1 + den[i] ** 4, 0.25);
  if (f.mask) {
    // 0 on and outside the outline, rising to 1 a little way inside.
    const inside = new Float64Array(n * n);
    stamp(f.mask, inside, x0 + cell / 2, y0 + cell / 2, cell, n, n);
    clampToDisc(f.mask, inside, x0 + cell / 2, y0 + cell / 2, cell, n, n);
    for (let i = 0; i < vals.length; i++) {
      // A gentle ramp, so the contours that must turn inside the outline do
      // not all bunch up against it.
      const t = Math.max(0, Math.min(1, (inside[i] - THR) / 1.2));
      vals[i] *= t * t * (3 - 2 * t);
    }
  }
  const gen = contours().size([n, n]);
  const toLayout = (rings) => rings.map((poly) => poly.map((ring) => ring.map(([x, y]) => [round(x0 + x * cell), round(y0 + y * cell)])));
  // Drop islands too small to read (one note's own ring in a crowd).
  const minArea = (0.05 * f.r) ** 2 / (cell * cell);
  const area = (ring) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]); return Math.abs(a / 2); };
  const shapes = LEVELS.map((t) => { const s = gen.contour(vals, t); s.coordinates = s.coordinates.filter((poly) => area(poly[0]) >= minArea); return s; });
  // Which way is downhill at a point of the frontier, from the grid's slope there.
  const at = (i, j) => vals[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))];
  const front = [];
  for (const poly of shapes[0].coordinates) for (const ring of poly) {
    const out = [];
    for (const [gx, gy] of ring) {
      const i = Math.round(gx - 0.5), j = Math.round(gy - 0.5);
      const sx = at(i + 1, j) - at(i - 1, j), sy = at(i, j + 1) - at(i, j - 1), l = Math.hypot(sx, sy) || 1;
      out.push(round(x0 + gx * cell), round(y0 + gy * cell), round(-sx / l), round(-sy / l));
    }
    front.push(out);
  }
  return { key: f.key, levels: shapes.map((s) => toLayout(s.coordinates)), front };
}

const round = (v) => Math.round(v * 100) / 100;

/** How wide a note's hill is: the typical spacing in its folder (the median
 *  distance from each child to its nearest sibling), so hills in a crowd
 *  merge into one plateau instead of each note growing its own rings; and
 *  nested folders still get finer terrain. */
const spacing = new WeakMap();
export function widthOf(n) {
  const p = n.parent;
  let s = spacing.get(p);
  if (s === undefined || s.at !== p.r) {
    const kids = p.children, nn = [];
    for (const a of kids) { let d = Infinity; for (const b of kids) if (a !== b) d = Math.min(d, Math.hypot(a.x - b.x, a.y - b.y)); if (Number.isFinite(d)) nn.push(d); }
    nn.sort((x, y) => x - y);
    s = { at: p.r, d: nn.length ? nn[nn.length >> 1] : p.r * 0.5 };
    spacing.set(p, s);
  }
  return Math.max(4, s.d * 1.0);
}
