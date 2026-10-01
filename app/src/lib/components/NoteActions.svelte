<script lang="ts">
  // Beside Edit on a note: moving or renaming it (links to it follow), and
  // deleting it (after saying which notes link to it).
  import type { ConceptRecord } from "@rdstudio/core";
  import { goto } from "$app/navigation";
  import { store } from "$lib/data.svelte.ts";
  import { deleteNoteAt, moveNoteTo, slug } from "$lib/edit.svelte.ts";
  import { conceptHref, dirHref } from "$lib/format.ts";
  import { dirLabel } from "$lib/tree.svelte.ts";
  import Dialog from "./Dialog.svelte";

  let { c }: { c: ConceptRecord } = $props();

  let open = $state<"move" | "delete" | null>(null);
  let busy = $state(false);
  let error = $state("");
  let folder = $state("");
  let name = $state("");

  const folders = $derived(Object.keys(store.tree).sort());
  const linkedFrom = $derived(c.backlinks.map((id) => store.concepts.get(id)).filter((x): x is ConceptRecord => Boolean(x)));
  const target = $derived(`${folder.trim().replace(/^\/+|\/+$/g, "")}${folder.trim() ? "/" : ""}${name.trim()}`);

  function start(which: "move" | "delete") {
    error = "";
    folder = c.directory;
    name = c.id.split("/").pop() ?? "";
    open = which;
  }

  async function run(act: () => Promise<void>) {
    busy = true;
    error = "";
    try { await act(); open = null; } catch (err) { error = (err as Error).message; } finally { busy = false; }
  }

  const move = () => run(async () => {
    if (!name.trim()) throw new Error("Give the note a file name.");
    if (target === c.id) { open = null; return; }
    const r = await moveNoteTo(c.id, target);
    await goto(conceptHref(r.moved[0]?.to ?? target));
  });

  const remove = () => run(async () => {
    const folder = c.directory;
    await deleteNoteAt(c.id);
    await goto(dirHref(folder));
    await store.refresh();
  });
</script>

<button class="toggle" type="button" onclick={() => start("move")}>Move</button>
<button class="toggle quiet" type="button" onclick={() => start("delete")}>Delete</button>

{#if open === "move"}
  <Dialog title="Move or rename" action="Move" {busy} {error} onsubmit={move} onclose={() => (open = null)}>
    <label>Folder
      <input type="text" list="move-folders" bind:value={folder} autocapitalize="off" autocomplete="off" spellcheck="false" />
      <span class="hint">A folder that does not exist yet is made.</span>
    </label>
    <datalist id="move-folders">{#each folders as f (f)}<option value={f}>{dirLabel(f)}</option>{/each}</datalist>
    <label>File name
      <input type="text" bind:value={name} autocapitalize="off" autocomplete="off" spellcheck="false" />
      <span class="hint">Without .md. <button class="link" type="button" onclick={() => (name = slug(c.title))}>From the title</button></span>
    </label>
    <p class="section-note">
      {#if linkedFrom.length}Links to it in {linkedFrom.length} {linkedFrom.length === 1 ? "note are" : "notes are"} updated to the new place.
      {:else}No other note links to it.{/if}
    </p>
  </Dialog>
{:else if open === "delete"}
  <Dialog title={`Delete “${c.title}”?`} action="Delete" danger {busy} {error} onsubmit={remove} onclose={() => (open = null)}>
    {#if linkedFrom.length}
      <p>These notes link to it; their links will be broken, and the check lists them until they are fixed:</p>
      <ul class="linklist">{#each linkedFrom as x (x.id)}<li>{x.title}</li>{/each}</ul>
    {:else}
      <p>No other note links to it.</p>
    {/if}
    <p class="section-note">The file is deleted from the knowledge base. If the project is in git, the last committed version can be brought back from there.</p>
  </Dialog>
{/if}
