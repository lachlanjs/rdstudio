<script lang="ts">
  import { store } from "$lib/data.svelte.ts";
  import { graphOf, layers, relation, RELATIONS } from "$lib/flow.ts";
  import { conceptHref, fmtDateTime } from "$lib/format.ts";
  import { render } from "$lib/markdown.ts";
  import type { Proposal } from "$lib/review.ts";
  import FlowGraph, { type Selection } from "./FlowGraph.svelte";
  import Prose from "./Prose.svelte";

  let { id }: { id: string } = $props();

  const c = $derived(store.concepts.get(id));
  const g = $derived(c ? graphOf(c) : null);
  const body = $derived(c && store.version !== undefined ? store.body(id) : Promise.resolve(""));
  const proposals = $derived(((c?.meta.proposals as Proposal[] | undefined) ?? []));
  // Raw, not proxied: the flow graph compares the selection with its own objects.
  let selected = $state.raw<Selection>(null);
  let panel = $state<HTMLElement>();

  // Left to right when it fits beside the inspector, otherwise top to bottom.
  const vertical = $derived.by(() => {
    if (!g) return false;
    const available = Math.min(window.innerWidth, 1320) - (window.innerWidth > 1000 ? 420 : 40);
    return layers(g).length * 260 > available;
  });

  function select(s: Selection) {
    selected = s;
    if (vertical) panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
</script>

<svelte:head><title>{c ? c.title : "Not found"} · {store.site.title}</title></svelte:head>

{#if !c || !g}
  <div class="page"><h1>Not found</h1><p><a href="#/procedures">All procedures</a></p></div>
{:else}
  <div class="page wide">
    <p class="doc-kind"><a href="#/procedures">Procedures</a><a href={conceptHref(id)}>Open as concept</a></p>
    <h1>{c.title}</h1>
    {#if c.description}<p class="lede">{c.description}</p>{/if}
    <div class="legend">
      {#each Object.values(RELATIONS) as v (v.label)}<span><i style="background:{v.color};height:3px;border-radius:0;width:16px"></i>{v.label}</span>{/each}
      <span><i style="background:var(--stale)"></i>has pitfalls</span>
    </div>
    <div class="flow-layout">
      <div class="flow-scroll"><FlowGraph {g} {vertical} {selected} onselect={select} /></div>
      <div class="inspector-wrap" bind:this={panel}>
        {#if selected === null}
          <div class="inspector empty">Select a step or a transition to see its details.</div>
        {:else if "edge" in selected}
          {@const e = selected.edge}
          {@const rel = relation(e.relation)}
          <div class="inspector">
            <p class="doc-kind">Transition</p>
            <h3>{g.nodes.get(e.from)!.label}<span class="rel" style:color={rel.color}>{` ${rel.label} `}</span>{g.nodes.get(e.to)!.label}</h3>
            {#each [["condition", "When"], ["guidance", "How"], ["pitfalls", "Avoid"]] as const as [k, label] (k)}
              {#if e[k]}<div class="attr {k}"><strong>{label}</strong><p>{String(e[k])}</p></div>{/if}
            {/each}
            {#if !(e.condition || e.guidance || e.pitfalls)}<p class="empty">No notes on this transition.</p>{/if}
          </div>
        {:else}
          {@const sid = selected.node}
          {@const n = g.nodes.get(sid)!}
          {@const out = g.edges.filter((e) => e.from === sid)}
          {@const into = g.edges.filter((e) => e.to === sid)}
          <div class="inspector">
            <p class="doc-kind">{sid === g.start ? "Step (start)" : "Step"}<code>{sid}</code></p>
            <h3>{n.label}</h3>
            {#if n.description}<p>{String(n.description)}</p>{/if}
            {#if into.length}<p class="section-note">After: {into.map((e) => g.nodes.get(e.from)!.label).join(", ")}</p>{/if}
            {#if out.length}
              <ul class="rows">
                {#each out as e, i (i)}
                  <li>
                    <div><span style:color={relation(e.relation).color}>{relation(e.relation).label}</span> <strong>{g.nodes.get(e.to)!.label}</strong></div>
                    {#if e.condition}<div class="desc">When: {e.condition}</div>{/if}
                    {#if e.pitfalls}<div class="desc">Avoid: {e.pitfalls}</div>{/if}
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="empty">End of the procedure.</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
    {#if proposals.length}
      <h2 class="section-h">Proposed changes<span class="count">{proposals.filter((p) => p.state === "pending").length}</span></h2>
      <p class="section-note">Agents propose edits; you apply or reject them with <code>rdstudio procedure apply|reject {c.id} &lt;n&gt;</code>. Rejected proposals stay as a record so they are not proposed again.</p>
      <ul class="rows">
        {#each [...proposals].reverse() as p (p.id)}
          <li>
            <div><strong>#{p.id} </strong><span class="chip state-{p.state}">{p.state}</span> {p.rationale || ""}</div>
            <div class="sub"><span>{p.by || ""}</span>{#if p.at}<span>{fmtDateTime(p.at)}</span>{/if}</div>
            <ul class="files">
              {#each p.edits ?? [] as e, i (i)}<li>{Object.entries(e).map(([k, v]) => `${k}: ${v}`).join(", ")}</li>{/each}
            </ul>
          </li>
        {/each}
      </ul>
    {/if}
    {#await body then text}
      {#if text.trim()}<h2 class="section-h">Notes</h2><Prose html={render(text, { dir: c.directory })} />{/if}
    {/await}
  </div>
{/if}
