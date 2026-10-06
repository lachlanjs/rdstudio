// The grid Atlas's placeholder layout (T62): positions from the smooth layout
// (layout.js: packing, forces, later study further north), snapped to cells.
// Ported from the sketch's `build` (design/tools/grid.mjs). It goes when the
// layout from each folder's DAG lands (T64); it is the baseline that one is
// measured against.
//
// A layout, whoever makes it, is plain data:
//   { W, H,                      the grid, in cells
//     items: [{ id, ref, kind,   "note" or "folder"; the root is not an item;
//                                a parent comes before its children
//               parent, depth,   the parent's index (-1 at the top), 1 at the top
//               gx, gy, w, h }], a block of cells; a folder's is its whole region
//     links: [{ a, b, s,         item indices (a links to b) and the rating
//               level,           the lowest folder holding both ends (-1: the root)
//               placed }] }      true when the layout arranged the items for this
//                                link; false when it is left to the router alone
// Nothing after the layout knows how the positions were chosen.

export const GAP_NOTES = 2, GAP_FOLDERS = 3; // clear cells between siblings
export const PAD = 2; // cells between a folder's wall and its contents
export const HEAD = 2; // a folder's title row, and the free row under it
const MARGIN = 3; // free cells around the whole map
const MIN_FOLDER = 10; // a folder is at least this wide, for its title
const TIGHT = 0.5;

/** A note's block: larger with many links, so they have more edge to leave from. */
export function noteSize(degree) {
  return [degree >= 6 ? 9 : 8, degree >= 9 ? 3 : 2];
}

/** How many requires- and uses-links touch each note. */
export function degrees(edges) {
  const deg = new Map();
  for (const [a, b, s] of edges) if (s >= 2) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
  return deg;
}

/**
 * @param root a d3 hierarchy of the map model, each node with x and y from the smooth layout
 * @param edges [from, to, strength] by note ref
 */
export function snapLayout(root, edges, { gapN = GAP_NOTES, gapF = GAP_FOLDERS } = {}) {
  const isDir = (n) => n.data.kind === "dir";
  const deg = degrees(edges);

  // Bottom up: size every block, and place each folder's children relative to it.
  const size = (n) => {
    if (!isDir(n)) { [n.w, n.h] = noteSize(deg.get(n.data.ref) || 0); return; }
    const kids = n.children || [];
    kids.forEach(size);
    if (!kids.length) { n.w = MIN_FOLDER; n.h = HEAD + 2 * PAD; return; }
    const gap = n.depth === 0 || kids.some(isDir) ? gapF : gapN;
    const clear = (P) => {
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const a = P[i], b = P[j];
        if (a.x < b.x + b.c.w + gap && b.x < a.x + a.c.w + gap && a.y < b.y + b.c.h + gap && b.y < a.y + a.c.h + gap) return false;
      }
      return true;
    };
    const at = (k) => kids.map((c) => ({ c, x: Math.round((c.x - n.x) * k - c.w / 2), y: Math.round((c.y - n.y) * k - c.h / 2) }));
    // Nudge apart whatever overlaps, along the axis that needs the smaller move.
    const relax = (P) => {
      for (let it = 0; it < 300; it++) {
        let moved = false;
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
          const a = P[i], b = P[j];
          const ox = (a.c.w + b.c.w) / 2 + gap - Math.abs(a.x + a.c.w / 2 - b.x - b.c.w / 2);
          const oy = (a.c.h + b.c.h) / 2 + gap - Math.abs(a.y + a.c.h / 2 - b.y - b.c.h / 2);
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          if (ox < oy) { const d = Math.ceil(ox), s = a.x + a.c.w / 2 <= b.x + b.c.w / 2 ? 1 : -1; a.x -= s * Math.floor(d / 2); b.x += s * Math.ceil(d / 2); }
          else { const d = Math.ceil(oy), s = a.y + a.c.h / 2 <= b.y + b.c.h / 2 ? 1 : -1; a.y -= s * Math.floor(d / 2); b.y += s * Math.ceil(d / 2); }
        }
        if (!moved) return true;
      }
      return false;
    };
    // The scale at which nothing touches with no nudging at all; then tighter
    // scales, nudged, keeping the tightest that settles. The smooth layout's
    // units are arbitrary, so the search starts where the spread is one cell
    // and stops where the children would fit side by side.
    const extent = Math.max(1e-9, ...kids.map((c) => Math.max(Math.abs(c.x - n.x), Math.abs(c.y - n.y))));
    const most = (4 * kids.reduce((t, c) => t + c.w + c.h + 2 * gap, 0)) / extent;
    let kc = 1 / extent;
    while (kc < most && !clear(at(kc))) kc *= 1.05;
    let P = at(kc);
    if (!clear(P)) relax(P); // children on top of each other: nudging is all there is
    else for (let k = kc * TIGHT; k < kc; k *= 1.06) { const Q = at(k); if (relax(Q) && clear(Q)) { P = Q; break; } }
    const x0 = Math.min(...P.map((p) => p.x)), y0 = Math.min(...P.map((p) => p.y));
    for (const p of P) { p.c.rx = p.x - x0; p.c.ry = p.y - y0; }
    const bw = Math.max(...P.map((p) => p.c.rx + p.c.w)), bh = Math.max(...P.map((p) => p.c.ry + p.c.h));
    if (n.depth === 0) { n.w = bw; n.h = bh; }
    else { n.w = Math.max(MIN_FOLDER, bw + 2 * PAD); n.h = bh + PAD + HEAD + PAD; } // side walls; title row, free row, then the contents; floor
  };
  const place = (n, x, y) => {
    n.gx = x; n.gy = y;
    for (const c of n.children || []) place(c, x + (n.depth === 0 ? 0 : PAD) + c.rx, y + (n.depth === 0 ? 0 : HEAD + PAD) + c.ry);
  };
  size(root);
  place(root, MARGIN, MARGIN);

  const items = [], index = new Map();
  root.each((n) => {
    if (!n.parent) return;
    index.set(n, items.length);
    items.push({ id: n.data.id, ref: n.data.ref, kind: isDir(n) ? "folder" : "note", parent: n.parent.parent ? index.get(n.parent) : -1, depth: n.depth, gx: n.gx, gy: n.gy, w: n.w, h: n.h });
  });
  const byRef = new Map();
  root.each((n) => { if (n.parent && !isDir(n)) byRef.set(n.data.ref, index.get(n)); });
  return { W: root.w + 2 * MARGIN, H: root.h + 2 * MARGIN, items, links: levelled(items, edges, byRef) };
}

/** The layout's links: each with the lowest folder that holds both its ends. */
export function levelled(items, edges, byRef) {
  const up = (i) => { const out = []; for (let p = items[i].parent; p >= 0; p = items[p].parent) out.push(p); return out; };
  const links = [];
  for (const [from, to, s] of edges) {
    const a = byRef.get(from), b = byRef.get(to);
    if (a === undefined || b === undefined || a === b) continue;
    const above = new Set(up(b));
    links.push({ a, b, s, level: up(a).find((p) => above.has(p)) ?? -1, placed: false });
  }
  return links;
}
