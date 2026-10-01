<script lang="ts">
  // The dialog for the action asked for anywhere (the tree's menus, a folder's
  // page, a note's page): a fresh one for each action.
  import { actions } from "$lib/actions.svelte.ts";
  import ActionDialog from "./ActionDialog.svelte";
</script>

{#key actions.current}
  {#if actions.current}<ActionDialog a={actions.current} />{/if}
{/key}
