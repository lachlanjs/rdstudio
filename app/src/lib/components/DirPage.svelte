<script lang="ts">
  import { store } from "$lib/data.svelte.ts";
  import { editing } from "$lib/edit.svelte.ts";
  import { conceptHref } from "$lib/format.ts";
  import { render } from "$lib/markdown.ts";
  import { dirLabel } from "$lib/tree.svelte.ts";
  import KnowledgeLayout from "./KnowledgeLayout.svelte";
  import Missing from "./Missing.svelte";
  import Prose from "./Prose.svelte";
  import Time from "./Time.svelte";

  let { id }: { id: string } = $props();

  const d = $derived(store.tree[id]);
  const overview = $derived(d?.overview ? store.concepts.get(d.overview) : undefined);
  const body = $derived(overview && store.version !== undefined ? store.body(overview.id) : Promise.resolve(""));
  // The generated OKF index, minus its frontmatter.
  const index = $derived(d ? d.index.replace(/^---\n[\s\S]*?\n---\n/, "") : "");
</script>

<svelte:head><title>{dirLabel(id)} · {store.site.title}</title></svelte:head>

{#if !d}
  <Missing what={id + "/"} />
{:else}
  <KnowledgeLayout current={id}>
    <article class="doc">
      {#if overview}
        <header class="doc-head">
          <p class="doc-kind"><a href={conceptHref(overview.id)}>Overview</a>
            {#if overview.generated_at}<span>Updated <Time iso={overview.generated_at} /></span>{/if}</p>
          <h1>{id ? dirLabel(id) : overview.title}</h1>
          {#if overview.description}<p class="description">{overview.description}</p>{/if}
        </header>
        {#await body then text}<Prose html={render(text, { dir: overview.directory })} />{/await}
        <hr />
      {:else}
        <header class="doc-head"><p class="doc-kind">Directory</p><h1>{dirLabel(id)}</h1></header>
      {/if}
      <Prose class="prose index" html={render(index, { dir: id })} />
    </article>
  </KnowledgeLayout>
{/if}
