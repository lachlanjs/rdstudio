// Works out map layouts off the main thread (see layout.js).

import { layoutPositions, gridLayout, gridRouter } from "./layout.js";
import { bake } from "./terrain.js";
import { outlines, routingGrid, routeAll } from "./contours.js";

let grid = null; // the routing grid for one layout and its values: { key, grid }
let gridRoutes = null; // the grid Atlas's router for one layout: { key, run }

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
    if (data.grid) {
      self.postMessage({ id: data.id, result: gridLayout(data.grid.model, data.grid.o) });
      return;
    }
    if (data.gridRoutes) {
      const { key, layout, asks } = data.gridRoutes;
      if (gridRoutes?.key !== key) {
        if (!layout) throw new Error("no layout for these routes"); // the page then works them out itself
        gridRoutes = { key, run: gridRouter(layout) };
      }
      self.postMessage({ id: data.id, result: gridRoutes.run(asks) });
      return;
    }
    const xyr = layoutPositions(data.model, data.o, data.prev);
    self.postMessage({ id: data.id, xyr }, [xyr.buffer]);
  } catch (err) {
    self.postMessage({ id: data.id, error: String(err?.message || err) });
  }
};
