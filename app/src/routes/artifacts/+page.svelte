<script lang="ts">
  // Artifacts (T76): the HTML documents in the knowledge folders, newest first.
  import { artifactHref } from "$lib/artifactFrame.ts";
  import { store } from "$lib/data.svelte.ts";
  import { dirHref, fmtDate } from "$lib/format.ts";
</script>

<svelte:head><title>Artifacts · {store.site.title}</title></svelte:head>

<div class="page">
  <h1>Artifacts</h1>
  <p class="lede">Interactive pages kept beside the notes: figures, simulations, tables and write-ups that Markdown cannot hold. Notes link to them or show them in place.</p>
  {#if store.artifacts.length}
    <ul class="rows">
      {#each store.artifacts as a (a.path)}
        <li>
          <a class="title" href={artifactHref(a.path)}>{a.title}</a>
          <div class="sub">
            <span>{fmtDate(a.date)}</span>
            {#if a.author}<span>{a.author}</span>{/if}
            <a href={dirHref(a.directory)}>{a.directory || "the top folder"}</a>
            <span>{a.citedBy.length ? `cited by ${new Set(a.citedBy.map((c) => c.note)).size} note${new Set(a.citedBy.map((c) => c.note)).size > 1 ? "s" : ""}` : "not cited yet"}</span>
            {#if a.network}<span>needs the network</span>{/if}
          </div>
          {#if a.description}<div class="desc">{a.description}</div>{/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">No artifacts yet. An artifact is an .html file in any folder of {store.site.knowledge}/, linked from a note as [title](file.html) or shown in it as ![caption](file.html).</p>
  {/if}
</div>
