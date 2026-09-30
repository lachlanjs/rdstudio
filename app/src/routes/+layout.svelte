<script lang="ts">
  // The shell: header, tabs, the live indicator, and the page below.
  import "../app.css";
  import "katex/dist/katex.min.css";
  import githubLight from "highlight.js/styles/github.min.css?url";
  import githubDark from "highlight.js/styles/github-dark.min.css?url";
  import type { Snippet } from "svelte";
  import { page } from "$app/state";
  import { afterNavigate } from "$app/navigation";
  import { store } from "$lib/data.svelte.ts";
  import { procedures, reviewCount } from "$lib/review.ts";
  import { settings } from "$lib/settings.svelte.ts";

  let { children }: { children: Snippet } = $props();

  // Which tab a route belongs to.
  const TABS: Record<string, string> = {
    "/": "knowledge", "/d/[...id]": "knowledge", "/k/[...id]": "knowledge", "/map/[...focus]": "map", "/path/[...id]": "map",
    "/graph": "graph", "/learn": "learn", "/changes": "changes", "/review": "review", "/reports": "reports",
    "/r/[...path]": "reports", "/procedures": "procedures", "/p/[...id]": "procedures", "/settings": "settings",
    "/skills": "skills", "/skill/[...name]": "skills", "/agent/[...name]": "skills",
  };
  const tab = $derived(TABS[page.route.id ?? ""] ?? "knowledge");
  const review = $derived(store.loaded ? reviewCount() : 0);
  const showProcedures = $derived(procedures().length > 0 || tab === "procedures");

  let drawer = $state(false);
  let fullscreen = $state(false);
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled && !matchMedia("(display-mode: fullscreen)").matches;

  afterNavigate(() => { drawer = false; });
  // The drawer's styles hang off the body (the page behind it dims).
  $effect(() => { document.body.classList.toggle("drawer-open", drawer); });
  $effect(() => store.watch()); // live updates, stopped if the shell ever goes away

  // highlight.js's stylesheet follows the mode, or the system when it is "system".
  const codeMedia = $derived({
    light: settings.mode === "system" ? "(prefers-color-scheme: light)" : settings.mode === "light" ? "all" : "not all",
    dark: settings.mode === "system" ? "(prefers-color-scheme: dark)" : settings.mode === "dark" ? "all" : "not all",
  });

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  }
</script>

<svelte:head>
  <link rel="stylesheet" href={githubLight} media={codeMedia.light} />
  <link rel="stylesheet" href={githubDark} media={codeMedia.dark} />
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === "Escape") drawer = false; }} />
<svelte:document onfullscreenchange={() => (fullscreen = Boolean(document.fullscreenElement))} />

<header class="bar">
  <button class="menu" type="button" aria-label="Show contents" aria-expanded={drawer} hidden={tab !== "knowledge"} onclick={() => (drawer = !drawer)}>
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
  </button>
  <a class="brand" href="#/">{store.site.title || "rdstudio"}</a>
  <nav class="tabs" aria-label="Sections">
    {#snippet link(id: string, href: string, label: string, count?: number)}
      <a {href} data-tab={id} aria-current={tab === id ? "page" : undefined}>{label}{#if count}<span class="count"> {count}</span>{/if}</a>
    {/snippet}
    {@render link("knowledge", "#/", "Knowledge")}
    {@render link("map", "#/map", "Map")}
    {@render link("graph", "#/graph", "Graph")}
    {@render link("learn", "#/learn", "Learn")}
    {@render link("changes", "#/changes", "Changes")}
    {@render link("review", "#/review", "Review", review)}
    {@render link("reports", "#/reports", "Reports", store.reports.length)}
    {#if showProcedures}{@render link("procedures", "#/procedures", "Procedures")}{/if}
    {@render link("skills", "#/skills", "Skills & agents")}
  </nav>
  {#if store.live !== "static"}
    <span class={["live", store.live === "offline" && "offline"]} title="The page refreshes when files change">{store.live === "offline" ? "Offline" : "Live"}</span>
  {/if}
  {#if canFullscreen}
    <button class="fullscreen" type="button" aria-label="Full screen" aria-pressed={fullscreen} title="Full screen" onclick={toggleFullscreen}>
      <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg>
    </button>
  {/if}
  <a class="settings-link" href="#/settings" data-tab="settings" aria-label="Settings" aria-current={tab === "settings" ? "page" : undefined}>
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8" /><circle cx="10" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
    <span>Settings</span>
  </a>
</header>
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape closes it too) -->
<div class="scrim" onclick={() => (drawer = false)}></div>
<main id="view" tabindex="-1">
  {@render children()}
</main>
