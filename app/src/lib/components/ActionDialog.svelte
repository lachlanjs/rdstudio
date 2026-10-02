<script lang="ts">
  // The dialog for one action (lib/actions.svelte.ts): a new note or folder,
  // moving or renaming a note or folder (links follow), and deleting one,
  // which says what goes and what breaks and asks to be confirmed twice.
  // ActionDialogs makes a fresh one for each action, so the fields start anew.
  import { untrack } from "svelte";
  import type { ConceptRecord } from "@rdstudio/core";
  import type { Action } from "$lib/actions.svelte.ts";
  import { goto } from "$app/navigation";
  import { actions } from "$lib/actions.svelte.ts";
  import { store } from "$lib/data.svelte.ts";
  import { arriving, createNote, deleteFolderAt, deleteNoteAt, moveFolderTo, moveNoteTo, slug } from "$lib/edit.svelte.ts";
  import { conceptHref, dirHref } from "$lib/format.ts";
  import { dirLabel } from "$lib/tree.svelte.ts";
  import Dialog from "./Dialog.svelte";

  let { a }: { a: Action } = $props();
  const start = untrack(() => a); // this dialog is for one action

  let busy = $state(false);
  let error = $state("");
  let confirmed = $state(false);
  let title = $state("");
  let type = $state(start.kind === "new-note" ? usualType(start.folder) : "");
  let description = $state("");
  // The file name follows the title until it is typed (or, moving, is the current one).
  let typedName = $state<string | null>(start.kind === "move-note" ? start.id.split("/").pop() ?? "" : null);
  const name = $derived(typedName ?? slug(title));
  let folder = $state(start.kind === "move-note" ? store.concepts.get(start.id)?.directory ?? "" : ""); // moving a note: its folder
  let path = $state(start.kind === "move-folder" ? start.id : ""); // moving a folder: its new place

  const parentOf = (id: string) => (id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : "");
  const prefixOf = (f: string) => (f ? f + "/" : "");
  const notesUnder = (f: string) => [...store.concepts.values()].filter((c) => c.directory === f || c.directory.startsWith(f + "/"));
  const byId = (ids: string[]) => ids.map((id) => store.concepts.get(id)).filter((x): x is ConceptRecord => Boolean(x));
  const types = $derived([...new Set([...store.concepts.values()].map((c) => c.type).filter(Boolean))].sort());
  const folders = $derived(Object.keys(store.tree).filter(Boolean).sort());

  /** The type most used in the folder (else anywhere), offered first. */
  function usualType(f: string): string {
    const notesUnder = (d: string) => [...store.concepts.values()].filter((c) => c.directory === d || c.directory.startsWith(d + "/"));
    const counts: Record<string, number> = {};
    const here = notesUnder(f);
    for (const c of here.length ? here : [...store.concepts.values()]) {
      if (c.type && c.type.toLowerCase() !== "overview") counts[c.type] = (counts[c.type] ?? 0) + 1;
    }
    return Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0] ?? "Note";
  }

  // What a delete takes with it, and what it breaks.
  const doomed = $derived(a.kind === "delete-folder" ? notesUnder(a.id) : a.kind === "delete-note" ? byId([a.id]) : []);
  const breaks = $derived.by(() => {
    const gone = new Set(doomed.map((c) => c.id));
    return byId([...new Set(doomed.flatMap((c) => c.backlinks))].filter((id) => !gone.has(id)));
  });

  async function run(act: () => Promise<void>) {
    busy = true;
    error = "";
    try {
      await act();
      actions.close();
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  const submit = () => {
    if (a.kind === "new-note") return run(async () => {
      if (!title.trim()) throw new Error("Give the note a title.");
      if (!name) throw new Error("Give the note a file name.");
      const note = await createNote(prefixOf(a.folder) + name, { type: type.trim() || "Note", title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}) });
      arriving.edit = note.id; // straight into writing it
      await goto(conceptHref(note.id));
    });
    if (a.kind === "new-folder") return run(async () => {
      if (!title.trim()) throw new Error("Give the folder a name.");
      if (!name) throw new Error("Give the folder a name made of letters or digits.");
      const id = prefixOf(a.folder) + name;
      if (store.tree[id]) throw new Error(`There is already a folder ${id}.`);
      // A folder is made by its first note: an overview, which describes it.
      await createNote(`${id}/overview`, { type: "Overview", title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}) });
      await goto(a.from === "map" ? `#/map/${id.split("/").map(encodeURIComponent).join("/")}` : dirHref(id));
    });
    if (a.kind === "move-note") return run(async () => {
      if (!name.trim()) throw new Error("Give the note a file name.");
      const to = prefixOf(folder.trim().replace(/^\/+|\/+$/g, "")) + name.trim();
      if (to === a.id) return;
      const r = await moveNoteTo(a.id, to);
      await goto(conceptHref(r.moved[0]?.to ?? to));
    });
    if (a.kind === "move-folder") return run(async () => {
      const to = path.trim().replace(/^\/+|\/+$/g, "");
      if (!to) throw new Error("Give the folder a name.");
      if (to === a.id) return;
      await moveFolderTo(a.id, to);
      await goto(dirHref(to));
    });
    if (a.kind === "delete-note") return run(async () => {
      const c = store.concepts.get(a.id);
      await deleteNoteAt(a.id);
      // Leave the note's page before the data reloads without it.
      if (location.hash.startsWith(conceptHref(a.id))) await goto(dirHref(c?.directory ?? ""));
      await store.refresh();
    });
    if (a.kind === "delete-folder") return run(async () => {
      await deleteFolderAt(a.id, doomed.length > 0);
      const here = decodeURIComponent(location.hash);
      if (here.startsWith("#/d/" + a.id) || here.startsWith("#/k/" + a.id + "/")) await goto(dirHref(parentOf(a.id)));
      await store.refresh();
    });
  };
</script>

{#snippet confirm(what: string)}
  <label class="confirm">
    <input type="checkbox" bind:checked={confirmed} />
    <span>Yes, delete {what}</span>
  </label>
{/snippet}

{#if a.kind === "new-note"}
  <Dialog title={a.folder ? `New note in ${dirLabel(a.folder)}` : "New note"} action="Create and edit" {busy} {error} onsubmit={submit} onclose={() => actions.close()}>
    <label>Title
      <!-- svelte-ignore a11y_autofocus -->
      <input type="text" bind:value={title} autofocus required />
    </label>
    <label>Type
      <input type="text" list="action-types" bind:value={type} required />
    </label>
    <datalist id="action-types">{#each types as t (t)}<option value={t}></option>{/each}</datalist>
    <label>Description <span class="optional">(optional)</span>
      <textarea rows="2" bind:value={description}></textarea>
      <span class="hint">One sentence: what the note says, shown in lists and on the map.</span>
    </label>
    <label>File name
      <input type="text" value={name} oninput={(e) => (typedName = e.currentTarget.value)} autocapitalize="off" autocomplete="off" spellcheck="false" />
      <span class="hint">{prefixOf(a.folder)}{name || "…"}.md</span>
    </label>
  </Dialog>
{:else if a.kind === "new-folder"}
  <Dialog title={a.folder ? `New folder in ${dirLabel(a.folder)}` : "New folder"} action="Create" {busy} {error} onsubmit={submit} onclose={() => actions.close()}>
    <label>Name
      <!-- svelte-ignore a11y_autofocus -->
      <input type="text" bind:value={title} autofocus required />
      <span class="hint">{prefixOf(a.folder)}{name || "…"}/</span>
    </label>
    <label>Description <span class="optional">(optional)</span>
      <textarea rows="2" bind:value={description}></textarea>
      <span class="hint">What belongs here. It becomes the folder's overview note, and shows on the map.</span>
    </label>
  </Dialog>
{:else if a.kind === "move-note"}
  {@const c = store.concepts.get(a.id)}
  <Dialog title={`Move or rename “${c?.title ?? a.id}”`} action="Move" {busy} {error} onsubmit={submit} onclose={() => actions.close()}>
    <label>Folder
      <input type="text" list="action-folders" bind:value={folder} autocapitalize="off" autocomplete="off" spellcheck="false" />
      <span class="hint">A folder that does not exist yet is made.</span>
    </label>
    <datalist id="action-folders">{#each folders as f (f)}<option value={f}>{dirLabel(f)}</option>{/each}</datalist>
    <label>File name
      <input type="text" value={name} oninput={(e) => (typedName = e.currentTarget.value)} autocapitalize="off" autocomplete="off" spellcheck="false" />
      <span class="hint">Without .md.{#if c}<button class="link" type="button" onclick={() => (typedName = slug(c.title))}>From the title</button>{/if}</span>
    </label>
    <p class="section-note">
      {#if c?.backlinks.length}Links to it in {c.backlinks.length} {c.backlinks.length === 1 ? "note are" : "notes are"} updated to the new place.
      {:else}No other note links to it.{/if}
    </p>
  </Dialog>
{:else if a.kind === "move-folder"}
  <Dialog title={`Move or rename ${dirLabel(a.id)}`} action="Move" {busy} {error} onsubmit={submit} onclose={() => actions.close()}>
    <label>New place
      <input type="text" list="action-folder-to" bind:value={path} autocapitalize="off" autocomplete="off" spellcheck="false" />
      <span class="hint">Such as {prefixOf(parentOf(a.id))}new-name, or other-folder/{a.id.split("/").pop()}.</span>
    </label>
    <datalist id="action-folder-to">{#each folders as f (f)}<option value={f + "/" + a.id.split("/").pop()}></option>{/each}</datalist>
    <p class="section-note">Everything in it moves too ({notesUnder(a.id).length} {notesUnder(a.id).length === 1 ? "note" : "notes"}), and links to them are updated.</p>
  </Dialog>
{:else if a.kind === "delete-note"}
  {@const c = store.concepts.get(a.id)}
  <Dialog title={`Delete “${c?.title ?? a.id}”?`} action="Delete" danger disabled={!confirmed} {busy} {error} onsubmit={submit} onclose={() => actions.close()}>
    <p class="warning">This deletes the note's file from the knowledge base.</p>
    {#if breaks.length}
      <p>These notes link to it; their links will be broken, and the check lists them until they are fixed:</p>
      <ul class="linklist">{#each breaks as x (x.id)}<li>{x.title}</li>{/each}</ul>
    {:else}
      <p>No other note links to it.</p>
    {/if}
    <p class="section-note">If the project is in git, the last committed version can be brought back from there.</p>
    {@render confirm("this note")}
  </Dialog>
{:else if a.kind === "delete-folder"}
  <Dialog title={`Delete the folder ${dirLabel(a.id)}?`} action="Delete" danger disabled={!confirmed} {busy} {error} onsubmit={submit} onclose={() => actions.close()}>
    {#if doomed.length}
      <p class="warning">This deletes the folder and the {doomed.length === 1 ? "note" : `${doomed.length} notes`} in it:</p>
      <ul class="linklist doomed">{#each doomed as x (x.id)}<li>{x.title} <span class="faint">{x.id}</span></li>{/each}</ul>
      {#if breaks.length}
        <p>These notes elsewhere link into it; their links will be broken:</p>
        <ul class="linklist">{#each breaks as x (x.id)}<li>{x.title}</li>{/each}</ul>
      {/if}
      <p class="section-note">If the project is in git, the last committed versions can be brought back from there.</p>
      {@render confirm(doomed.length === 1 ? "the folder and its note" : `the folder and its ${doomed.length} notes`)}
    {:else}
      <p>It holds no notes.</p>
      {@render confirm("this folder")}
    {/if}
  </Dialog>
{/if}
