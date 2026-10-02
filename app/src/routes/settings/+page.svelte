<script lang="ts">
  import { store } from "$lib/data.svelte.ts";
  import { MODES, THEMES, settings } from "$lib/settings.svelte.ts";

  let graphReset = $state(false);

  function resetGraph() {
    try { localStorage.removeItem("rdstudio.graph"); sessionStorage.removeItem("rdstudio.graph"); } catch { /* ignore */ }
    graphReset = true;
  }
</script>

<svelte:head><title>Settings · {store.site.title}</title></svelte:head>

{#snippet swatches(colors: readonly string[])}
  <span class="swatches" aria-hidden="true">{#each colors as c (c)}<i style:background={c}></i>{/each}</span>
{/snippet}

<div class="page">
  <h1>Settings</h1>
  <p class="lede">Saved in this browser only. Other devices and the exported site keep their own settings.</p>

  <h2 class="section-h">Theme</h2>
  <div class="theme-grid" role="radiogroup" aria-label="Theme">
    {#each THEMES as t (t.id)}
      <button class="theme-card" type="button" role="radio" aria-checked={settings.theme === t.id} onclick={() => settings.setTheme(t.id)}>
        <span class="theme-name" style:font-family={t.ui}>{t.name}</span>
        <span class="theme-sample" style:font-family={t.text}>Geodesics are the straight lines of a curved space.</span>
        <span class="theme-note">{t.note}</span>
        <span class="theme-swatches">{@render swatches(t.light)}{@render swatches(t.dark)}</span>
      </button>
    {/each}
  </div>

  <h2 class="section-h">Light or dark</h2>
  <div class="toggles" role="radiogroup" aria-label="Light or dark">
    {#each MODES as [id, label] (id)}
      <button class="toggle" type="button" role="radio" aria-checked={settings.mode === id} onclick={() => settings.setMode(id)}>{label}</button>
    {/each}
  </div>

  <h2 class="section-h">Graph</h2>
  <p class="section-note">Forces, filters and node positions are adjusted on the Graph tab and remembered here.</p>
  <div class="toggles">
    <button class="toggle" type="button" onclick={resetGraph}>
      {graphReset ? "Graph reset. It lays out afresh after a reload." : "Reset graph layout and options"}
    </button>
  </div>

  {#if !store.site.static}
    <h2 class="section-h">Teacher</h2>
    <p class="section-note">How the agent teaches you in this project: its profile, and the skills it follows. <a href="#/teacher">Open the teacher</a>.</p>
  {/if}
</div>
