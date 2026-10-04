<script lang="ts">
  // Project (T53): the upkeep of the knowledge base, for you, a team and its
  // agents: what changed, what waits for review, reports, procedures, skills.
  import { store } from "$lib/data.svelte.ts";
  import { procedures, reviewCount } from "$lib/review.ts";

  const review = $derived(store.loaded ? reviewCount() : 0);
  const PLACES = $derived([
    { href: "#/changes", name: "Changes", what: "What changed, commit by commit, from git.", count: null as number | null },
    { href: "#/review", name: "Review", what: "Notes changed since a person checked them, and proposals waiting for an answer.", count: review || null },
    { href: "#/reports", name: "Reports", what: "Write-ups by agents, as pages with charts and maths.", count: store.reports.length || null },
    { href: "#/procedures", name: "Procedures", what: "How things are done here, step by step, as agents follow them.", count: procedures().length || null },
    { href: "#/skills", name: "Skills and agents", what: "What the agents working here can do, and how.", count: null },
  ]);
</script>

<svelte:head><title>Project · {store.site.title}</title></svelte:head>

<div class="page">
  <h1>Project</h1>
  <p class="lede">The upkeep of {store.site.title || "this knowledge base"}: for you, your team and the agents working in it.</p>
  <ul class="rows project-places">
    {#each PLACES as p (p.href)}
      <li><a class="title" href={p.href}>{p.name}</a>{#if p.count}<span class="count"> {p.count}</span>{/if}<div class="desc">{p.what}</div></li>
    {/each}
  </ul>
</div>
