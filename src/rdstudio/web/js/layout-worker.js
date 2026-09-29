// Works out map layouts off the main thread (see layout.js).

import { layoutPositions } from "./layout.js";

const ready = import("../vendor/d3.min.js"); // sets the global d3 that layout.js uses

self.onmessage = async ({ data }) => {
  try {
    await ready;
    const xyr = layoutPositions(data.model, data.o);
    self.postMessage({ id: data.id, xyr }, [xyr.buffer]);
  } catch (err) {
    self.postMessage({ id: data.id, error: String(err?.message || err) });
  }
};
