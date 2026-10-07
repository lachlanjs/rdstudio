<script lang="ts">
  import { page } from "$app/state";
  import Imperative from "$lib/components/Imperative.svelte";
  import { projectMode } from "$lib/shell.svelte.ts";
  import { mapView } from "$lib/views/gridmap.js";
</script>

{#key `${page.params.id}|${projectMode()}`}<Imperative make={() => mapView("", { path: page.params.id ?? "" })} />{/key}
