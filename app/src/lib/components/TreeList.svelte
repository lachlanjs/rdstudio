<script lang="ts">
  import { conceptHref, dirHref, trustState } from "$lib/format.ts";
  import { actions } from "$lib/actions.svelte.ts";
  import { store } from "$lib/data.svelte.ts";
  import { editing } from "$lib/edit.svelte.ts";
  import { dirLabel, tree } from "$lib/tree.svelte.ts";
  import RowMenu from "./RowMenu.svelte";
  import TreeList from "./TreeList.svelte";

  // `current` is "k:<id>" for a note, or a folder id.
  let { id, current }: { id: string; current: string | null } = $props();

  const folder = $derived(store.tree[id]);
  const children = $derived(folder ? folder.children.filter((child) => !tree.filter || tree.hasMatch(child)) : []);
  const notes = $derived(folder
    ? folder.concepts.map((cid) => store.concepts.get(cid)).filter((c) => c && tree.matches(c) && (tree.filter || c.id !== folder.overview))
    : []);
  // The path to the current page is open, as are folders the reader opened.
  const here = $derived(current === null ? null : current.replace(/^k:/, ""));
  const isOpen = (child: string) => Boolean(tree.filter) || tree.open.has(child) || (here !== null && (here + "/").startsWith(child + "/"));
</script>

<ul>
  {#each children as child (child)}
    <li>
      <details open={isOpen(child)} ontoggle={(e) => tree.toggle(child, (e.currentTarget as HTMLDetailsElement).open)}>
        <summary class={["dir", current === child && "current"]}>
          <svg class="twisty" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
          <a href={dirHref(child)}>{dirLabel(child)}</a>
          {#if editing.enabled}
            <RowMenu label={`Actions for the folder ${dirLabel(child)}`} items={[
              { label: "New note here", run: () => actions.open({ kind: "new-note", folder: child }) },
              { label: "New folder here", run: () => actions.open({ kind: "new-folder", folder: child }) },
              { label: "Move or rename…", run: () => actions.open({ kind: "move-folder", id: child }) },
              { label: "Delete…", danger: true, run: () => actions.open({ kind: "delete-folder", id: child }) },
            ]} />
          {/if}
        </summary>
        <TreeList id={child} {current} />
      </details>
    </li>
  {/each}
  {#each notes as c (c!.id)}
    <li class="item">
      <a href={conceptHref(c!.id)} aria-current={current === "k:" + c!.id ? "page" : undefined} title={c!.description || c!.title}>
        <span class="dot {trustState(c!)}"></span><span>{c!.title}</span>
      </a>
      {#if editing.enabled}
        <RowMenu label={`Actions for ${c!.title}`} items={[
          { label: "Move or rename…", run: () => actions.open({ kind: "move-note", id: c!.id }) },
          { label: "Delete…", danger: true, run: () => actions.open({ kind: "delete-note", id: c!.id }) },
        ]} />
      {/if}
    </li>
  {/each}
</ul>
