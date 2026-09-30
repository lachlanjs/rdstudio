<script lang="ts">
  import { store } from "$lib/data.svelte.ts";
  import { fmtDate } from "$lib/format.ts";

  const href = (path: string) => "#/r/" + path.split("/").map(encodeURIComponent).join("/");
</script>

<svelte:head><title>Reports · {store.site.title}</title></svelte:head>

<div class="page">
  <h1>Reports</h1>
  <p class="lede">Write-ups from agents after significant work, newest first.</p>
  {#if store.reports.length}
    <ul class="rows">
      {#each store.reports as r (r.path)}
        <li>
          <a class="title" href={href(r.path)}>{r.title}</a>
          <div class="sub">
            <span>{fmtDate(r.date)}</span>
            {#if r.author}<span>{r.author}</span>{/if}
            {#if r.activity}<span>{r.activity}</span>{/if}
            {#if r.links.length}<span>{r.links.length} linked concept{r.links.length > 1 ? "s" : ""}</span>{/if}
          </div>
          {#if r.description}<div class="desc">{r.description}</div>{/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">No reports yet. Agents write them to {store.site.reports}/ with the /report skill.</p>
  {/if}
</div>
