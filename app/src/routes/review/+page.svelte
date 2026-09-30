<script lang="ts">
  import type { ConceptRecord, SiteInfo } from "@rdstudio/core";
  import ConceptRow from "$lib/components/ConceptRow.svelte";
  import Section from "$lib/components/Section.svelte";
  import Time from "$lib/components/Time.svelte";
  import { store } from "$lib/data.svelte.ts";
  import { conceptHref } from "$lib/format.ts";
  import { reviewItems, type Proposal } from "$lib/review.ts";

  const r = $derived(reviewItems());
  const human = $derived(store.site.human || "human:<you>");
  const generatedBy = (c: ConceptRecord) => (c.meta?.generated as { by?: string } | undefined)?.by;
</script>

<svelte:head><title>Review · {store.site.title}</title></svelte:head>

{#snippet conceptRow(c: ConceptRecord)}<ConceptRow {c} />{/snippet}

{#snippet unverifiedRow(c: ConceptRecord)}
  <ConceptRow {c}>{#snippet extra()}{#if generatedBy(c)}<span>by {generatedBy(c)}</span>{/if}{/snippet}</ConceptRow>
{/snippet}

{#snippet issueRow(i: SiteInfo["issues"][number])}
  {@const id = i.path.replace(/\.md$/, "")}
  <li>
    {#if store.concepts.has(id)}<a class="title" href={conceptHref(id)}>{i.path}</a>{:else}<span class="title">{i.path}</span>{/if}
    <div class="desc">{i.message}</div>
  </li>
{/snippet}

{#snippet proposalRow({ c, p }: { c: ConceptRecord; p: Proposal })}
  <li>
    <a class="title" href={"#/p/" + c.id}>{c.title}, proposal #{p.id}</a>
    <div class="sub"><span>{p.by || ""}</span>{#if p.at}<span><Time iso={p.at} /></span>{/if}</div>
    {#if p.rationale}<div class="desc">{p.rationale}</div>{/if}
  </li>
{/snippet}

<div class="page">
  <h1>Review</h1>
  <p class="lede">What needs a human look. Mark a concept as checked with <code>rdstudio verify &lt;id&gt;</code> (recorded as {human}).</p>
  <Section title="Changed since review" note="Human-reviewed concepts that were meaningfully edited afterwards." items={r.stale} row={conceptRow} />
  <Section title="Open questions" items={r.questions} row={conceptRow} />
  {#if r.proposals.length}
    <Section title="Proposed procedure changes" note="Apply or reject with rdstudio procedure apply|reject <procedure> <n>." items={r.proposals} row={proposalRow} />
  {/if}
  <Section title="Unverified" note="Concepts nobody has confirmed yet, newest first." items={r.unverified} row={unverifiedRow} />
  {#if r.drafts.length}<Section title="Drafts" items={r.drafts} row={conceptRow} />{/if}
  {#if r.expired.length}<Section title="Past their stale date" note="stale_after has passed." items={r.expired} row={conceptRow} />{/if}
  {#if r.cycles.length}
    <Section title="Notes that require each other" items={r.cycles} row={issueRow}
      note={'Prerequisites that loop back on themselves: either the ideas are tangled, or one of the "requires" ratings is wrong.'} />
  {/if}
  <Section title="Format errors" note="Files that do not conform to OKF." items={r.errors} row={issueRow} />
  {#if r.broken.length}<Section title="Links to unwritten knowledge" items={r.broken} row={issueRow} />{/if}
</div>
