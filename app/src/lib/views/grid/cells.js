// The grid Atlas's cells (T62): what the router and the drawing know about a
// layout (grid/nested.js describes one), cell by cell.
//
// Height is nesting: 0 between folders, 1 inside a folder, 2 inside a
// subfolder. The only contours are folder walls.

export const FREE = 0, NOTE = 1;
// Clearance: the cells a route keeps clear of a note or a folder's wall when it passes one. Notes and
// folders stand 6 cells apart (grid/nested.js), so each keeps 2 and a third of the gap is left to run in.
export const KEEP = 2;

export function buildCells(layout) {
  const { W, H, items } = layout;
  const elev = new Int8Array(W * H); // nesting depth
  const blocked = new Uint8Array(W * H); // NOTE: nothing is routed through a note
  const owner = new Int32Array(W * H).fill(-1); // the deepest folder holding the cell
  const noteAt = new Int32Array(W * H).fill(-1);
  const order = items.map((_, i) => i).filter((i) => items[i].kind === "folder").sort((a, b) => items[a].depth - items[b].depth || a - b);
  for (const i of order) {
    const f = items[i];
    for (let y = f.gy; y < f.gy + f.h; y++) for (let x = f.gx; x < f.gx + f.w; x++) { elev[y * W + x] = f.depth; owner[y * W + x] = i; }
  }
  items.forEach((n, i) => {
    if (n.kind !== "note") return;
    for (let y = n.gy; y < n.gy + n.h; y++) for (let x = n.gx; x < n.gx + n.w; x++) { blocked[y * W + x] = NOTE; noteAt[y * W + x] = i; }
  });
  // Close: the free cells within KEEP of a note, or of a folder's wall on either side of it. A route may
  // cross them (it must, to reach a note or go through a wall) but pays for each (grid/router.js).
  const close = new Uint8Array(W * H);
  const band = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) close[y * W + x] = 1; };
  for (const n of items) {
    if (n.kind === "note") { band(n.gx - KEEP, n.gy - KEEP, n.gx + n.w + KEEP, n.gy + n.h + KEEP); continue; }
    band(n.gx - KEEP, n.gy - KEEP, n.gx + n.w + KEEP, n.gy + KEEP); band(n.gx - KEEP, n.gy + n.h - KEEP, n.gx + n.w + KEEP, n.gy + n.h + KEEP);
    band(n.gx - KEEP, n.gy - KEEP, n.gx + KEEP, n.gy + n.h + KEEP); band(n.gx + n.w - KEEP, n.gy - KEEP, n.gx + n.w + KEEP, n.gy + n.h + KEEP);
  }
  return { W, H, elev, blocked, owner, noteAt, close };
}

/** An item's folders from the inside out, itself first if it is a folder. */
export function foldersOf(items, i) {
  const out = items[i].kind === "folder" ? [i] : [];
  for (let p = items[i].parent; p >= 0; p = items[p].parent) out.push(p);
  return out;
}

/**
 * Reached ground: every folder cell within one cell of a reached note.
 * Understanding is tone, not height.
 * @param reached (item index) => boolean
 */
export function reachedCells(layout, cells, reached) {
  const { W, H, elev, blocked } = cells, out = new Uint8Array(W * H);
  layout.items.forEach((n, i) => {
    if (n.kind !== "note" || !reached(i)) return;
    for (let y = Math.max(0, n.gy - 1); y <= Math.min(H - 1, n.gy + n.h); y++) {
      for (let x = Math.max(0, n.gx - 1); x <= Math.min(W - 1, n.gx + n.w); x++) if (elev[y * W + x]) out[y * W + x] = 1;
    }
  });
  return out;
}

/** A set of cells as two paths in cell units: its area (runs along each row) and its edge. */
export function maskPaths(mask, W, H) {
  let area = "", edge = "";
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      let x1 = x;
      while (x1 + 1 < W && mask[y * W + x1 + 1]) x1++;
      area += `M${x} ${y}h${x1 - x + 1}v1h${-(x1 - x + 1)}z`;
      x = x1;
    }
    // Edges: the top of a run of cells with nothing above them, and likewise below.
    for (const [dy, at] of [[-1, y], [1, y + 1]]) {
      for (let x = 0; x < W; x++) {
        if (!on(x, y) || on(x, y + dy)) continue;
        let x1 = x;
        while (on(x1 + 1, y) && !on(x1 + 1, y + dy)) x1++;
        edge += `M${x} ${at}h${x1 - x + 1}`;
        x = x1;
      }
    }
  }
  for (let x = 0; x < W; x++) {
    for (const [dx, at] of [[-1, x], [1, x + 1]]) {
      for (let y = 0; y < H; y++) {
        if (!on(x, y) || on(x + dx, y)) continue;
        let y1 = y;
        while (on(x, y1 + 1) && !on(x + dx, y1 + 1)) y1++;
        edge += `M${at} ${y}v${y1 - y + 1}`;
        y = y1;
      }
    }
  }
  return { area, edge };
}
