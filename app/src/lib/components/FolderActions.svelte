<script lang="ts">
  // On a folder's page: a new note or folder in it, and moving or deleting it
  // (the dialogs are ActionDialogs').
  import { actions } from "$lib/actions.svelte.ts";

  let { id }: { id: string } = $props(); // the folder; "" is the root
</script>

<div class="folder-actions toggles">
  <button class="toggle" type="button" onclick={() => actions.open({ kind: "new-note", folder: id })}>New note</button>
  <button class="toggle" type="button" onclick={() => actions.open({ kind: "new-folder", folder: id })}>New folder</button>
  {#if id}
    <button class="toggle" type="button" onclick={() => actions.open({ kind: "move-folder", id })}>Move</button>
    <button class="toggle quiet" type="button" onclick={() => actions.open({ kind: "delete-folder", id })}>Delete</button>
  {/if}
</div>
