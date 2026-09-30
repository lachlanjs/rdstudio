<script lang="ts">
  import { store } from "$lib/data.svelte.ts";
  import { render } from "$lib/markdown.ts";
  import Prose from "./Prose.svelte";

  let { kind, name }: { kind: "skill" | "agent"; name: string } = $props();

  const s = $derived((kind === "skill" ? store.skills.skills : store.skills.agents).find((x) => x.name === name));
  const meta = $derived(s ? Object.entries(s.meta).filter(([k]) => k !== "description") : []);
  const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v));
</script>

<svelte:head><title>{s ? s.name : "Not found"} · {store.site.title}</title></svelte:head>

{#if !s}
  <div class="page"><h1>Not found</h1><p><a href="#/skills">All skills and agents</a></p></div>
{:else}
  <div class="page">
    <p class="doc-kind"><a href="#/skills">Skills &amp; agents</a><span>{kind === "skill" ? "Skill" : "Agent"}</span><span>{s.path}</span></p>
    <h1>{kind === "skill" ? "/" + s.name : s.name}</h1>
    {#if s.description}<p class="lede">{s.description}</p>{/if}
    {#if meta.length}
      <table class="fm" style="max-width:560px;margin-bottom:28px"><tbody>
        {#each meta as [k, v] (k)}<tr><th>{k}</th><td>{show(v)}</td></tr>{/each}
      </tbody></table>
    {/if}
    <Prose html={render(s.body)} />
  </div>
{/if}
