// The grid Atlas's layout, cells and routes (T62) on generated folder trees.
import { describe, expect, it } from "vitest";
import { gridLayout, gridRouter } from "../layout.js";
import { buildCells, reachedCells, maskPaths, NOTE, TITLE } from "./cells.js";
import { GAP_NOTES } from "./snap.js";
import { greedyOrder } from "./dag.js";

const BASE = { room: 0.3, spread: 1, outward: 1, spacing: 90, margin: 60, north: 5 };
const O = { ...BASE, gridLayout: "snap" }, DAG = { ...BASE, gridLayout: "layers" };

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

describe("the placeholder layout", () => {
  const m = model(6, 9), L = gridLayout(m, O);
  it("gives every note and folder a block inside the grid", () => {
    expect(L.items.filter((n) => n.kind === "note")).toHaveLength(6 * 9 + 2 * 4 + 1);
    expect(L.items.filter((n) => n.kind === "folder")).toHaveLength(6 + 2);
    for (const n of L.items) expect(n.gx >= 0 && n.gy >= 0 && n.gx + n.w <= L.W && n.gy + n.h <= L.H).toBe(true);
  });
  it("keeps each item inside its folder, under the title row", () => {
    for (const n of L.items) {
      if (n.parent < 0) continue;
      const f = L.items[n.parent];
      expect(inside(n, f)).toBe(true);
      expect(n.gy).toBeGreaterThan(f.gy + 1);
    }
  });
  it("keeps siblings clear of each other", () => {
    L.items.forEach((a, i) => L.items.forEach((b, j) => {
      if (j <= i || a.parent !== b.parent) return;
      expect(overlap(a, b, GAP_NOTES)).toBe(false);
    }));
  });
  it("is the same for the same bundle", () => {
    expect(gridLayout(model(6, 9), O)).toEqual(L);
  });
  it("gives each link the lowest folder that holds both ends", () => {
    const up = (i) => { const out = []; for (let p = L.items[i].parent; p >= 0; p = L.items[p].parent) out.push(p); return out; };
    expect(L.links.length).toBeGreaterThan(50);
    for (const l of L.links) {
      const A = up(l.a), B = up(l.b);
      expect(l.level).toBe(A.find((p) => B.includes(p)) ?? -1);
      expect(l.placed).toBe(false);
    }
  });
});

describe("the layout from each folder's DAG", () => {
  const m = model(6, 9), L = gridLayout(m, DAG);
  const up = (i) => { const out = []; for (let p = L.items[i].parent; p >= 0; p = L.items[p].parent) out.push(p); return out; };
  it("gives every note and folder a block, parents before children, siblings clear, items inside their folder", () => {
    expect(L.items.filter((n) => n.kind === "note")).toHaveLength(6 * 9 + 2 * 4 + 1);
    L.items.forEach((n, i) => {
      expect(n.parent).toBeLessThan(i);
      expect(n.gx >= 0 && n.gy >= 0 && n.gx + n.w <= L.W && n.gy + n.h <= L.H).toBe(true);
      if (n.parent >= 0) { expect(inside(n, L.items[n.parent])).toBe(true); expect(n.gy).toBeGreaterThan(L.items[n.parent].gy + 1); }
    });
    L.items.forEach((a, i) => L.items.forEach((b, j) => { if (j > i && a.parent === b.parent) expect(overlap(a, b, GAP_NOTES)).toBe(false); }));
  });
  it("puts what a link requires south of what requires it, for every link it placed, wherever the two are", () => {
    const placed = L.links.filter((l) => l.placed);
    expect(placed.length).toBeGreaterThan(L.links.filter((l) => l.s >= 2).length * 0.6);
    for (const l of placed) expect(L.items[l.b].gy).toBeGreaterThanOrEqual(L.items[l.a].gy + L.items[l.a].h);
    for (const l of L.links) if (l.s < 2) expect(l.placed).toBe(false);
  });
  it("draws a path for each link it placed and did not find implied: from the foot of one note, square, to the head of the other", () => {
    const drawn = L.links.filter((l) => l.path);
    expect(drawn.length).toBeGreaterThan(20);
    expect(L.links.filter((l) => l.placed && !l.implied && !l.path)).toHaveLength(0);
    expect(L.links.filter((l) => l.implied).every((l) => l.placed && !l.path)).toBe(true);
    const C = buildCells(L);
    for (const l of drawn) {
      const a = L.items[l.a], b = L.items[l.b], P = l.path, end = P[P.length - 1];
      expect(P[0][1]).toBe(a.gy + a.h);
      expect(P[0][0] > a.gx && P[0][0] < a.gx + a.w).toBe(true);
      expect(end[1]).toBe(b.gy);
      expect(end[0] > b.gx && end[0] < b.gx + b.w).toBe(true);
      for (let k = 1; k < P.length; k++) {
        expect(P[k][0] === P[k - 1][0] || P[k][1] === P[k - 1][1]).toBe(true); // across or down, never both
        expect(P[k][1]).toBeGreaterThanOrEqual(P[k - 1][1]);
        // a run down never passes through a note
        if (P[k][0] === P[k - 1][0]) for (let y = Math.ceil(P[k - 1][1]); y < Math.floor(P[k][1]); y++) expect(C.noteAt[y * C.W + Math.floor(P[k][0])]).toBe(-1);
        else for (let x = Math.ceil(Math.min(P[k][0], P[k - 1][0])); x < Math.floor(Math.max(P[k][0], P[k - 1][0])); x++) expect(C.noteAt[Math.floor(P[k][1]) * C.W + x]).toBe(-1);
      }
    }
  });
  it("is the same for the same bundle, and routes every link", () => {
    expect(gridLayout(model(6, 9), DAG)).toEqual(L);
    const asks = L.links.filter((l) => l.s >= 2).map(({ a, b }) => ({ a, b }));
    expect(gridRouter(L)(asks).measures.lost).toBe(0);
  });
  it("orders a cycle so that only its lightest link runs back", () => {
    const pos = greedyOrder(3, [[0, 1, 3], [1, 2, 3], [2, 0, 2]]);
    expect([pos[0] < pos[1], pos[1] < pos[2], pos[2] < pos[0]]).toEqual([true, true, false]);
    expect(greedyOrder(3, [])).toEqual([0, 1, 2]);
  });
  it("lays out a thousand notes quickly", () => {
    const t = performance.now(), big = gridLayout(model(40, 28), DAG);
    console.log(`dag layout at ${big.items.filter((n) => n.kind === "note").length} notes: ${big.W} by ${big.H} cells, ${(performance.now() - t).toFixed(0)} ms`);
    expect(performance.now() - t).toBeLessThan(5000);
  });
});

describe("the nested layout", () => {
  for (const flow of ["up", "right"]) {
    const L = gridLayout(model(6, 9), { ...BASE, gridFlow: flow }), C = buildCells(L);
    it(`flowing ${flow}: every block inside its folder under the title, siblings clear, parents first`, () => {
      expect(L.flow).toBe(flow);
      expect(L.items.filter((n) => n.kind === "note")).toHaveLength(6 * 9 + 2 * 4 + 1);
      L.items.forEach((n, i) => {
        expect(n.parent).toBeLessThan(i);
        expect(n.gx >= 0 && n.gy >= 0 && n.gx + n.w <= L.W && n.gy + n.h <= L.H).toBe(true);
        if (n.kind === "note") expect([n.w, n.h]).toEqual([14, 4]);
        if (n.parent >= 0) { expect(inside(n, L.items[n.parent])).toBe(true); expect(n.gy).toBeGreaterThan(L.items[n.parent].gy + 1); }
      });
      L.items.forEach((a, i) => L.items.forEach((b, j) => { if (j > i && a.parent === b.parent) expect(overlap(a, b, GAP_NOTES)).toBe(false); }));
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
  it("is the same for the same bundle, wider than tall flowing right and the other way flowing up", () => {
    expect(gridLayout(model(6, 9), BASE)).toEqual(gridLayout(model(6, 9), { ...BASE, gridFlow: "up" }));
    const big = model(40, 28), t = performance.now(), U = gridLayout(big, BASE), R = gridLayout(big, { ...BASE, gridFlow: "right" });
    console.log(`nested layout at 1177 notes: up ${U.W} by ${U.H}, right ${R.W} by ${R.H} cells, ${(performance.now() - t).toFixed(0)} ms for both`);
    expect(performance.now() - t).toBeLessThan(5000);
  });
});

describe("the cells", () => {
  const L = gridLayout(model(6, 9), O), C = buildCells(L);
  it("know their height, their folder and what blocks them", () => {
    L.items.forEach((n, i) => {
      const c = n.gy * C.W + n.gx;
      if (n.kind === "note") {
        expect(C.blocked[c]).toBe(NOTE);
        expect(C.noteAt[c]).toBe(i);
        expect(C.owner[c]).toBe(n.parent);
        expect(C.elev[c]).toBe(n.depth - 1);
      } else {
        expect(C.blocked[c]).toBe(TITLE);
        expect(C.elev[c + C.W]).toBe(n.depth);
        expect(C.owner[c + C.W]).toBe(i);
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

describe("the routes", () => {
  const L = gridLayout(model(6, 9), O), C = buildCells(L);
  const asks = L.links.filter((l) => l.s >= 2).map(({ a, b }) => ({ a, b }));
  const { routes, measures } = gridRouter(L)(asks);
  const onEdge = ([x, y], n) => (x >= n.gx && x <= n.gx + n.w && (y === n.gy || y === n.gy + n.h)) || (y >= n.gy && y <= n.gy + n.h && (x === n.gx || x === n.gx + n.w));
  it("find a way for every link", () => {
    expect(measures.lost).toBe(0);
    expect(routes.every(Boolean)).toBe(true);
  });
  it("end on the edges of the blocks they join", () => {
    routes.forEach((r, i) => {
      expect(onEdge(r.pts[0], L.items[asks[i].a])).toBe(true);
      expect(onEdge(r.pts[r.pts.length - 1], L.items[asks[i].b])).toBe(true);
    });
  });
  it("never enter a note or a title row, and move one cell at a time", () => {
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
  it("join folders as well as notes", () => {
    const tops = L.items.map((n, i) => (n.kind === "folder" && n.depth === 1 ? i : -1)).filter((i) => i >= 0);
    const trunks = gridRouter(L)([{ a: tops[0], b: tops[1] }, { a: tops[2], b: tops[5] }]);
    expect(trunks.measures.lost).toBe(0);
    expect(onEdge(trunks.routes[0].pts[0], L.items[tops[0]])).toBe(true);
  });
  it("are measured", () => {
    expect(measures.routes).toBe(asks.length);
    expect(measures.length).toBeGreaterThan(asks.length);
    expect(measures.beside).toBeGreaterThan(0);
    expect(measures.beside).toBeLessThanOrEqual(1);
  });
});

describe("at a thousand notes", () => {
  it("lays out and routes in a few seconds", () => {
    const m = model(40, 28);
    let t = performance.now();
    const L = gridLayout(m, O);
    const layoutMs = performance.now() - t;
    const tops = L.items.map((n, i) => (n.depth === 1 ? i : -1)).filter((i) => i >= 0);
    const top = (i) => { while (L.items[i].parent >= 0) i = L.items[i].parent; return i; };
    const pairs = new Set(L.links.filter((l) => l.s >= 2 && top(l.a) !== top(l.b)).map((l) => [top(l.a), top(l.b)].sort((x, y) => x - y).join(",")));
    const asks = [...pairs].map((p) => { const [a, b] = p.split(",").map(Number); return { a, b }; });
    t = performance.now();
    const { measures } = gridRouter(L)(asks);
    const routeMs = performance.now() - t;
    console.log(`grid at ${L.items.filter((n) => n.kind === "note").length} notes: ${L.W} by ${L.H} cells, layout ${layoutMs.toFixed(0)} ms, ${asks.length} trunks between ${tops.length} top-level items ${routeMs.toFixed(0)} ms`, measures);
    expect(measures.lost).toBe(0);
    expect(layoutMs + routeMs).toBeLessThan(20000);
  });
});
