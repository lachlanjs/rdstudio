<script lang="ts">
  // The knowledge pages' three columns: the tree, the page, and (for notes) details.
  import type { Snippet } from "svelte";
  import { wireAnchors } from "$lib/markdown.ts";
  import { actions } from "$lib/actions.svelte.ts";
  import { editing } from "$lib/edit.svelte.ts";
  import { dirLabel, tree } from "$lib/tree.svelte.ts";
  import { understanding } from "$lib/understanding.svelte.ts";
  import RowMenu from "./RowMenu.svelte";
  import TreeList from "./TreeList.svelte";

  let { current, children, meta }: { current: string | null; children: Snippet; meta?: Snippet } = $props();
</script>

<!-- Anchors in the details panel (the outline) scroll the page too. -->
<div class={["kn", !meta && "no-meta"]} {@attach wireAnchors}>
  <aside class="tree" aria-label="Contents">
    <input class="filter" type="search" placeholder="Filter by title, type or tag" aria-label="Filter knowledge"
      value={tree.filter} oninput={(e) => (tree.filter = e.currentTarget.value.trim())} />
    {#if understanding.on}
      <label class="hide-undiscovered"><input type="checkbox" checked={understanding.hiding}
        onchange={(e) => understanding.setHiding(e.currentTarget.checked)} /> Hide what I have not reached</label>
    {/if}
    <div>
      <div class="root-row">
        <a class="root-link" href="#/library">{dirLabel("")}</a>
        {#if editing.enabled}
          <RowMenu label="Add to the knowledge base" items={[
            { label: "New note", run: () => actions.open({ kind: "new-note", folder: "" }) },
            { label: "New folder", run: () => actions.open({ kind: "new-folder", folder: "" }) },
          ]} />
        {/if}
      </div>
      <TreeList id="" {current} />
    </div>
  </aside>
  {@render children()}
  {@render meta?.()}
</div>
