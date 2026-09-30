<script lang="ts">
  // Reading order from requires links, and the private learner record.
  import { learner, store } from "$lib/data.svelte.ts";
  import { conceptHref, titleCase } from "$lib/format.ts";
  import { hasRequires } from "$lib/learn.ts";

  const folderLabel = (dir: string) => (dir ? dir.split("/").map((p) => titleCase(p.replace(/[-_]/g, " "))).join(" / ") : "Top level");
  const notes = $derived([...store.concepts.values()].filter((c) => c.type !== "Tour").sort((a, b) => a.order - b.order));
</script>

<svelte:head><title>Learn · {store.site.title}</title></svelte:head>

<div class="page">
  <h1>Learn</h1>
  <p class="lede">A reading order for this knowledge base, from the links rated requires: each note comes after everything it needs.</p>
  <h2 class="section-h">Reading order</h2>
  {#if hasRequires()}
    <p class="section-note">Notes stay with their folder where they can. The level is the longest chain of prerequisites below a note; path shows that chain on the map.</p>
    <ol class="reading">
      {#each notes as c, i (c.id)}
        {#if i === 0 || c.directory !== notes[i - 1]!.directory}<li class="folder" aria-hidden="true">{folderLabel(c.directory)}</li>{/if}
        <li class="step" value={c.order + 1}>
          <a href={conceptHref(c.id)} title={c.description || c.title}>{c.title}</a>
          <span class="depth" title="The longest chain of prerequisites below this note">{c.depth ? `level ${c.depth}` : "start"}</span>
          {#if c.depth}<a class="path-link" href={"#/path/" + encodeURIComponent(c.id)} title="Study path to {c.title} on the map">path</a>{/if}
        </li>
      {/each}
    </ol>
  {:else}
    <p class="empty">No links are rated requires yet, so there is no order to give. Rate a link by giving it the title "requires", as in [Topology](/topology.md "requires").</p>
  {/if}
  <h2 class="section-h">Your learner record</h2>
  {#if store.site.static}
    <p class="section-note">This is an exported snapshot, so nothing you do here is recorded.</p>
  {:else if !learner.enabled}
    <p class="section-note">Off. When it is on, rdstudio keeps a private record of what you study in this project, outside the repository, for the exercises and review to come. To turn it on, add this to ~/.config/rdstudio/config.toml and restart rdstudio serve:</p>
    <pre>[learner]
enabled = true</pre>
  {:else}
    <p class="section-note">On. {learner.events.length} {learner.events.length === 1 ? "event" : "events"}, stored privately in <code>{learner.dir}</code>. Only you see it; it is never part of the project or an export.</p>
  {/if}
</div>
