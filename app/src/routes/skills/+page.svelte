<script lang="ts">
  import type { SkillRecord } from "@rdstudio/core";
  import { store } from "$lib/data.svelte.ts";
</script>

<svelte:head><title>Skills &amp; agents · {store.site.title}</title></svelte:head>

{#snippet row(kind: "skill" | "agent", s: SkillRecord)}
  <li>
    <a class="title" href="#/{kind}/{encodeURIComponent(s.name)}">{kind === "skill" ? "/" + s.name : s.name}</a>
    <div class="sub">
      {#if s.scope === "user"}<span class="chip">user-level</span>{/if}
      <span>{s.path}</span>
      {#if s.meta?.model}<span>model: {String(s.meta.model)}</span>{/if}
    </div>
    {#if s.description}<div class="desc">{s.description}</div>{/if}
  </li>
{/snippet}

<div class="page">
  <h1>Skills &amp; agents</h1>
  <p class="lede">Skills are procedures an agent runs on request. Agents are subagent profiles the main agent can delegate to. User-level ones apply to every project; move a skill between scopes with rdstudio skills to-user|to-project &lt;name&gt;.</p>
  <h2 class="section-h">Skills<span class="count">{store.skills.skills.length}</span></h2>
  {#if store.skills.skills.length}
    <ul class="rows">{#each store.skills.skills as s (s.path)}{@render row("skill", s)}{/each}</ul>
  {:else}
    <p class="empty">No skills in .claude/skills yet. Run rdstudio init to add the standard set.</p>
  {/if}
  <h2 class="section-h">Agents<span class="count">{store.skills.agents.length}</span></h2>
  {#if store.skills.agents.length}
    <ul class="rows">{#each store.skills.agents as s (s.path)}{@render row("agent", s)}{/each}</ul>
  {:else}
    <p class="empty">No agent profiles in .claude/agents yet.</p>
  {/if}
</div>
