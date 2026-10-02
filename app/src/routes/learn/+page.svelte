<script lang="ts">
  // Reading order from requires links, and the private learner record.
  import { learner, store } from "$lib/data.svelte.ts";
  import { conceptHref, titleCase } from "$lib/format.ts";
  import { hasRequires } from "$lib/learn.ts";
  import { sharedTours, tourHref } from "$lib/tours.ts";

  const folderLabel = (dir: string) => (dir ? dir.split("/").map((p) => titleCase(p.replace(/[-_]/g, " "))).join(" / ") : "Top level");
  const shared = $derived(sharedTours());
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
  <h2 class="section-h">Practice</h2>
  <p class="section-note">Short rounds of exercises, checked here: recall with a self-grade, fill the gap, placement, and naming the landmarks.</p>
  <p><a class="toggle" href="#/practice">Practise</a></p>
  <h2 class="section-h">Tours</h2>
  <p class="section-note">Walks through the notes in a chosen order, with a sentence at each stop. Following one shows its route on the map. Tours are kept off the map and graph.</p>
  {#if shared.length}
    <ul class="rows tours">
      {#each shared as t (t.id)}
        <li><a class="title" href={tourHref(t.id)}>{t.title}</a>{#if t.description}<div class="desc">{t.description}</div>{/if}
          <div class="sub"><a href={tourHref(t.id)}>Follow</a><a href={conceptHref(t.id)}>Read as a note</a></div></li>
      {/each}
    </ul>
  {/if}
  {#if learner.enabled}
    <h3 class="sub-h">Your tours</h3>
    {#if learner.tours.length}
      <ul class="rows tours">
        {#each learner.tours as t (t.name)}
          <li><a class="title" href={tourHref("~" + t.name)}>{t.title}</a>{#if t.description}<div class="desc">{t.description}</div>{/if}
            <div class="sub"><a href={tourHref("~" + t.name)}>Follow</a><a href={"#/tours/" + t.name}>Edit</a><span>private</span></div></li>
        {/each}
      </ul>
    {:else}
      <p class="empty">None yet. Writing a tour is a good way to find out what you know about a part of the map.</p>
    {/if}
    <p><a class="toggle" href="#/tours/new">Write a tour</a></p>
  {:else if !shared.length}
    <p class="empty">No tours yet. Shared tours are notes of type Tour; with the learner record on you can write your own.</p>
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
