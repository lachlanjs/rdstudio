<script lang="ts">
  import Time from "$lib/components/Time.svelte";
  import { store } from "$lib/data.svelte.ts";
  import { graphOf } from "$lib/flow.ts";
  import { procedures, type Proposal } from "$lib/review.ts";

  const list = $derived(procedures());
  const href = (id: string) => "#/p/" + id.split("/").map(encodeURIComponent).join("/");
</script>

<svelte:head><title>Procedures · {store.site.title}</title></svelte:head>

<div class="page">
  <h1>Procedures</h1>
  <p class="lede">Repeated processes recorded as graphs of steps. Agents follow them one step at a time and propose improvements.</p>
  {#if list.length}
    <ul class="rows">
      {#each list as c (c.id)}
        {@const g = graphOf(c)}
        {@const pending = ((c.meta.proposals as Proposal[] | undefined) ?? []).filter((p) => p.state === "pending").length}
        <li>
          <a class="title" href={href(c.id)}>{c.title}</a>
          <div class="sub">
            <span>{g.nodes.size} steps</span><span>{g.edges.length} transitions</span>
            {#if pending}<span>{pending} proposed change{pending > 1 ? "s" : ""}</span>{/if}
            {#if c.generated_at}<span>updated <Time iso={c.generated_at} /></span>{/if}
          </div>
          {#if c.description}<div class="desc">{c.description}</div>{/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">No procedures recorded yet. Record one as a concept with type: Procedure.</p>
  {/if}
</div>
