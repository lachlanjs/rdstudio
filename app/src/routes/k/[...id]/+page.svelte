<script lang="ts">
  import { page } from "$app/state";
  import ConceptPage from "$lib/components/ConceptPage.svelte";
</script>

{#key page.params.id}<ConceptPage id={page.params.id ?? ""} />{/key}
