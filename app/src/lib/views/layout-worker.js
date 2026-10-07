// Works out map layouts off the main thread (see layout.js).

import { gridLayout, gridRouter } from "./layout.js";

let gridRoutes = null; // the router for one layout: { key, run }

self.onmessage = async ({ data }) => {
  try {
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
  } catch (err) {
    self.postMessage({ id: data.id, error: String(err?.message || err) });
  }
};
