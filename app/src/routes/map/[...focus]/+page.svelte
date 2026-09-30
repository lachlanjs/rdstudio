<script lang="ts">
  import { page } from "$app/state";
  import Imperative from "$lib/components/Imperative.svelte";
  import { mapView } from "$lib/views/map.js";
</script>

{#key page.params.focus}<Imperative make={() => mapView(page.params.focus ?? "")} />{/key}
