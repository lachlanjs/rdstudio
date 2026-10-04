// Works out map layouts off the main thread (see layout.js).

import { layoutPositions } from "./layout.js";
import { bake } from "./terrain.js";


self.onmessage = async ({ data }) => {
  try {
    if (data.terrain) {
      self.postMessage({ id: data.id, terrain: data.terrain.map(bake) });
      return;
    }
    const xyr = layoutPositions(data.model, data.o, data.prev);
    self.postMessage({ id: data.id, xyr }, [xyr.buffer]);
  } catch (err) {
    self.postMessage({ id: data.id, error: String(err?.message || err) });
  }
};
