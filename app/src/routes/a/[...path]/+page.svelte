<script lang="ts">
  // An artifact on its own page (T76): the document in a sandboxed frame, with
  // what the app knows about it above: its title, its date, and the notes
  // that cite it. (The artifact itself says nothing the app reads.)
  import { page } from "$app/state";
  import { artifactSrc, mountArtifact } from "$lib/artifactFrame.ts";
  import { store } from "$lib/data.svelte.ts";
  import { conceptHref, fmtDate } from "$lib/format.ts";

  const path = $derived(page.params.path ?? "");
  const a = $derived(store.artifacts.find((x) => x.path === path));
  const notes = $derived([...new Set((a?.citedBy ?? []).map((c) => c.note))].map((id) => store.concepts.get(id)).filter((c) => c !== undefined));

  function frame(host: HTMLElement) {
    void path; void a; // mounted again for another artifact, or once the data has loaded
    const m = mountArtifact(host, path, { fit: "fill", eager: true });
    return () => m.destroy();
  }
</script>

<svelte:head><title>{a ? a.title : path} · {store.site.title}</title></svelte:head>

<div class="report-frame-wrap">
  <div class="report-bar">
    <a href="#/artifacts">All artifacts</a>
    <strong>{a ? a.title : path}</strong>
    {#if a}<span>{fmtDate(a.date)}</span>{/if}
    {#if a?.network}<span class="chip stale-note" title="It says it needs the network, so it does not work offline">Needs the network</span>{/if}
    {#if notes.length}
      <span class="artifact-cited">Cited by {#each notes as c, k (c.id)}<a href={conceptHref(c.id)}>{c.title}</a>{k < notes.length - 1 ? ", " : ""}{/each}</span>
    {/if}
    <a href={artifactSrc(path)} target="_blank" rel="noopener" style="margin-left:auto">Open on its own</a>
  </div>
  {#key path + (a ? "1" : "0")}<div class="artifact-page" {@attach frame}></div>{/key}
</div>
