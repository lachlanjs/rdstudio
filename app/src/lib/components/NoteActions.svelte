<script lang="ts">
  // Beside Edit on a note: moving or renaming it, and deleting it (the dialogs
  // are ActionDialogs').
  import type { ConceptRecord } from "@rdstudio/core";
  import { actions } from "$lib/actions.svelte.ts";

  let { c }: { c: ConceptRecord } = $props();
</script>

<button class="toggle" type="button" onclick={() => actions.open({ kind: "move-note", id: c.id })}>Move</button>
<button class="toggle quiet" type="button" onclick={() => actions.open({ kind: "delete-note", id: c.id })}>Delete</button>
