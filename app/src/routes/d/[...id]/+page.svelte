<script lang="ts">
  import { page } from "$app/state";
  import DirPage from "$lib/components/DirPage.svelte";
</script>

<DirPage id={page.params.id ?? ""} />
