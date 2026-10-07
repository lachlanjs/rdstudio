<script lang="ts">
  // Following a tour: the map, its stops numbered and joined in order, and a
  // card with the narration that steps from one to the next. Reaching a stop
  // is recorded (when the learner record is on) as an interactive task.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Imperative from "$lib/components/Imperative.svelte";
  import Missing from "$lib/components/Missing.svelte";
  import { learner } from "$lib/data.svelte.ts";
  import { render } from "$lib/markdown.ts";
  import { loadTour, stopsOf, type Stop, type Tour } from "$lib/tours.ts";
  import { mapView } from "$lib/views/gridmap.js";

  const key = $derived(page.params.id ?? "");
  let loaded = $state<{ key: string; tour: Tour | null; stops: Stop[] } | null>(null);
  $effect(() => {
    const k = key;
    void loadTour(k).then((tour) => { loaded = { key: k, tour, stops: tour ? stopsOf(tour) : [] }; });
  });

  function reached(tour: Tour, stops: Stop[], i: number) {
    const stop = stops[i];
    if (!stop || !learner.enabled) return;
    const recent = learner.events.findLast((e) => e.event === "tour_step" && e.tour === tour.key && e.stop === i);
    if (recent && Date.now() - Date.parse(String(recent.at)) < 30 * 60e3) return;
    void learner.record({ event: "tour_step", tour: tour.key, stop: i, ...(stop.id ? { concept: stop.id } : {}), kind: "interactive" });
  }
</script>

{#if loaded && loaded.key === key}
  {#if loaded.tour && loaded.stops.length}
    {@const tour = loaded.tour}
    {@const stops = loaded.stops}
    {#key key}
      <Imperative make={() => mapView("", { tour: {
        key: tour.key, title: tour.title, stops, start: 0, back: "#/learn",
        narrate: (text: string) => render(text, { dir: tour.dir }),
        onStep: (i: number) => reached(tour, stops, i),
        onFinish: () => goto("#/learn"),
      } })} />
    {/key}
  {:else if loaded.tour}
    <Missing what={`${loaded.tour.title} has no stops yet`} />
  {:else}
    <Missing what={key.startsWith("~") ? `Your tour ${key.slice(1)}` : key} />
  {/if}
{/if}
