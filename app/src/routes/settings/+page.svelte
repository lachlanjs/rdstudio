<script lang="ts">
  import { store } from "$lib/data.svelte.ts";
  import { MODES, THEMES, settings } from "$lib/settings.svelte.ts";
  import { projectMode } from "$lib/shell.svelte.ts";
  import { teacher } from "$lib/teacher.svelte.ts";

  // The project's mode (T75): not this browser's, but the project's own, in rdstudio.toml.
  const projectIs = $derived(projectMode());
  let modeBusy = $state(false), modeError = $state("");
  async function setProjectMode(to: "Learning" | "Project") {
    if (to === projectIs || modeBusy) return;
    modeBusy = true; modeError = "";
    try { await teacher.setMode(to); } catch (err) { modeError = (err as Error).message; }
    modeBusy = false;
  }

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

  {#if projectIs}
    <h2 class="section-h">This project's mode</h2>
    <div class="toggles" role="radiogroup" aria-label="This project's mode">
      <button class="toggle" type="button" role="radio" aria-checked={projectIs === "Learning"} disabled={modeBusy} onclick={() => setProjectMode("Learning")}>Learning</button>
      <button class="toggle" type="button" role="radio" aria-checked={projectIs === "Project"} disabled={modeBusy} onclick={() => setProjectMode("Project")}>Project</button>
    </div>
    <p class="section-note">Learning: study leads (Practice, streaks, the Understanding lens). Project: upkeep leads (the Project space, the week's counters, the Activity lens).
      Unlike the settings below, this is the project's, not this browser's: it is saved in <code>rdstudio.toml</code> as the agent's profile
      ({teacher.state?.profile}{teacher.state && !teacher.state.profileSet ? ", guessed until it is set" : ""}), for everyone who opens the project.</p>
    {#if modeError}<p class="section-note bad">{modeError}</p>{/if}
  {/if}

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
    <h2 class="section-h">Axis</h2>
    <p class="section-note">Axis is the agent that teaches and helps in this project: its profile, and the skills it follows. <a href="#/teacher">Open Axis</a>.</p>
  {/if}
</div>
