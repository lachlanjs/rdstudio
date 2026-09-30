<script lang="ts">
  // The knowledge pages' three columns: the tree, the page, and (for notes) details.
  import type { Snippet } from "svelte";
  import { wireAnchors } from "$lib/markdown.ts";
  import { dirLabel, tree } from "$lib/tree.svelte.ts";
  import TreeList from "./TreeList.svelte";

  let { current, children, meta }: { current: string | null; children: Snippet; meta?: Snippet } = $props();
</script>

<!-- Anchors in the details panel (the outline) scroll the page too. -->
<div class={["kn", !meta && "no-meta"]} {@attach wireAnchors}>
  <aside class="tree" aria-label="Contents">
    <input class="filter" type="search" placeholder="Filter by title, type or tag" aria-label="Filter knowledge"
      value={tree.filter} oninput={(e) => (tree.filter = e.currentTarget.value.trim())} />
    <div>
      <a class="root-link" href="#/">{dirLabel("")}</a>
      <TreeList id="" {current} />
    </div>
  </aside>
  {@render children()}
  {@render meta?.()}
</div>
