// Copied unchanged from the previous app's map.js (routing excerpt): lowestCommon, crosses, makeRouter.
import * as d3 from 'd3';

export function lowestCommon(a, b) {
  const up = new Set(a.ancestors());
  for (const n of b.ancestors()) if (up.has(n)) return n;
  return null;
}


// Does the segment p–q pass through circle c of radius r?
function crosses(p, q, c, r) {
  const dx = q.x - p.x, dy = q.y - p.y, len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / len2));
  return Math.hypot(p.x + t * dx - c.x, p.y + t * dy - c.y) < r * 0.98;
}

export function makeRouter(o) {
  const itemRadius = (n) => (n.data.kind === "concept" ? n.r * o.dot : n.r);
  const nets = new Map();

  function network(folder) {
    if (nets.has(folder)) return nets.get(folder);
    const items = folder.children || [];
    const nodes = [], adj = [];
    const touching = new Map(items.map((_, i) => [i, []]));
    const index = new Map(items.map((n, i) => [n, i]));
    const discount = new Map();
    const node = (x, y) => { adj.push([]); return nodes.push({ x, y }) - 1; };
    const blockedBy = (p, q, skip) => items.some((m) => !skip.includes(m) && crosses(p, q, m, itemRadius(m)));
    const link = (u, v, skip = []) => {
      const p = nodes[u], q = nodes[v];
      const w = Math.hypot(p.x - q.x, p.y - q.y) * (blockedBy(p, q, skip) ? o.detour : 1);
      const key = u < v ? `${u}-${v}` : `${v}-${u}`;
      adj[u].push({ to: v, w, key });
      adj[v].push({ to: u, w, key });
    };
    const gapWaypoint = new Map();
    const waypoint = (i, j) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (gapWaypoint.has(key)) return gapWaypoint.get(key);
      const a = items[i], b = items[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const gap = d - itemRadius(a) - itemRadius(b);
      let id = -1;
      if (gap > 1) {
        const t = (itemRadius(a) + gap / 2) / d;
        id = node(a.x + dx * t, a.y + dy * t);
        touching.get(i).push(id); touching.get(j).push(id);
      }
      gapWaypoint.set(key, id);
      return id;
    };
    if (items.length === 2) waypoint(0, 1);
    if (items.length >= 3) {
      const tri = d3.Delaunay.from(items, (n) => n.x, (n) => n.y).triangles;
      for (let t = 0; t < tri.length; t += 3) {
        const ws = [waypoint(tri[t], tri[t + 1]), waypoint(tri[t + 1], tri[t + 2]), waypoint(tri[t + 2], tri[t])].filter((x) => x >= 0);
        if (ws.length < 2) continue;
        // Start from the centroid of the gaps and push it out of any item it
        // falls in, so the middle waypoint sits in open space.
        let mx = ws.reduce((s, x) => s + nodes[x].x, 0) / ws.length, my = ws.reduce((s, x) => s + nodes[x].y, 0) / ws.length;
        for (let round = 0; round < 4; round++) {
          for (const m of [items[tri[t]], items[tri[t + 1]], items[tri[t + 2]]]) {
            const dx = mx - m.x, dy = my - m.y, d = Math.hypot(dx, dy) || 1e-6, r = itemRadius(m) * 1.04;
            if (d < r) { mx = m.x + (dx / d) * r; my = m.y + (dy / d) * r; }
          }
        }
        const mid = node(mx, my);
        for (const x of ws) link(x, mid);
      }
    }
    // Gates on the folder's edge (the root has no edge to cross).
    const gates = [];
    const firstGate = nodes.length; // nodes before this are corridors between items
    if (folder.parent) {
      const R = folder.r * 0.995;
      items.forEach((item, i) => {
        const dx = item.x - folder.x, dy = item.y - folder.y, d = Math.hypot(dx, dy);
        const angle = d > 1e-6 ? Math.atan2(dy, dx) : (i / items.length) * 2 * Math.PI;
        const g = node(folder.x + R * Math.cos(angle), folder.y + R * Math.sin(angle));
        gates.push({ id: g, angle, item: i });
        touching.get(i).push(g);
      });
      gates.sort((a, b) => a.angle - b.angle);
      // The ring road follows the wall in short steps rather than long chords.
      for (let k = 0; k < gates.length && gates.length > 1; k++) {
        const g0 = gates[k], g1 = gates[(k + 1) % gates.length];
        let span = g1.angle - g0.angle;
        if (span <= 0) span += 2 * Math.PI;
        const steps = Math.max(1, Math.ceil(span / (Math.PI / 12)));
        let prev = g0.id;
        for (let st = 1; st < steps; st++) {
          const a = g0.angle + (span * st) / steps;
          const id = node(folder.x + R * Math.cos(a), folder.y + R * Math.sin(a));
          link(prev, id);
          prev = id;
        }
        link(prev, g1.id);
      }
      // Join each gate to the nearest corridors inside.
      const inner = nodes.map((_, id) => id).slice(0, firstGate);
      for (const g of gates) {
        const p = nodes[g.id];
        inner.sort((a, b) => Math.hypot(nodes[a].x - p.x, nodes[a].y - p.y) - Math.hypot(nodes[b].x - p.x, nodes[b].y - p.y));
        for (const id of inner.slice(0, 3)) link(g.id, id);
      }
    }
    const net = { folder, items, nodes, adj, touching, index, gates, discount, itemRadius, blockedBy };
    nets.set(folder, net);
    return net;
  }

  // Dijkstra from a set of start nodes to a set of end nodes (with the cost of
  // stepping off the network added); the networks are small.
  function shortest(net, starts, ends) {
    const dist = new Map(), prev = new Map(), done = new Set();
    for (const [id, c] of starts) if (c < (dist.get(id) ?? Infinity)) dist.set(id, c);
    let best = null, bestCost = Infinity;
    while (true) {
      let u = -1, du = Infinity;
      for (const [k, v] of dist) if (!done.has(k) && v < du) { u = k; du = v; }
      if (u < 0 || du >= bestCost) break;
      done.add(u);
      if (ends.has(u) && du + ends.get(u) < bestCost) { best = u; bestCost = du + ends.get(u); }
      for (const e of net.adj[u]) {
        const nd = du + e.w * (net.discount.get(e.key) || 1);
        if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: u, key: e.key }); }
      }
    }
    if (best === null) return null;
    const path = [];
    for (let u = best; u !== undefined; u = prev.get(u)?.from) {
      path.push(u);
      const step = prev.get(u);
      if (step && o.bundle > 0) net.discount.set(step.key, Math.max(0.3, (net.discount.get(step.key) || 1) * (1 - o.bundle)));
    }
    return path.reverse();
  }

  // How a route gets on or off the network at an item or at a point.
  function attachItem(net, item) {
    const i = net.index.get(item);
    const out = new Map();
    for (const id of net.touching.get(i) || []) {
      const p = net.nodes[id];
      const c = Math.hypot(p.x - item.x, p.y - item.y) * (net.blockedBy(item, p, [item]) ? o.detour : 1);
      out.set(id, c);
    }
    return out;
  }
  function attachPoint(net, pt) {
    const out = new Map();
    const near = net.nodes.map((p, id) => [id, Math.hypot(p.x - pt.x, p.y - pt.y)]).sort((a, b) => a[1] - b[1]).slice(0, 4);
    for (const [id, d] of near) out.set(id, d * (net.blockedBy(pt, net.nodes[id], []) ? o.detour : 1));
    return out;
  }

  // Straighten a route: keep only the waypoints needed to get around obstacles.
  function pull(points, obstacles) {
    const clear = (p, q) => !obstacles.some((m) => crosses(p, q, m, itemRadius(m)));
    const out = [points[0]];
    let i = 0;
    while (i < points.length - 1) {
      let j = points.length - 1;
      while (j > i + 1 && !clear(points[i], points[j])) j--;
      out.push(points[j]);
      i = j;
    }
    return out;
  }

  // Inside `folder`: from item a to item b, or from item a to a point on the edge.
  function within(folder, a, b, pt) {
    const net = network(folder);
    const end = pt || { x: b.x, y: b.y };
    const obstacles = net.items.filter((n) => n !== a && n !== b);
    const start = { x: a.x, y: a.y };
    if (!obstacles.some((m) => crosses(start, end, m, itemRadius(m)))) return [start, end];
    const starts = attachItem(net, a);
    const ends = b ? attachItem(net, b) : attachPoint(net, pt);
    const path = starts.size && ends.size ? shortest(net, starts, ends) : null;
    return pull([start, ...(path || []).map((id) => net.nodes[id]), end], obstacles);
  }

  // Where a route leaves circle c heading for point q.
  const edgeToward = (c, q) => {
    const dx = q.x - c.x, dy = q.y - c.y, d = Math.hypot(dx, dy) || 1;
    return { x: c.x + (dx / d) * c.r, y: c.y + (dy / d) * c.r };
  };
  const childToward = (folder, rep) => rep.ancestors().find((n) => n.parent === folder);

  // From rep out to the point `exit` on the edge of `folder` (which contains rep).
  function climb(folder, rep, exit) {
    const child = childToward(folder, rep);
    const path = within(folder, child, null, exit);
    if (child === rep) return path;
    const inner = climb(child, rep, edgeToward(child, path[1]));
    return [...inner, ...path.slice(1)];
  }

  // The full route between two shown items, through their folders.
  function route(ra, rb) {
    const lca = lowestCommon(ra, rb);
    const ca = childToward(lca, ra), cb = childToward(lca, rb);
    const middle = within(lca, ca, cb);
    const left = ca === ra ? [middle[0]] : climb(ca, ra, edgeToward(ca, middle[1]));
    const right = cb === rb ? [middle[middle.length - 1]] : climb(cb, rb, edgeToward(cb, middle[middle.length - 2])).reverse();
    return [...left, ...middle.slice(1, -1), ...right].map((p) => [p.x, p.y]);
  }

  return { route, itemRadius };
}

