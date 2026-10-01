<script lang="ts">
  // On a folder's page: a new note in it, a new folder inside it (a new
  // bubble on the map, described by its overview note), and moving or
  // deleting the folder itself.
  import { goto } from "$app/navigation";
  import { store } from "$lib/data.svelte.ts";
  import { arriving, createNote, deleteFolderAt, moveFolderTo, slug } from "$lib/edit.svelte.ts";
  import { conceptHref, dirHref } from "$lib/format.ts";
  import { dirLabel } from "$lib/tree.svelte.ts";
  import Dialog from "./Dialog.svelte";

  let { id }: { id: string } = $props(); // the folder; "" is the root

  let open = $state<"note" | "folder" | "move" | "delete" | null>(null);
  let busy = $state(false);
  let error = $state("");
  let title = $state("");
  let type = $state("");
  let description = $state("");
  // The file or folder name follows the title until it is typed by hand.
  let typedName = $state<string | null>(null);
  const name = $derived(typedName ?? slug(title));
  let path = $state("");

  const notesHere = $derived([...store.concepts.values()].filter((c) => c.directory === id || c.directory.startsWith(id + "/")));
  const types = $derived([...new Set([...store.concepts.values()].map((c) => c.type).filter(Boolean))].sort());
  // The type most used in this folder (else anywhere) is offered first.
  const usualType = $derived.by(() => {
    const counts = new Map<string, number>(); // local to this calculation, not state
    const pool = notesHere.length ? notesHere : [...store.concepts.values()];
    for (const c of pool) if (c.type && c.type.toLowerCase() !== "overview") counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Note";
  });
  const prefix = $derived(id ? id + "/" : "");
  const folders = $derived(Object.keys(store.tree).filter(Boolean).sort());

  function start(which: NonNullable<typeof open>) {
    error = "";
    title = description = "";
    typedName = null;
    type = usualType;
    path = id;
    open = which;
  }

  async function run(act: () => Promise<void>) {
    busy = true;
    error = "";
    try { await act(); open = null; } catch (err) { error = (err as Error).message; } finally { busy = false; }
  }

  const newNote = () => run(async () => {
    if (!title.trim()) throw new Error("Give the note a title.");
    if (!name) throw new Error("Give the note a file name.");
    const note = await createNote(prefix + name, { type: type.trim() || "Note", title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}) });
    arriving.edit = note.id; // straight into writing it
    await goto(conceptHref(note.id));
  });

  const newFolder = () => run(async () => {
    if (!title.trim()) throw new Error("Give the folder a name.");
    if (!name) throw new Error("Give the folder a name made of letters or digits.");
    if (store.tree[prefix + name]) throw new Error(`There is already a folder ${prefix + name}.`);
    // A folder is made by its first note: an overview, which describes it.
    await createNote(`${prefix}${name}/overview`, { type: "Overview", title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}) });
    await goto(dirHref(prefix + name));
  });

  const moveFolder = () => run(async () => {
    const to = path.trim().replace(/^\/+|\/+$/g, "");
    if (!to) throw new Error("Give the folder a name.");
    if (to === id) { open = null; return; }
    await moveFolderTo(id, to);
    await goto(dirHref(to));
  });

  const removeFolder = () => run(async () => {
    const parent = id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : "";
    await deleteFolderAt(id);
    await goto(dirHref(parent));
    await store.refresh();
  });
</script>

<div class="folder-actions toggles">
  <button class="toggle" type="button" onclick={() => start("note")}>New note</button>
  <button class="toggle" type="button" onclick={() => start("folder")}>New folder</button>
  {#if id}
    <button class="toggle" type="button" onclick={() => start("move")}>Move</button>
    {#if !notesHere.length}<button class="toggle quiet" type="button" onclick={() => start("delete")}>Delete</button>{/if}
  {/if}
</div>

{#if open === "note"}
  <Dialog title={id ? `New note in ${dirLabel(id)}` : "New note"} action="Create and edit" {busy} {error} onsubmit={newNote} onclose={() => (open = null)}>
    <label>Title
      <!-- svelte-ignore a11y_autofocus -->
      <input type="text" bind:value={title} autofocus required />
    </label>
    <label>Type
      <input type="text" list="new-types" bind:value={type} required />
    </label>
    <datalist id="new-types">{#each types as t (t)}<option value={t}></option>{/each}</datalist>
    <label>Description <span class="optional">(optional)</span>
      <textarea rows="2" bind:value={description}></textarea>
      <span class="hint">One sentence: what the note says, shown in lists and on the map.</span>
    </label>
    <label>File name
      <input type="text" value={name} oninput={(e) => (typedName = e.currentTarget.value)}
        autocapitalize="off" autocomplete="off" spellcheck="false" />
      <span class="hint">{prefix}{name || "…"}.md</span>
    </label>
  </Dialog>
{:else if open === "folder"}
  <Dialog title={id ? `New folder in ${dirLabel(id)}` : "New folder"} action="Create" {busy} {error} onsubmit={newFolder} onclose={() => (open = null)}>
    <label>Name
      <!-- svelte-ignore a11y_autofocus -->
      <input type="text" bind:value={title} autofocus required />
      <span class="hint">{prefix}{name || "…"}/</span>
    </label>
    <label>Description <span class="optional">(optional)</span>
      <textarea rows="2" bind:value={description}></textarea>
      <span class="hint">What belongs here. It becomes the folder's overview note, and shows on the map.</span>
    </label>
  </Dialog>
{:else if open === "move"}
  <Dialog title={`Move or rename ${dirLabel(id)}`} action="Move" {busy} {error} onsubmit={moveFolder} onclose={() => (open = null)}>
    <label>New place
      <input type="text" list="move-folder-to" bind:value={path} autocapitalize="off" autocomplete="off" spellcheck="false" />
      <span class="hint">Such as {id.includes("/") ? id.slice(0, id.lastIndexOf("/")) + "/" : ""}new-name, or other-folder/{id.split("/").pop()}.</span>
    </label>
    <datalist id="move-folder-to">{#each folders as f (f)}<option value={f + "/" + id.split("/").pop()}></option>{/each}</datalist>
    <p class="section-note">Everything in it moves too ({notesHere.length} {notesHere.length === 1 ? "note" : "notes"}), and links to them are updated.</p>
  </Dialog>
{:else if open === "delete"}
  <Dialog title={`Delete the folder ${dirLabel(id)}?`} action="Delete" danger {busy} {error} onsubmit={removeFolder} onclose={() => (open = null)}>
    <p>It holds no notes.</p>
  </Dialog>
{/if}
