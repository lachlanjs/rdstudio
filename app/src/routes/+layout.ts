// A single-page app (hash routing implies no server rendering): everything
// renders in the browser, from the files rdstudio build writes. The data loads
// once here, before the first page.
import { learner, store } from "$lib/data.svelte.ts";
import { editing } from "$lib/edit.svelte.ts";

export async function load() {
  await store.load();
  await Promise.all([learner.load(), editing.load()]);
  return {};
}
