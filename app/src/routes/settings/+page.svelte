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

<div class="page">
  <h1>Settings</h1>
  <p class="lede">Saved in this browser only. Other devices and the exported site keep their own settings.</p>

  <h2 class="section-h">Theme</h2>
  <div class="toggles" role="radiogroup" aria-label="Theme">
    {#each THEMES as t (t.id)}
      <button class="toggle" type="button" role="radio" aria-checked={settings.theme === t.id} onclick={() => settings.setTheme(t.id)}>{t.name}</button>
    {/each}
  </div>
  {#if settings.theme === "station"}
    <label class="section-note"><input type="checkbox" checked={settings.scanlines} onchange={(e) => settings.setScanlines(e.currentTarget.checked)} /> Scan lines</label>
  {/if}

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
