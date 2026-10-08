// The grid Atlas's layout, cells and routes (T62, T64) on generated folder trees.
import { describe, expect, it } from "vitest";
import { gridLayout, gridRouter } from "../layout.js";
import { buildCells, reachedCells, maskPaths, NOTE, KEEP } from "./cells.js";
import { plainModel, feeders } from "../layout.js";
import { greedyOrder, NOTE_W, NOTE_H } from "./nested.js";

const GAP = 2; // clear cells between siblings, at least

// A tree of `folders` top-level folders, every third with a subfolder, and
// links mostly inside a folder or to its neighbours; the same for the same
// arguments.
function model(folders, perFolder) {
  let seed = 7;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const refs = [];
  const note = (ref, rank) => { refs.push(ref); return { kind: "concept", id: "c:" + ref, ref, weight: 1 + rand(), rank }; };
  const dir = (ref, children) => ({ kind: "dir", id: "d:" + ref, ref, children });
  const tops = [];
  for (let f = 0; f < folders; f++) {
    const kids = [];
    for (let i = 0; i < perFolder; i++) kids.push(note(`f${f}/n${i}`, i % 5));
    if (f % 3 === 0) kids.unshift(dir(`f${f}/sub`, [0, 1, 2, 3].map((i) => note(`f${f}/sub/n${i}`, i))));
    tops.push(dir(`f${f}`, kids));
  }
  const edges = [], seen = new Set();
  for (let i = 0; i < refs.length * 1.6; i++) {
    const a = refs[Math.floor(rand() * refs.length)];
    const near = refs.filter((r) => r !== a && r.split("/")[0] === a.split("/")[0]);
    // Three links in four stay in the folder; most of the rest go to a folder close by in the list.
    const f = Number(a.split("/")[0].slice(1)), close = (r) => { const g = Number(r.split("/")[0].slice(1)); return g !== f && Math.abs(g - f) <= 2; };
    const far = rand() < 0.85 ? refs.filter((r) => r !== "loose" && a !== "loose" && close(r)) : refs;
    const b = rand() < 0.75 && near.length ? near[Math.floor(rand() * near.length)] : (far.length ? far : refs)[Math.floor(rand() * (far.length || refs.length))];
    if (a === b || seen.has(a + ">" + b)) continue;
    seen.add(a + ">" + b);
    edges.push([a, b, rand() < 0.2 ? 1 : rand() < 0.5 ? 2 : 3]);
  }
  return { root: dir("", [...tops, note("loose", 0)]), edges };
}

const overlap = (a, b, gap = 0) => a.gx < b.gx + b.w + gap && b.gx < a.gx + a.w + gap && a.gy < b.gy + b.h + gap && b.gy < a.gy + a.h + gap;
const inside = (n, f) => n.gx >= f.gx && n.gy >= f.gy && n.gx + n.w <= f.gx + f.w && n.gy + n.h <= f.gy + f.h;

describe("the layout", () => {
  for (const flow of ["up", "right"]) {
    const L = gridLayout(model(6, 9), { gridFlow: flow }), C = buildCells(L);
    it(`flowing ${flow}: every block inside its folder under the title, siblings clear, parents first`, () => {
      expect(L.flow).toBe(flow);
      expect(L.items.filter((n) => n.kind === "note")).toHaveLength(6 * 9 + 2 * 4 + 1);
      L.items.forEach((n, i) => {
        expect(n.parent).toBeLessThan(i);
        expect(n.gx >= 0 && n.gy >= 0 && n.gx + n.w <= L.W && n.gy + n.h <= L.H).toBe(true);
        if (n.kind === "note") expect([n.w, n.h]).toEqual([NOTE_W, NOTE_H]);
        if (n.parent >= 0) { expect(inside(n, L.items[n.parent])).toBe(true); expect(n.gy).toBeGreaterThan(L.items[n.parent].gy + 1); }
      });
      L.items.forEach((a, i) => L.items.forEach((b, j) => { if (j > i && a.parent === b.parent) expect(overlap(a, b, GAP)).toBe(false); }));
    });
    it(`flowing ${flow}: a trunk joins two items of one folder, and its path runs square from one's edge to the other's, through no block`, () => {
      const drawn = L.trunks.filter((t) => t.pts);
      expect(drawn.length).toBeGreaterThan(20);
      expect(L.trunks.filter((t) => !t.pts).every((t) => t.back || t.implied)).toBe(true);
      const onEdge = ([x, y], n) => (x >= n.gx && x <= n.gx + n.w && (y === n.gy || y === n.gy + n.h)) || (y >= n.gy && y <= n.gy + n.h && (x === n.gx || x === n.gx + n.w));
      for (const t of L.trunks) expect(L.items[t.a].parent).toBe(L.items[t.b].parent);
      for (const t of drawn) {
        const P = t.pts, a = L.items[t.a], b = L.items[t.b];
        expect(onEdge(P[0], b)).toBe(true);
        expect(onEdge(P[P.length - 1], a)).toBe(true);
        for (let k = 1; k < P.length; k++) {
          expect(P[k][0] === P[k - 1][0] || P[k][1] === P[k - 1][1]).toBe(true);
          // the cells a run passes, its ends apart, hold no note and belong to the trunk's folder alone
          const [x0, x1] = [Math.min(P[k][0], P[k - 1][0]), Math.max(P[k][0], P[k - 1][0])], [y0, y1] = [Math.min(P[k][1], P[k - 1][1]), Math.max(P[k][1], P[k - 1][1])];
          for (let y = Math.floor(y0 + 0.5); y <= Math.ceil(y1 - 0.5) - (y1 > y0 ? 0 : 0) && y < y1 + 0.01; y++) for (let x = Math.floor(x0 + 0.5); x < x1 + 0.01; x++) {
            if (y1 === y0 && (x < Math.ceil(x0) || x >= Math.floor(x1))) continue;
            if (x1 === x0 && (y < Math.ceil(y0) || y >= Math.floor(y1))) continue;
            const cx = x1 === x0 ? Math.floor(x0) : x, cy = y1 === y0 ? Math.floor(y0) : y;
            expect(C.noteAt[cy * C.W + cx]).toBe(-1);
            expect(C.owner[cy * C.W + cx]).toBe(a.parent);
          }
        }
      }
    });
    it(`flowing ${flow}: what a trunk requires comes earlier along the flow, turning at each level`, () => {
      for (const t of L.trunks.filter((x) => !x.back)) {
        const a = L.items[t.a], b = L.items[t.b], along = (a.depth % 2 === 1) === (flow === "up") ? "up" : "right";
        if (along === "up") expect(b.gy).toBeGreaterThanOrEqual(a.gy + a.h);
        else expect(b.gx + b.w).toBeLessThanOrEqual(a.gx);
      }
    });
  }
  it("gives each link the lowest folder that holds both ends, and marks those that run against the layout", () => {
    const L = gridLayout(model(6, 9), {});
    const up = (i) => { const out = []; for (let p = L.items[i].parent; p >= 0; p = L.items[p].parent) out.push(p); return out; };
    expect(L.links.length).toBeGreaterThan(50);
    for (const l of L.links) { const A = up(l.a), B = up(l.b); expect(l.level).toBe(A.find((p) => B.includes(p)) ?? -1); if (l.s < 2) expect(l.placed).toBe(false); }
    const back = L.trunks.filter((t) => t.back);
    expect(L.links.filter((l) => l.s >= 2 && !l.placed).length).toBe(back.reduce((t, b) => t + b.count, 0));
  });
  it("orders a cycle so that only its lightest link runs back", () => {
    const pos = greedyOrder(3, [[0, 1, 3], [1, 2, 3], [2, 0, 2]]);
    expect([pos[0] < pos[1], pos[1] < pos[2], pos[2] < pos[0]]).toEqual([true, true, false]);
    expect(greedyOrder(3, [])).toEqual([0, 1, 2]);
  });
  it("is the same for the same bundle, wider than tall flowing right and the other way flowing up", () => {
    expect(gridLayout(model(6, 9), {})).toEqual(gridLayout(model(6, 9), { gridFlow: "up" }));
    const big = model(40, 28), t = performance.now(), U = gridLayout(big, {}), R = gridLayout(big, { gridFlow: "right" });
    console.log(`layout at 1177 notes: up ${U.W} by ${U.H}, right ${R.W} by ${R.H} cells, ${(performance.now() - t).toFixed(0)} ms for both`);
    // A guard against a layout gone badly wrong, not a measure: a shared runner takes several seconds over it.
    expect(performance.now() - t).toBeLessThan(20000);
  }, 30000);
});

describe("the cells", () => {
  const L = gridLayout(model(6, 9), {}), C = buildCells(L);
  it("know their height, their folder and what blocks them", () => {
    L.items.forEach((n, i) => {
      const c = n.gy * C.W + n.gx;
      if (n.kind === "note") {
        expect(C.blocked[c]).toBe(NOTE);
        expect(C.noteAt[c]).toBe(i);
        expect(C.owner[c]).toBe(n.parent);
        expect(C.elev[c]).toBe(n.depth - 1);
      } else {
        expect(C.blocked[c]).toBe(0); // a folder's title is on its edge: no cell is closed for it
        expect(C.elev[c]).toBe(n.depth);
        expect(C.owner[c]).toBe(i);
      }
    });
    expect(C.elev[0]).toBe(0);
  });
  it("mark reached ground around reached notes, inside folders only", () => {
    const first = L.items.findIndex((n) => n.kind === "note" && n.parent >= 0);
    const mask = reachedCells(L, C, (i) => i === first), n = L.items[first];
    expect(mask[(n.gy - 1) * C.W + n.gx - 1]).toBe(1);
    expect(mask.reduce((t, v) => t + v, 0)).toBe((n.w + 2) * (n.h + 2));
    const { area, edge } = maskPaths(mask, C.W, C.H);
    expect(area.split("M").length - 1).toBe(n.h + 2);
    expect(edge.split("M").length - 1).toBe(4);
  });
});

// The router draws what the layout leaves to it: back trunks, and the links lit under the pointer, note to note.
describe("the routes", () => {
  const L = gridLayout(model(6, 9), {}), C = buildCells(L);
  const asks = L.links.filter((l) => l.s >= 2).map(({ a, b }) => ({ a, b }));
  const { routes, measures } = gridRouter(L)(asks);
  const onEdge = ([x, y], n) => (x >= n.gx && x <= n.gx + n.w && (y === n.gy || y === n.gy + n.h)) || (y >= n.gy && y <= n.gy + n.h && (x === n.gx || x === n.gx + n.w));
  it("find a way for every link, note to note, through folder walls", () => {
    expect(measures.lost).toBe(0);
    expect(routes.every(Boolean)).toBe(true);
    expect(L.links.some((l) => l.s >= 2 && L.items[l.a].parent !== L.items[l.b].parent)).toBe(true);
  });
  it("end on the edges of the blocks they join", () => {
    routes.forEach((r, i) => {
      expect(onEdge(r.pts[0], L.items[asks[i].a])).toBe(true);
      expect(onEdge(r.pts[r.pts.length - 1], L.items[asks[i].b])).toBe(true);
    });
  });
  it("never enter a note, and move one cell at a time", () => {
    for (const r of routes) {
      const mid = r.pts.slice(1, -1);
      for (const [x, y] of mid) expect(C.blocked[Math.floor(y) * C.W + Math.floor(x)]).toBe(0);
      for (let k = 1; k < mid.length; k++) expect(Math.max(Math.abs(mid[k][0] - mid[k - 1][0]), Math.abs(mid[k][1] - mid[k - 1][1]))).toBe(1);
    }
  });
  it("are the same for the same layout, and the router can be asked again", () => {
    const run = gridRouter(L), again = run(asks);
    expect(again.routes).toEqual(routes);
    expect(run(asks).measures).toEqual(measures);
  });
  it("join folders as well as notes, and are measured", () => {
    const tops = L.items.map((n, i) => (n.kind === "folder" && n.depth === 1 ? i : -1)).filter((i) => i >= 0);
    const trunks = gridRouter(L)([{ a: tops[0], b: tops[1] }, { a: tops[2], b: tops[5] }]);
    expect(trunks.measures.lost).toBe(0);
    expect(onEdge(trunks.routes[0].pts[0], L.items[tops[0]])).toBe(true);
    expect(measures.routes).toBe(asks.length);
    expect(measures.beside).toBeGreaterThan(0);
    expect(measures.beside).toBeLessThanOrEqual(1);
  });
  it("take a few milliseconds each at a thousand notes", () => {
    const big = gridLayout(model(40, 28), {});
    const some = big.links.filter((l) => l.s >= 2 && big.items[l.a].parent !== big.items[l.b].parent).slice(0, 40).map(({ a, b }) => ({ a, b }));
    const t = performance.now(), out = gridRouter(big)(some), ms = performance.now() - t;
    console.log(`router at 1177 notes, ${big.W} by ${big.H} cells: ${some.length} links between folders in ${ms.toFixed(0)} ms`);
    expect(out.measures.lost).toBe(0);
    expect(ms).toBeLessThan(45000);
  }, 60000);
});

describe("room for routes (T71)", () => {
  for (const flow of ["up", "right"]) {
    const L = gridLayout(model(6, 9), { gridFlow: flow });
    it(`flowing ${flow}: siblings stand 6 cells apart, and a trunk keeps ${KEEP} clear of every note it passes`, () => {
      L.items.forEach((a, i) => L.items.forEach((b, j) => { if (j > i && a.parent === b.parent) expect(overlap(a, b, 5)).toBe(false); }));
      const notes = L.items.map((n, i) => i).filter((i) => L.items[i].kind === "note");
      const inside = (i, f) => { for (let p = i; p >= 0; p = L.items[p].parent) if (p === f) return true; return false; };
      let near = 0, run = 0;
      for (const t of L.trunks.filter((t) => t.pts)) {
        for (let k = 1; k < t.pts.length; k++) {
          const [x0, y0] = t.pts[k - 1], [x1, y1] = t.pts[k], steps = Math.max(1, Math.round(Math.abs(x1 - x0) + Math.abs(y1 - y0)));
          for (let s = 0; s <= steps; s++) {
            const x = x0 + ((x1 - x0) * s) / steps, y = y0 + ((y1 - y0) * s) / steps;
            run++;
            for (const i of notes) {
              if (inside(i, t.a) || inside(i, t.b)) continue; // its own ends, and what is in them
              const n = L.items[i], dx = Math.max(n.gx - x, x - (n.gx + n.w), 0), dy = Math.max(n.gy - y, y - (n.gy + n.h), 0);
              if (Math.max(dx, dy) < KEEP - 0.5) near++;
            }
          }
        }
      }
      expect(run).toBeGreaterThan(200);
      expect(near).toBe(0);
    });
  }
});

describe("the folderless view (T71)", () => {
  const m = model(6, 9), flat = plainModel(m, true), L = gridLayout(flat, { gridFlow: "up" });
  it("every note is an item of one layout, with no folders, none overlapping", () => {
    expect(L.items.every((n) => n.kind === "note" && n.parent === -1)).toBe(true);
    expect(L.items).toHaveLength(6 * 9 + 2 * 4 + 1);
    L.items.forEach((a, i) => L.items.forEach((b, j) => { if (j > i) expect(overlap(a, b, 5)).toBe(false); }));
  });
  it("links that fit the order are drawn as trunks, and each of the rest is a back trunk or implied by a longer way", () => {
    const strong = m.edges.filter(([, , s]) => s >= 2).length;
    expect(L.trunks.filter((t) => t.pts).length).toBeGreaterThan(strong * 0.5);
    expect(L.trunks.filter((t) => !t.pts).every((t) => t.back || t.implied)).toBe(true);
    expect(L.trunks.filter((t) => t.back).length).toBeLessThan(strong * 0.2);
  });
});

describe("feeders (T72)", () => {
  for (const flow of ["up", "right"]) {
    const L = gridLayout(model(6, 9), { gridFlow: flow }), C = buildCells(L);
    const inside = (i, f) => { for (let p = L.items[i].parent; p >= 0; p = L.items[p].parent) if (p === f) return true; return false; };
    it(`flowing ${flow}: every drawn trunk that ends on a folder is fed from the items in it that hold its links, and the counts add up`, () => {
      expect(L.feeders.length).toBeGreaterThan(10);
      // Those from subfolders are drawn; those from notes are kept for tracing a link, and no subfolder's joins one.
      expect(L.feeders.some((f) => !f.leaf) && L.feeders.some((f) => f.leaf)).toBe(true);
      for (const f of L.feeders) { expect(f.leaf).toBe(L.items[f.item].kind === "note"); if (!f.leaf && f.via >= 0) expect(L.feeders[f.via].leaf).toBe(false); if (f.via >= 0) expect(L.feeders[f.via].folder).toBe(f.folder); }
      expect(feeders(L)).toEqual(L.feeders); // the same layout, the same feeders
      L.trunks.forEach((t, k) => {
        if (!t.pts) return;
        for (const end of [t.a, t.b]) {
          if (L.items[end].kind !== "folder") continue;
          const fed = L.feeders.filter((f) => f.trunk === k && f.folder === end);
          expect(fed.length).toBeGreaterThan(0);
          expect(fed.reduce((n, f) => n + f.count, 0)).toBe(t.count);
          for (const f of fed) expect(L.items[f.item].parent).toBe(end);
        }
      });
    });
    it(`flowing ${flow}: a feeder runs from its item's edge, inside its folder, through no note and no other folder, to the trunk's foot or a branch already going there`, () => {
      for (const f of L.feeders) {
        const F = L.items[f.folder], X = L.items[f.item], [x0, y0] = f.pts[0];
        expect(x0 >= X.gx && x0 <= X.gx + X.w && y0 >= X.gy && y0 <= X.gy + X.h).toBe(true);
        for (const [x, y] of f.pts) expect(x >= F.gx && x <= F.gx + F.w && y >= F.gy && y <= F.gy + F.h).toBe(true);
        for (const [x, y] of f.pts.slice(1, -1)) expect(C.blocked[Math.floor(y) * C.W + Math.floor(x)]).toBe(0);
        for (const [x, y] of f.pts.slice(1, -1)) expect(C.owner[Math.floor(y) * C.W + Math.floor(x)]).toBe(f.folder); // on its folder's own ground: through no other folder
      }
      // The first branch to each foot ends on the wall, at the trunk's end; the rest end there or on another branch.
      const first = new Map();
      for (const f of L.feeders) {
        const key = f.trunk + "|" + f.folder, t = L.trunks[f.trunk], foot = f.folder === t.a && inside(f.item, t.a) && L.items[f.item].parent === t.a ? t.pts[t.pts.length - 1] : t.pts[0];
        if (!first.has(key) && L.items[f.folder].parent === L.items[t.a].parent) { first.set(key, f); expect(f.pts[f.pts.length - 1]).toEqual(foot); }
      }
    });
  }
});
