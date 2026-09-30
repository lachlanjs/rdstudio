// Works out map layouts off the main thread (see layout.js).

import { layoutPositions } from "./layout.js";


self.onmessage = async ({ data }) => {
  try {
    const xyr = layoutPositions(data.model, data.o);
    self.postMessage({ id: data.id, xyr }, [xyr.buffer]);
  } catch (err) {
    self.postMessage({ id: data.id, error: String(err?.message || err) });
  }
};
