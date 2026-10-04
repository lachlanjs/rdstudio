<script lang="ts">
  import { page } from "$app/state";
  import Imperative from "$lib/components/Imperative.svelte";
  import { projectMode } from "$lib/shell.svelte.ts";
  import { mapView } from "$lib/views/map.js";
</script>

<!-- Drawn again once the project's mode is known: it sets the height lens and north (T59). -->
{#key `${page.params.focus}|${projectMode()}`}<Imperative make={() => mapView(page.params.focus ?? "")} />{/key}
