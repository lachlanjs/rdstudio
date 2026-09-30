<script lang="ts">
  // Beside a note: trust, frontmatter, outline, study path and links.
  import type { ConceptRecord } from "@rdstudio/core";
  import { store } from "$lib/data.svelte.ts";
  import { conceptHref } from "$lib/format.ts";
  import { hasRequires, prerequisites } from "$lib/learn.ts";
  import FmValue from "./FmValue.svelte";
  import TrustBadge from "./TrustBadge.svelte";

  let { c }: { c: ConceptRecord } = $props();

  const HIDDEN_KEYS = new Set(["title", "description"]);
  const narrow = typeof matchMedia !== "undefined" && matchMedia("(max-width: 760px)").matches;
  const unique = (list: (ConceptRecord | undefined)[]) =>
    [...new Map(list.filter((x): x is ConceptRecord => Boolean(x)).map((x) => [x.id, x])).values()];

  const outline = $derived(c.headings.filter((x) => x.level <= 3));
  const back = $derived(unique(c.backlinks.map((id) => store.concepts.get(id))));
  const out = $derived(unique(c.links.filter((l) => l.kind === "concept" && !l.broken).map((l) => store.concepts.get(l.target))));
  const before = $derived(hasRequires() ? prerequisites(c.id) : null);
  const rows = $derived(Object.entries(c.meta).filter(([k]) => !HIDDEN_KEYS.has(k)));
</script>

{#snippet linkList(concepts: ConceptRecord[])}
  <ul class="linklist">{#each concepts as x (x.id)}<li><a href={conceptHref(x.id)}>{x.title}</a></li>{/each}</ul>
{/snippet}

{#snippet studyList(list: ConceptRecord[])}
  <ol class="linklist study">
    {#each list as p (p.id)}
      <li><a href={conceptHref(p.id)}>{p.title}</a>
        <span class="depth" title="The longest chain of prerequisites below this note">{p.depth ? `level ${p.depth}` : "start"}</span></li>
    {/each}
  </ol>
{/snippet}

<aside class="meta" aria-label="Details">
  <div class="meta-inner">
    <h2>Trust</h2>
    <TrustBadge {c} />
    {#if c.verification_stale}<p class="section-note">Meaningfully edited after the last human review.</p>{/if}
    <details class="fm-wrap" open={!narrow}>
      <summary>Frontmatter</summary>
      <h2>Frontmatter</h2>
      <table class="fm"><tbody>
        {#each rows as [k, v] (k)}<tr><th scope="row">{k}</th><td><FmValue value={v} /></td></tr>{/each}
      </tbody></table>
    </details>
    {#if outline.length > 1}
      <h2>On this page</h2>
      <ul class="outline">
        {#each outline as x, i (i)}
          <!-- The address is the route (hash routing), so these links scroll by
               script instead, like in-page links in rendered notes (wireAnchors). -->
          <!-- svelte-ignore a11y_invalid_attribute -->
          <li class="l{x.level}"><a href="javascript:void(0)" data-anchor={"h-" + x.slug}>{x.text}</a></li>
        {/each}
      </ul>
    {/if}
    {#if before}
      <h2>Study path</h2>
      {#if !before.length}
        <p class="section-note">Nothing is marked as required before this note.</p>
      {:else}
        <p class="section-note">{before.length} {before.length === 1 ? "note comes" : "notes come"} before this one.
          <a href={"#/path/" + encodeURIComponent(c.id)}>Show on map</a></p>
        {#if before.length > 8}
          <details><summary>In reading order</summary>{@render studyList(before)}</details>
        {:else}
          {@render studyList(before)}
        {/if}
      {/if}
    {/if}
    {#if back.length}<h2>Linked from</h2>{@render linkList(back)}{/if}
    {#if out.length}<h2>Links to</h2>{@render linkList(out)}{/if}
  </div>
</aside>
