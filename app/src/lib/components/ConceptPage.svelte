<script lang="ts">
  import { untrack } from "svelte";
  import { beforeNavigate } from "$app/navigation";
  import { learner, store } from "$lib/data.svelte.ts";
  import { EditSession, arriving, editing } from "$lib/edit.svelte.ts";
  import EditDetails from "./EditDetails.svelte";
  import NoteActions from "./NoteActions.svelte";
  import { render } from "$lib/markdown.ts";
  import KnowledgeLayout from "./KnowledgeLayout.svelte";
  import MetaPanel from "./MetaPanel.svelte";
  import Missing from "./Missing.svelte";
  import Prose from "./Prose.svelte";
  import Time from "./Time.svelte";
  import { tourHref } from "$lib/tours.ts";
  import { understanding } from "$lib/understanding.svelte.ts";

  let { id }: { id: string } = $props();

  // Editing replaces the page with the editor (loaded only then) and the
  // details panel with a form; both share one session.
  // A note just created opens straight in the editor. (This component is
  // made afresh for each note: the page keys it by id.)
  const arrived = untrack(() => arriving.edit !== null && arriving.edit === id);
  let session = $state<EditSession | null>(arrived ? untrack(() => new EditSession(id)) : null);
  if (arrived) arriving.edit = null;
  const loadEditor = () => import("./NoteEditor.svelte");
  const startEditing = () => { session = new EditSession(id); };

  // Leaving for another page asks first; closing or reloading the tab is the
  // browser's own question (NoteEditor), since pages cannot ask then.
  beforeNavigate((nav) => {
    if (nav.willUnload || !session?.dirty) return;
    if (!confirm("You have unsaved changes to this note. Leave anyway? (They are kept as a draft.)")) nav.cancel();
  });

  const c = $derived(store.concepts.get(id));
  // The body is refetched when the note or the data version changes.
  const body = $derived(c && store.version !== undefined ? store.body(id) : Promise.resolve(""));

  // Opening a note is recorded (on the server, once per version per half
  // hour) when the record is on: again when the note or its version changes,
  // not when the list of events does.
  $effect(() => {
    if (!c || !learner.enabled) return;
    const { id: cid, hash } = c;
    untrack(() => {
      const recent = learner.events.findLast((e) => e.event === "seen" && e.concept === cid);
      if (recent && recent.hash === hash && Date.now() - Date.parse(String(recent.at)) < 30 * 60e3) return;
      void learner.record({ event: "seen", concept: cid });
    });
  });
</script>

<svelte:head><title>{c ? `${c.title} · ${store.site.title}` : store.site.title}</title></svelte:head>

{#if !c}
  <Missing what={id} />
{:else}
  <KnowledgeLayout current={"k:" + id}>
    {#if session}
      {#await loadEditor()}
        <article class="doc editing"><p class="edit-message">Opening the editor…</p></article>
      {:then { default: NoteEditor }}
        <NoteEditor {session} onDone={() => (session = null)} />
      {:catch err}
        <!-- Usually rdstudio was updated while this page was open: its files changed. -->
        <article class="doc editing">
          <p class="edit-message bad">The editor did not load ({err.message}). Reload the page to get the current version; if that does not help, check the connection.</p>
          <button class="toggle" type="button" onclick={() => location.reload()}>Reload</button>
        </article>
      {/await}
    {:else}
      <article class="doc">
        <header class={["doc-head", understanding.cls(c.id)]}>
          <p class="doc-kind">
            <span>{c.type || "Concept"}</span>
            {#if c.status !== "stable"}<span class="chip">{c.status}</span>{/if}
            {#if c.generated_at}<span>Updated <Time iso={c.generated_at} /></span>{/if}
            {#if editing.enabled}
              <span class="note-actions">
                <button class="toggle edit-button" type="button" onclick={startEditing}>Edit</button>
                <NoteActions {c} />
              </span>
            {/if}
          </p>
          <h1>{c.title}</h1>
          {#if c.description}<p class="description">{c.description}</p>{/if}
          {#if c.type === "Tour"}<p class="tour-follow"><a class="toggle primary" href={tourHref(c.id)}>Follow this tour</a></p>{/if}
        </header>
        {#await body then text}<Prose html={render(text, { dir: c.directory })} />{/await}
      </article>
    {/if}
    {#snippet meta()}{#if session}<EditDetails {session} />{:else}<MetaPanel {c} />{/if}{/snippet}
  </KnowledgeLayout>
{/if}
