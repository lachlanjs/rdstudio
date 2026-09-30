<script lang="ts" generics="T">
  // A titled list with a count, or "Nothing here."
  import type { Snippet } from "svelte";

  let { title, note, items, row }: { title: string; note?: string | null; items: T[]; row: Snippet<[T]> } = $props();
</script>

<h2 class="section-h">{title}<span class="count">{items.length}</span></h2>
{#if note}<p class="section-note">{note}</p>{/if}
{#if items.length}
  <ul class="rows">{#each items as item, i (i)}{@render row(item)}{/each}</ul>
{:else}
  <p class="empty">Nothing here.</p>
{/if}
