// The grid Atlas's layout, cells and routes (T62, T64) on generated folder trees.
import { describe, expect, it } from "vitest";
import { gridLayout, gridRouter } from "../layout.js";
import { buildCells, reachedCells, maskPaths, NOTE } from "./cells.js";
import { greedyOrder } from "./nested.js";

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
        if (n.kind === "note") expect([n.w, n.h]).toEqual([14, 4]);
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
    expect(performance.now() - t).toBeLessThan(5000);
  });
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
    expect(ms).toBeLessThan(15000);
  }, 20000);
});
