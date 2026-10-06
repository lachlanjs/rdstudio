<script lang="ts">
  import { page } from "$app/state";
  import Imperative from "$lib/components/Imperative.svelte";
  import { projectMode } from "$lib/shell.svelte.ts";
  import { atlasView } from "$lib/views/gridmap.js";
</script>

<!-- Drawn again once the project's mode is known: it sets the height lens and north (T59).
     The grid Atlas when `folders = "grid"` is chosen, else the continuous one (T62). -->
{#key `${page.params.focus}|${projectMode()}`}<Imperative make={() => atlasView(page.params.focus ?? "")} />{/key}
