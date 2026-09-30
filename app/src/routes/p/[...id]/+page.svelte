<script lang="ts">
  import { page } from "$app/state";
  import ProcedurePage from "$lib/components/ProcedurePage.svelte";
</script>

{#key page.params.id}<ProcedurePage id={page.params.id ?? ""} />{/key}
