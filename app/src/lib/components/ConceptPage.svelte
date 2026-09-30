<script lang="ts">
  import { untrack } from "svelte";
  import { learner, store } from "$lib/data.svelte.ts";
  import { render } from "$lib/markdown.ts";
  import KnowledgeLayout from "./KnowledgeLayout.svelte";
  import MetaPanel from "./MetaPanel.svelte";
  import Missing from "./Missing.svelte";
  import Prose from "./Prose.svelte";
  import Time from "./Time.svelte";

  let { id }: { id: string } = $props();

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
    <article class="doc">
      <header class="doc-head">
        <p class="doc-kind">
          <span>{c.type || "Concept"}</span>
          {#if c.status !== "stable"}<span class="chip">{c.status}</span>{/if}
          {#if c.generated_at}<span>Updated <Time iso={c.generated_at} /></span>{/if}
        </p>
        <h1>{c.title}</h1>
        {#if c.description}<p class="description">{c.description}</p>{/if}
      </header>
      {#await body then text}<Prose html={render(text, { dir: c.directory })} />{/await}
    </article>
    {#snippet meta()}<MetaPanel {c} />{/snippet}
  </KnowledgeLayout>
{/if}
