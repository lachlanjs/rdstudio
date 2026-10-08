<script lang="ts">
  // Beside a note, its companion (T56, sketch MarginaliaNote): your
  // understanding, explain it back, trust, what to read first in order; then,
  // folded, the frontmatter, the outline and the links.
  import type { ConceptRecord } from "@rdstudio/core";
  import { isStudyNote } from "@rdstudio/core/learning";
  import { store } from "$lib/data.svelte.ts";
  import { conceptHref } from "$lib/format.ts";
  import { hasRequires, prerequisites } from "$lib/learn.ts";
  import FmValue from "./FmValue.svelte";
  import TrustBadge from "./TrustBadge.svelte";
  import YourUnderstanding from "./YourUnderstanding.svelte";
  import ExplainBack from "./ExplainBack.svelte";
  import Time from "./Time.svelte";
  import { STATE_LABEL } from "$lib/understanding.svelte.ts";
  import { understanding } from "$lib/understanding.svelte.ts";
  import { editing, verifyNote } from "$lib/edit.svelte.ts";

  let { c }: { c: ConceptRecord } = $props();

  // Marking the note as checked, from its own page (T105).
  let checking = $state(false), checkFailed = $state("");
  async function check() {
    checking = true; checkFailed = "";
    try { await verifyNote(c.id); } catch (err) { checkFailed = err instanceof Error ? err.message : String(err); }
    checking = false;
  }

  const HIDDEN_KEYS = new Set(["title", "description"]);
  const narrow = typeof matchMedia !== "undefined" && matchMedia("(max-width: 760px)").matches;
  const unique = (list: (ConceptRecord | undefined)[]) =>
    [...new Map(list.filter((x): x is ConceptRecord => Boolean(x)).map((x) => [x.id, x])).values()];

  const outline = $derived(c.headings.filter((x) => x.level <= 3));
  const back = $derived(unique(c.backlinks.map((id) => store.concepts.get(id))));
  const out = $derived(unique(c.links.filter((l) => l.kind === "concept" && !l.broken).map((l) => store.concepts.get(l.target))));
  const before = $derived(hasRequires() ? prerequisites(c.id) : null);
  const rows = $derived(Object.entries(c.meta).filter(([k]) => !HIDDEN_KEYS.has(k)));
  // Who wrote it, from the provenance in its frontmatter (generated.by).
  const provenance = $derived.by(() => {
    const g = c.meta?.generated;
    const by = g && typeof g === "object" && "by" in g ? String((g as { by?: unknown }).by ?? "") : "";
    return `${c.generated_at ? "Written" : "Added"}${by ? (by.startsWith("human:") ? " by a person" : " by an agent") : ""}`;
  });
</script>

{#snippet linkList(concepts: ConceptRecord[])}
  <ul class="linklist">{#each concepts as x (x.id)}<li><a href={conceptHref(x.id)}>{x.title}</a></li>{/each}</ul>
{/snippet}

{#snippet studyList(list: ConceptRecord[])}
  <ol class="pre">
    {#each list as p, i (p.id)}
      {@const st = understanding.state(p.id)}
      <li><span class="n">{i + 1}</span><a href={conceptHref(p.id)}>{p.title}</a><span class="caption">{st ? STATE_LABEL[st.state].toLowerCase() : p.depth ? `level ${p.depth}` : "start"}</span></li>
    {/each}
  </ol>
{/snippet}

<aside class="meta companion" aria-label="Companion">
  <div class="meta-inner">
    {#if understanding.on && isStudyNote(c)}<YourUnderstanding {c} />{/if}
    {#if understanding.on && isStudyNote(c)}<div class="blk"><ExplainBack {c} /></div>{/if}
    <div class="blk">
      <div class="kind-row"><span class="kind">Trust</span><TrustBadge {c} /></div>
      <p class="small">{provenance}{#if c.generated_at} on <Time iso={c.generated_at} rel={false} />{/if}. {c.trust === "human-reviewed" ? "Reviewed by a person." : c.trust === "machine-confirmed" ? "Checked by a machine, not yet by a person." : "Not yet reviewed by a person."}{c.verification_stale ? " Meaningfully edited after the last review." : ""}</p>
      {#if editing.enabled && (c.trust !== "human-reviewed" || c.verification_stale)}
        <p class="small"><button class="toggle check-note" type="button" disabled={checking} onclick={check}>{checking ? "Marking…" : "Mark as checked"}</button>
          <span class="caption">Says you have read this and it is right; recorded as {store.site.human || "you"}.</span></p>
        {#if checkFailed}<p class="small" role="alert">{checkFailed}</p>{/if}
      {/if}
    </div>
    {#if before}
      <div class="blk">
        <div class="kind-row"><span class="kind">Read these first</span><span class="caption">{before.length ? "in order" : ""}</span></div>
        {#if !before.length}
          <p class="caption you-note">Nothing is marked as required before this note.</p>
        {:else}
          {@render studyList(before.slice(-8))}
          <p class="caption you-note">{before.length > 8 ? `The last 8 of ${before.length}. ` : ""}<a href={"#/path/" + encodeURIComponent(c.id)}>Show the path on the Atlas</a></p>
        {/if}
      </div>
    {/if}
    <details class="blk details-more">
      <summary class="kind">Details</summary>
      <table class="fm"><tbody>
        {#each rows as [k, v] (k)}<tr><th scope="row">{k}</th><td><FmValue value={v} /></td></tr>{/each}
      </tbody></table>
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
      {#if back.length}<h2>Linked from</h2>{@render linkList(back)}{/if}
      {#if out.length}<h2>Links to</h2>{@render linkList(out)}{/if}
    </details>
  </div>
</aside>
