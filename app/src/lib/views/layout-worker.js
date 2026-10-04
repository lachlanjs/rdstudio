// Works out map layouts off the main thread (see layout.js).

import { layoutPositions } from "./layout.js";
import { bake } from "./terrain.js";
import { outlines, routingGrid, routeAll } from "./contours.js";

let grid = null; // the routing grid for one layout and its values: { key, grid }


self.onmessage = async ({ data }) => {
  try {
    if (data.terrain) {
      self.postMessage({ id: data.id, result: data.terrain.map(bake) });
      return;
    }
    if (data.outlines) {
      self.postMessage({ id: data.id, result: outlines(data.outlines) });
      return;
    }
    if (data.routes) {
      const { key, input, asks } = data.routes;
      if (grid?.key !== key) grid = { key, grid: routingGrid(input) };
      self.postMessage({ id: data.id, result: routeAll(grid.grid, asks) });
      return;
    }
    const xyr = layoutPositions(data.model, data.o, data.prev);
    self.postMessage({ id: data.id, xyr }, [xyr.buffer]);
  } catch (err) {
    self.postMessage({ id: data.id, error: String(err?.message || err) });
  }
};
